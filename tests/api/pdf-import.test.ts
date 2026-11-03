import { test, expect, vi } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { createApp } from "../../server/app";
import { defaultProposal } from "../proposal-fixture";
import { textPdf } from "../pdf-fixture";
import * as extractor from "../../server/pdf/extract";
async function fixture() {
  const app = createApp(":memory:");
  const user = request.agent(app.http);
  const reg = await user
    .post("/api/auth/register")
    .set("Origin", "http://localhost")
    .send({
      name: "PDF owner",
      company: "PDF studio",
      email: "pdf@example.test",
      password: "fictional-password-2026",
    });
  const post = (url: string, body: any) =>
    user
      .post(url)
      .set("Origin", "http://localhost")
      .set("X-CSRF-Token", reg.body.csrf)
      .send(body);
  const p = (await post("/api/projects", {address:'100 Test Lane', name: "PDF project" })).body;
  const proposal = (
    await post(`/api/projects/${p.id}/proposals`, defaultProposal("Original"))
  ).body;
  const path = `/api/projects/${p.id}/proposals/${proposal.id}/pdf-import`;
  const payload = {
    name: "源文件.pdf",
    base64: textPdf([
      "Scope of work",
      "Replace railing",
      "Items",
      "Wood railing | Qty: 2 | Unit price: $125.50",
    ]).toString("base64"),
    revision: proposal.revision,
  };
  return { ...app, user, post, p, proposal, path, payload };
}
test("local extraction previews without writes; explicit attachment is private, project scoped and idempotent", async () => {
  const f = await fixture();
  try {
    const before = f.db.prepare("SELECT * FROM proposals").all();
    const preview = await f.post(f.path + "/preview", f.payload);
    expect(preview.status).toBe(200);
    expect(preview.body.sections.scope).toBe("Replace railing");
    expect(preview.body.items[0].quantity).toBe("2");
    expect(f.db.prepare("SELECT * FROM project_files").all()).toEqual([]);
    expect(f.db.prepare("SELECT * FROM proposals").all()).toEqual(before);
    const attached = await f.post(f.path + "/attach", f.payload);
    expect(attached.status).toBe(200);
    expect((await f.post(f.path + "/attach", f.payload)).body.fileId).toBe(
      attached.body.fileId,
    );
    expect(f.db.prepare("SELECT * FROM project_files").all()).toHaveLength(1);
    const row = f.db.prepare("SELECT * FROM project_files").get() as any;
    expect(row.visibility).toBe("internal");
    expect(Buffer.from(row.data)).toEqual(
      Buffer.from(f.payload.base64, "base64"),
    );
    expect((await f.user.get(attached.body.url)).status).toBe(200);
    const other = request.agent(f.http);
    await other
      .post("/api/auth/register")
      .set("Origin", "http://localhost")
      .send({
        name: "Other",
        company: "Other",
        email: "other-pdf@example.test",
        password: "fictional-password-2026",
      });
    expect((await other.get(attached.body.url)).status).toBe(404);
    const another = (
      await f.post("/api/projects", {address:'100 Test Lane', name: "Another customer" })
    ).body;
    expect(
      (
        await f.user.get(
          `/api/projects/${another.id}/live/files/${attached.body.fileId}`,
        )
      ).status,
    ).toBe(404);
    expect(
      (await f.post(f.path + "/preview", { ...f.payload, revision: 99 }))
        .status,
    ).toBe(409);
    const share = (
      await f.post(`/api/projects/${f.p.id}/shares`, {
        proposalId: f.proposal.id,
      })
    ).body;
    const client = request.agent(f.http);
    const exchange = await client
      .post("/api/client/exchange")
      .set("Origin", "http://localhost")
      .send({ token: share.token });
    expect(
      (await client.get(`/api/client/files/${attached.body.fileId}`)).status,
    ).toBe(404);
    expect((await f.post(f.path + "/preview", f.payload)).status).toBe(409);
    await client
      .post("/api/client/accept")
      .set("Origin", "http://localhost")
      .set("X-CSRF-Token", exchange.body.csrf)
      .send({ name: "Owner", consent: true, selectedIds: [] });
    const agreement = f.db.prepare("SELECT * FROM agreements").get();
    expect(agreement).toBeTruthy();
    expect((await f.post(f.path + "/attach", f.payload)).status).toBe(409);
    expect(f.db.prepare("SELECT * FROM agreements").get()).toEqual(agreement);
  } finally {
    f.db.close();
  }
});
test("malformed, scanned, encrypted and oversized files fail without changing records", async () => {
  const f = await fixture();
  try {
    const cases = [
      { bytes: Buffer.from("invalid"), error: /malformed/i },
      { bytes: textPdf([]), error: /scanned|selectable/i },
      {
        bytes: readFileSync(
          new URL("../fixtures/encrypted-test.pdf", import.meta.url),
        ),
        error: /encrypted/i,
      },
      { bytes: Buffer.alloc(8 * 1024 * 1024 + 1, 32), error: /8 MB/i },
    ];
    const before = f.db.prepare("SELECT * FROM proposals").all();
    for (const v of cases) {
      const r = await f.post(f.path + "/preview", {
        ...f.payload,
        base64: v.bytes.toString("base64"),
      });
      expect(r.status).toBe(422);
      expect(r.body.error).toMatch(v.error);
    }
    expect(f.db.prepare("SELECT * FROM proposals").all()).toEqual(before);
    expect(f.db.prepare("SELECT * FROM project_files").all()).toEqual([]);
  } finally {
    f.db.close();
  }
});
test("revoking a session during extraction prevents attaching the PDF", async () => {
  const f = await fixture();
  const original = extractor.extractPdf;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    started = resolve;
  });
  const spy = vi
    .spyOn(extractor, "extractPdf")
    .mockImplementation(async (bytes) => {
      started();
      await gate;
      return original(bytes);
    });
  try {
    const pending = f.post(f.path + "/attach", f.payload).then((r) => r);
    await reached;
    f.db.exec("DELETE FROM sessions");
    release();
    expect((await pending).status).toBe(401);
    expect(f.db.prepare("SELECT * FROM project_files").all()).toEqual([]);
  } finally {
    release();
    spy.mockRestore();
    f.db.close();
  }
});
test("table and unfamiliar layouts remain local and an intervening revision blocks attachment", async () => {
  const f = await fixture();
  try {
    const table = await f.post(f.path + "/preview", {
      ...f.payload,
      base64: textPdf([
        "Materials",
        "Description | Qty | Unit price | Amount",
        "2x4 lumber | 6 | $12.50 | $75.00",
      ]).toString("base64"),
    });
    expect(table.status).toBe(200);
    expect(table.body.items[0]).toEqual({
      label: "2x4 lumber",
      quantity: "6",
      price: "12.50",
    });
    const collapsed = await f.post(f.path + "/preview", {
      ...f.payload,
      base64: textPdf([
        "Materials",
        "Description    Qty    Unit price    Amount",
        "2x4 lumber    6    $12.50    $75.00",
      ]).toString("base64"),
    });
    expect(collapsed.status).toBe(200);
    expect(
      collapsed.body.items.find((v: any) => v.label.startsWith("2x4 lumber")),
    ).toMatchObject({ quantity: "", price: "" });
    const unusual = await f.post(f.path + "/preview", {
      ...f.payload,
      base64: textPdf(["Unfamiliar layout with selectable content"]).toString(
        "base64",
      ),
    });
    expect(unusual.status).toBe(200);
    expect(unusual.body.items).toEqual([]);
    expect(unusual.body.warnings.join(" ")).toContain("No recognized sections");
    const original = extractor.extractPdf;
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const reached = new Promise<void>((r) => {
      started = r;
    });
    const spy = vi
      .spyOn(extractor, "extractPdf")
      .mockImplementation(async (bytes) => {
        started();
        await gate;
        return original(bytes);
      });
    try {
      const pending = f.post(f.path + "/attach", f.payload).then((r) => r);
      await reached;
      f.db
        .prepare("UPDATE proposals SET revision=revision+1 WHERE id=?")
        .run(f.proposal.id);
      release();
      expect((await pending).status).toBe(409);
      expect(f.db.prepare("SELECT * FROM project_files").all()).toEqual([]);
    } finally {
      release();
      spy.mockRestore();
    }
  } finally {
    f.db.close();
  }
});
