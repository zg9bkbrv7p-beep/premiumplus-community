import type { Express, Request, Response } from "express";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import type { AppContext } from "../context";
import { validateProposal } from "../../shared/proposal";
import { materials, regionSchema } from "../../shared/remodel";
import { applyFinishColor, finishColors } from "./color-study";
import { conceptPdf } from "./pdf";
import {
  configuredProvider,
  providerDisclosure,
  type RemodelProvider,
} from "./provider";
import {
  normalizePhoto,
  prepareEdit,
  finishEdit,
  proposalConcept,
} from "./images";
const now = () => new Date().toISOString();
const maxStorage = 300 * 1024 * 1024;
function scopedRequest(req: Request, id: string): Request {
  const copy = Object.create(req) as Request;
  Object.defineProperty(copy, "params", { value: { id } });
  Object.defineProperty(copy, "headers", { value: { ...req.headers } });
  return copy;
}
export function mountRemodel(
  app: Express,
  c: AppContext,
  injected?: RemodelProvider,
) {
  if (injected && process.env.NODE_ENV !== "test")
    throw Error("Injected remodel providers are restricted to tests");
  c.db
    .exec(`CREATE TABLE IF NOT EXISTS remodel_photos(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,image BLOB NOT NULL,sha256 TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS remodel_concepts(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),photo_id TEXT NOT NULL REFERENCES remodel_photos(id),material TEXT NOT NULL,region TEXT NOT NULL,status TEXT NOT NULL,image BLOB,error TEXT NOT NULL DEFAULT '',provider TEXT NOT NULL,model TEXT NOT NULL,usage TEXT,request_key TEXT NOT NULL,request_digest TEXT NOT NULL,reserved_cents INTEGER NOT NULL,created_at TEXT NOT NULL,finished_at TEXT,UNIQUE(project_id,request_key));
 CREATE INDEX IF NOT EXISTS remodel_photos_project ON remodel_photos(project_id);
 CREATE INDEX IF NOT EXISTS remodel_concepts_project ON remodel_concepts(project_id);
 CREATE TABLE IF NOT EXISTS remodel_proposal_images(proposal_id TEXT NOT NULL REFERENCES proposals(id),proposal_revision INTEGER NOT NULL,concept_id TEXT NOT NULL REFERENCES remodel_concepts(id),created_at TEXT NOT NULL,PRIMARY KEY(proposal_id,proposal_revision));
 UPDATE remodel_concepts SET status='failed',error='Generation was interrupted. It may have been billed. No automatic retry was made.',finished_at=CURRENT_TIMESTAMP WHERE status IN ('queued','running');`);
  const photoColumns = c
    .all("PRAGMA table_info(remodel_photos)")
    .map((v) => v.name);
  if (!photoColumns.includes("mark"))
    c.db.exec(
      "ALTER TABLE remodel_photos ADD COLUMN mark TEXT NOT NULL DEFAULT '[]'",
    );
  if (!photoColumns.includes("material"))
    c.db.exec(
      "ALTER TABLE remodel_photos ADD COLUMN material TEXT NOT NULL DEFAULT 'wood'",
    );
  if (!photoColumns.includes("brief")) c.db.exec("ALTER TABLE remodel_photos ADD COLUMN brief TEXT NOT NULL DEFAULT ''");
  if (!c.all("PRAGMA table_info(remodel_concepts)").some(v=>v.name==='brief')) c.db.exec("ALTER TABLE remodel_concepts ADD COLUMN brief TEXT NOT NULL DEFAULT ''");
  const provider = () =>
    process.env.NODE_ENV === "test" ? injected : configuredProvider();
  const budget = () => {
    const configured = Number(process.env.PHOTO_REMODEL_BUDGET_CENTS || 500);
    return Number.isFinite(configured)
      ? Math.max(0, Math.min(500, Math.floor(configured)))
      : 0;
  };
  const reserved = () =>
    c.one("SELECT COALESCE(SUM(reserved_cents),0) n FROM remodel_concepts")
      .n as number;
  const storage = () =>
    c.one(
      "SELECT (SELECT COALESCE(SUM(length(image)),0) FROM remodel_photos)+(SELECT COALESCE(SUM(length(image)),0) FROM remodel_concepts) n",
    ).n as number;
  const photoDto = (p: any) => ({
    id: p.id,
    name: p.name,
    width: p.width,
    height: p.height,
    sha256: p.sha256,
    createdAt: p.created_at,
    region: JSON.parse(p.mark || "[]"),
    material: p.material || "wood",
    brief: p.brief || "",
    imageUrl: `/api/projects/${p.project_id}/remodel/photos/${p.id}`,
  });
  const conceptDto = (r: any) => ({
    id: r.id,
    photoId: r.photo_id,
    material: r.material,
    brief: r.brief || "",
    region: JSON.parse(r.region),
    status: r.status,
    error: r.error,
    provider: r.provider,
    model: r.model,
    colorStudy: r.provider === "on-device-color-study",
    colorName: r.provider === "on-device-color-study" ? finishColors[(r.model.split(":")[1] || "ivory") as keyof typeof finishColors]?.name : undefined,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
    imageUrl:
      r.status === "ready"
        ? `/api/projects/${r.project_id}/remodel/concepts/${r.id}/image`
        : null,
  });
  const getPhoto = (pid: string, photoId: string) => {
    const p = c.one(
      "SELECT * FROM remodel_photos WHERE id=? AND project_id=?",
      photoId,
      pid,
    );
    if (!p) c.fail(404, "Photo not found");
    return p;
  };
  const getConcept = (pid: string, cid: string) => {
    const r = c.one(
      "SELECT * FROM remodel_concepts WHERE id=? AND project_id=?",
      cid,
      pid,
    );
    if (!r) c.fail(404, "Concept not found");
    return r;
  };
  function image(res: Response, bytes: Buffer) {
    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(Buffer.from(bytes));
  }
  app.get("/api/projects/:id/remodel", (req, res) => {
    const { p } = c.project(req);
    res.json({
      photos: c
        .all(
          "SELECT id,project_id,name,width,height,sha256,created_at,mark,material,brief FROM remodel_photos WHERE project_id=? ORDER BY created_at DESC",
          p.id,
        )
        .map(photoDto),
      concepts: c
        .all(
          "SELECT id,project_id,photo_id,material,region,status,error,provider,model,created_at,finished_at,brief FROM remodel_concepts WHERE project_id=? ORDER BY created_at DESC",
          p.id,
        )
        .map(conceptDto),
      provider: {
        ...providerDisclosure,
        available: !!provider(),
        remainingAttempts: Math.max(
          0,
          Math.floor((budget() - reserved()) / 100),
        ),
      },
    });
  });
  app.post("/api/projects/:id/remodel/photos", async (req, res, next) => {
    try {
      const { p } = c.project(req, true);
      c.limited("remodel-upload:" + p.company_id, 20);
      const b = z
        .object({
          name: z.string().trim().min(1).max(180),
          base64: z.string().min(1).max(13981016),
        })
        .parse(req.body);
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64))
        c.fail(422, "Invalid image encoding");
      const bytes = Buffer.from(b.base64, "base64");
      if (bytes.length > 10 * 1024 * 1024)
        c.fail(413, "Choose a photo under 10 MB");
      let normalized;
      try {
        normalized = await normalizePhoto(bytes);
      } catch {
        c.fail(
          422,
          "Unable to decode photo. Choose a JPEG, PNG or WebP image at least 128 × 128 pixels. Export HEIC as JPEG if needed.",
        );
      }
      const current = c.project(scopedRequest(req, p.id), true);
      if (
        c.one(
          "SELECT COUNT(*) n FROM remodel_photos WHERE project_id=?",
          current.p.id,
        ).n >= 30 ||
        storage() + normalized.image.length > maxStorage
      )
        c.fail(409, "Photo storage limit reached for this review edition");
      const id = randomUUID();
      c.transaction(() => {
        c.run(
          "INSERT INTO remodel_photos(id,project_id,name,width,height,image,sha256,created_at) VALUES(?,?,?,?,?,?,?,?)",
          id,
          p.id,
          b.name.replace(/[\u0000-\u001f\\/]/g, "_"),
          normalized.width,
          normalized.height,
          normalized.image,
          createHash("sha256").update(normalized.image).digest("hex"),
          now(),
        );
        c.event(p.id, "Property photo saved privately");
      });
      res.status(201).json(photoDto(getPhoto(p.id, id)));
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/projects/:id/remodel/photos/:photoId/mark", (req, res) => {
    const { p } = c.project(req, true);
    const source=getPhoto(p.id, req.params.photoId as string);
    const b = z
      .object({ region: regionSchema, material: z.enum(materials), brief:z.string().trim().max(2000).optional() })
      .parse(req.body);
    c.run(
      "UPDATE remodel_photos SET mark=?,material=?,brief=? WHERE id=? AND project_id=?",
      JSON.stringify(b.region),
      b.material,
      b.brief ?? source.brief ?? "",
      req.params.photoId,
      p.id,
    );
    res.json(photoDto(getPhoto(p.id, req.params.photoId as string)));
  });
  app.get("/api/projects/:id/remodel/photos/:photoId", (req, res) => {
    const { p } = c.project(req);
    image(res, getPhoto(p.id, req.params.photoId as string).image);
  });
  // Authenticated project-only color studies: no external provider and no client-supplied image data.
  app.post("/api/projects/:id/remodel/color-studies", async (req, res, next) => {
    try {
      const { p } = c.project(req, true);
      c.limited("remodel-color-study:" + p.company_id, 20);
      const b = z.object({
        photoId: z.string().uuid(),
        region: regionSchema,
        color: z.enum(Object.keys(finishColors) as [keyof typeof finishColors, ...(keyof typeof finishColors)[]]),
      }).parse(req.body);
      const photo = getPhoto(p.id, b.photoId);
      const count = c.one("SELECT COUNT(*) n FROM remodel_concepts WHERE project_id=? AND provider='on-device-color-study'", p.id).n as number;
      if (count >= 30) c.fail(409, "Color study limit reached for this project");
      const output = await applyFinishColor(Buffer.from(photo.image), b.region, b.color);
      // Recheck project membership/paid-write permission after asynchronous image work.
      c.project(scopedRequest(req, p.id), true);
      if (storage() + output.length > maxStorage) c.fail(409, "Photo storage limit reached");
      const id = randomUUID(), created = now();
      c.transaction(() => {
        c.run("INSERT INTO remodel_concepts(id,project_id,photo_id,material,region,status,image,error,provider,model,request_key,request_digest,reserved_cents,created_at,finished_at,brief) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          id, p.id, photo.id, photo.material || "wood", JSON.stringify(b.region), "ready", output, "", "on-device-color-study", `color-study:${b.color}`, randomUUID(), createHash("sha256").update(output).digest("hex"), 0, created, created,
          `${finishColors[b.color].name} finish color study (not photorealistic). ${photo.brief || ""}`.trim());
        c.event(p.id, "Private local finish color study saved to project");
      });
      res.status(201).json(conceptDto(getConcept(p.id,id)));
    } catch (error) { next(error); }
  });
  const queue: Array<() => Promise<void>> = [];
  let running = false;
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (queue.length) await queue.shift()!();
    } finally {
      running = false;
    }
  }
  app.post("/api/projects/:id/remodel/concepts", (req, res) => {
    const { p } = c.project(req, true);
    const b = z
      .object({
        photoId: z.string().min(1),
        region: regionSchema,
        material: z.enum(materials),
        brief:z.string().trim().max(2000).optional(),
        consent: z.literal(true),
        requestKey: z
          .string()
          .min(16)
          .max(100)
          .regex(/^[A-Za-z0-9-]+$/),
      })
      .parse(req.body);
    const source = getPhoto(p.id, b.photoId);
    const brief=b.brief ?? source.brief ?? "";
    const digest = createHash("sha256")
      .update(
        JSON.stringify({
          photoId: b.photoId,
          region: b.region,
          material: b.material,
          ...(brief ? {brief} : {}),
        }),
      )
      .digest("hex");
    const existing = c.one(
      "SELECT * FROM remodel_concepts WHERE project_id=? AND request_key=?",
      p.id,
      b.requestKey,
    );
    if (existing) {
      if (existing.request_digest !== digest)
        c.fail(409, "This request key belongs to different photo edits");
      return void res.status(200).json(conceptDto(existing));
    }
    const service = provider();
    if (!service)
      c.fail(
        503,
        "Real image generation is not configured. Your photo is saved locally; no photo was sent and no substitute image was generated.",
      );
    if (reserved() + 100 > budget())
      c.fail(
        402,
        "Development image-generation allowance exhausted. More spending requires approval.",
      );
    if (queue.length >= 10) c.fail(429, "Generation queue is full. Try later.");
    c.limited("remodel-generate:" + p.company_id, 5);
    const id = randomUUID();
    c.run(
      "INSERT INTO remodel_concepts(id,project_id,photo_id,material,region,status,provider,model,request_key,request_digest,reserved_cents,created_at,brief) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      id,
      p.id,
      b.photoId,
      b.material,
      JSON.stringify(b.region),
      "queued",
      service.name,
      service.model,
      b.requestKey,
      digest,
      100,
      now(),
      brief,
    );
    const snapshot = scopedRequest(req, p.id);
    queue.push(async () => {
      try {
        c.project(snapshot, true);
        c.run("UPDATE remodel_concepts SET status='running' WHERE id=?", id);
        const edit = await prepareEdit(
          Buffer.from(source.image),
          source.width,
          source.height,
          b.region,
        );
        c.project(snapshot, true);
        const activeProvider = provider();
        if (!activeProvider) throw Error("Generation disabled");
        const generated = await activeProvider.edit({
          ...edit,
          material: b.material,
          brief,
        });
        const after = await finishEdit(
          Buffer.from(source.image),
          generated.image,
          source.width,
          source.height,
          b.region,
        );
        c.project(snapshot, true);
        if (storage() + after.length > maxStorage) throw Error("Storage limit");
        c.transaction(() => {
          c.run(
            "UPDATE remodel_concepts SET status='ready',image=?,usage=?,finished_at=? WHERE id=?",
            after,
            JSON.stringify(generated.usage || {}),
            now(),
            id,
          );
          c.event(
            p.id,
            brief ? "Property concept generated from saved photo and requested changes" : `${b.material} railing concept generated from saved property photo`,
          );
        });
      } catch {
        c.run(
          "UPDATE remodel_concepts SET status='failed',error=?,finished_at=? WHERE id=?",
          "Generation could not be completed or access changed. The photo is retained. The provider may have billed the attempt; no automatic retry was made.",
          now(),
          id,
        );
      }
    });
    res.status(202).json(conceptDto(getConcept(p.id, id)));
    setImmediate(() => {
      void drain();
    });
  });
  app.get("/api/projects/:id/remodel/concepts/:conceptId/image", (req, res) => {
    const { p } = c.project(req),
      r = getConcept(p.id, req.params.conceptId as string);
    if (r.status !== "ready" || !r.image)
      c.fail(409, "This concept has no completed image");
    image(res, r.image);
  });
  app.get("/api/projects/:id/remodel/concepts/:conceptId/pdf", async(req,res,next)=>{
    try{
      const {p}=c.project(req);const concept=getConcept(p.id,req.params.conceptId as string);
      if(concept.status!=="ready"||!concept.image)c.fail(409,"Create a real concept before exporting a before-and-after PDF.");
      const photo=getPhoto(p.id,concept.photo_id);
      const company={name:c.one("SELECT name FROM companies WHERE id=?",p.company_id).name,...JSON.parse(c.one("SELECT data FROM company_settings WHERE company_id=?",p.company_id)?.data||"{}")};
      const bytes=await conceptPdf({project:{name:p.name,address:p.address},company,before:Buffer.from(photo.image),after:Buffer.from(concept.image),brief:concept.brief||"",createdAt:concept.created_at,colorStudy:concept.provider==="on-device-color-study"});
      c.project(req);
      const filename=String(p.name).normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,70)||'property';
      res.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${filename}-before-after.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}).send(bytes);
    }catch(e){next(e);}
  });
  app.post(
    "/api/projects/:id/remodel/concepts/:conceptId/proposal",
    async (req, res, next) => {
      try {
        const { p } = c.project(req, true),
          r = getConcept(p.id, req.params.conceptId as string);
        const b = z
          .object({
            proposalId: z.string().min(1),
            revision: z.number().int().positive(),
          })
          .parse(req.body);
        if (r.status !== "ready" || !r.image)
          c.fail(409, "Choose a successfully generated concept");
        const designImage = await proposalConcept(
          Buffer.from(r.image),
          r.material,
          r.brief || "",
          r.provider === "on-device-color-study" ? "color-study" : "ai",
        );
        c.project(scopedRequest(req, p.id), true);
        let updated: any;
        c.transaction(() => {
          const proposal = c.one(
            "SELECT * FROM proposals WHERE id=? AND project_id=?",
            b.proposalId,
            p.id,
          );
          if (!proposal) c.fail(404, "Proposal not found");
          if (
            proposal.status !== "draft" ||
            c.one("SELECT id FROM agreements WHERE proposal_id=?", proposal.id)
          )
            c.fail(
              409,
              "Shared or accepted proposals are locked. Create a draft revision first.",
            );
          if (proposal.revision !== b.revision)
            c.fail(409, "Proposal changed. Refresh before choosing a concept.");
          const data = validateProposal({
            ...JSON.parse(proposal.data),
            designImage,
          });
          c.run(
            "UPDATE proposals SET data=?,revision=revision+1 WHERE id=?",
            JSON.stringify(data),
            proposal.id,
          );
          c.run(
            "INSERT INTO remodel_proposal_images VALUES(?,?,?,?)",
            proposal.id,
            proposal.revision + 1,
            r.id,
            now(),
          );
          c.event(p.id, "Saved renovation concept selected for draft proposal");
          updated = c.proposalDto(
            c.one("SELECT * FROM proposals WHERE id=?", proposal.id),
          );
        });
        res.json(updated);
      } catch (e) {
        next(e);
      }
    },
  );
}
