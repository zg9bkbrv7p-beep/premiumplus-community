import type { Express, Request } from "express";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { AppContext } from "../context";
import { extractPdf } from "./extract";
import { parsePdfText } from "../../shared/pdfImport";
export function mountPdfImport(app: Express, c: AppContext) {
  c.db.exec(
    "CREATE TABLE IF NOT EXISTS pdf_import_sources(project_id TEXT NOT NULL REFERENCES projects(id),sha256 TEXT NOT NULL,file_id TEXT NOT NULL REFERENCES project_files(id),PRIMARY KEY(project_id,sha256))",
  );
  const check = (req: Request) => {
    const { p, u } = c.project(req, true);
    const proposal = c.one(
      "SELECT * FROM proposals WHERE id=? AND project_id=?",
      req.params.pid,
      p.id,
    );
    if (!proposal) c.fail(404, "Proposal not found");
    if (
      proposal.status !== "draft" ||
      c.one("SELECT 1 FROM agreements WHERE proposal_id=?", proposal.id)
    )
      c.fail(
        409,
        "Shared and accepted proposals are locked. Create a new draft revision.",
      );
    if (req.body.revision !== proposal.revision)
      c.fail(409, "Proposal changed. Reload before importing.");
    return { p, u };
  };
  for (const action of ["preview", "attach"])
    app.post(
      `/api/projects/:id/proposals/:pid/pdf-import/${action}`,
      async (req, res, next) => {
        try {
          const { p } = check(req);
          c.limited("pdf-import:" + p.company_id, 20);
          const b = z
            .object({
              name: z.string().trim().min(1).max(180),
              base64: z
                .string()
                .min(1)
                .max(11184812, "Choose a PDF smaller than 8 MB."),
              revision: z.number().int(),
            })
            .parse(req.body);
          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64))
            c.fail(422, "Invalid PDF encoding");
          const bytes = Buffer.from(b.base64, "base64");
          let text: string;
          try {
            text = await extractPdf(bytes);
          } catch (e: any) {
            c.fail(422, e.message);
          }
          const current = check(req);
          if (action === "preview") return void res.json(parsePdfText(text));
          const sha = createHash("sha256").update(bytes).digest("hex");
          let existing = c.one(
            "SELECT file_id FROM pdf_import_sources WHERE project_id=? AND sha256=?",
            p.id,
            sha,
          );
          if (!existing) {
            if (
              c.one(
                "SELECT COUNT(*) n FROM project_files WHERE project_id=?",
                p.id,
              ).n >= 100 ||
              c.one("SELECT COALESCE(SUM(bytes),0) n FROM project_files").n +
                bytes.length >
                300 * 1024 * 1024
            )
              c.fail(409, "Project document storage limit reached");
            const id = randomUUID();
            c.transaction(() => {
              c.run(
                "INSERT INTO project_files VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                id,
                p.id,
                b.name.replace(/[\\/\u0000-\u001f"<>:]/g, "_"),
                "application/pdf",
                bytes.length,
                bytes,
                "document",
                "internal",
                null,
                current.u.name,
                new Date().toISOString(),
              );
              c.run(
                "INSERT INTO pdf_import_sources VALUES(?,?,?)",
                p.id,
                sha,
                id,
              );
              c.event(p.id, "Private proposal source PDF attached");
            });
            existing = { file_id: id };
          }
          res.json({
            fileId: existing.file_id,
            url: `/api/projects/${p.id}/live/files/${existing.file_id}`,
          });
        } catch (e) {
          next(e);
        }
      },
    );
}
