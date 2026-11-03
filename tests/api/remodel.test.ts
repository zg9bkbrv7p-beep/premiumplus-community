import { test, expect, vi } from "vitest";
import * as remodelImages from "../../server/remodel/images";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../../server/app";
import type { RemodelProvider } from "../../server/remodel/provider";
const region = [
  { x: 0.2, y: 0.2 },
  { x: 0.8, y: 0.2 },
  { x: 0.8, y: 0.8 },
  { x: 0.2, y: 0.8 },
];
async function fixture(provider?: RemodelProvider, path = ":memory:") {
  const a = createApp(path, "http://localhost", {
    remodelProvider: provider,
  });
  const user = request.agent(a.http);
  const r = await user
    .post("/api/auth/register")
    .set("Origin", "http://localhost")
    .send({
      name: "Remodel QA",
      company: "Remodel",
      email: "photo@example.test",
      password: "fictional-password-2026",
    });
  const post = (url: string, data: any) =>
    user
      .post(url)
      .set("Origin", "http://localhost")
      .set("X-CSRF-Token", r.body.csrf)
      .send(data);
  const project = (await post("/api/projects", {address:'100 Test Lane', name: "Real photo project" }))
    .body;
  const other = (await post("/api/projects", {address:'100 Test Lane', name: "Other project" })).body;
  const image = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#204030" },
  })
    .png()
    .toBuffer();
  const uploaded = await post(`/api/projects/${project.id}/remodel/photos`, {
    name: "property.png",
    base64: image.toString("base64"),
  });
  return {
    ...a,
    user,
    post,
    project,
    other,
    photo: uploaded.body,
    image,
    uploaded,
    csrf: r.body.csrf,
  };
}
async function ready(f: any, id: string) {
  for (let i = 0; i < 150; i++) {
    const r = await f.user.get(`/api/projects/${f.project.id}/remodel`);
    const j = r.body.concepts.find((v: any) => v.id === id);
    if (j?.status === "ready" || j?.status === "failed") return j;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw Error("Job did not finish");
}
test("local upload is scoped; disabled provider never substitutes a stock output", async () => {
  const f = await fixture();
  try {
    expect(f.uploaded.status).toBe(201);
    expect(f.photo.width).toBe(300);
    expect(
      (
        await f.user.get(
          `/api/projects/${f.other.id}/remodel/photos/${f.photo.id}`,
        )
      ).status,
    ).toBe(404);
    const r = await f.post(`/api/projects/${f.project.id}/remodel/concepts`, {
      photoId: f.photo.id,
      region,
      material: "wood",
      consent: true,
      requestKey: "upload-test-00000001",
    });
    expect(r.status).toBe(503);
    expect(
      (await f.user.get(`/api/projects/${f.project.id}/remodel`)).body.concepts,
    ).toEqual([]);
    expect(
      (
        await f.post(`/api/projects/${f.project.id}/remodel/photos`, {
          name: "bad.png",
          base64: Buffer.from("fake").toString("base64"),
        })
      ).status,
    ).toBe(422);
  } finally {
    f.db.close();
  }
});
test("real source and alpha mask go to provider; duplicates are not re-billed; outside marked area is preserved", async () => {
  let calls = 0;
  const provider: RemodelProvider = {
    name: "test-only",
    model: "synthetic-test",
    edit: async (input) => {
      calls++;
      const meta = await sharp(input.image).metadata();
      expect(meta.width).toBe(1024);
      expect((await sharp(input.mask).metadata()).channels).toBe(4);
      return {
        image: await sharp({
          create: {
            width: 1024,
            height: 1024,
            channels: 3,
            background: "#bb4422",
          },
        })
          .png()
          .toBuffer(),
        usage: { test: true },
      };
    },
  };
  const f = await fixture(provider);
  try {
    const input = {
      photoId: f.photo.id,
      region,
      material: "glass",
      consent: true,
      requestKey: "generation-test-0001",
    };
    expect(
      (
        await f.post(`/api/projects/${f.project.id}/remodel/concepts`, {
          ...input,
          consent: false,
        })
      ).status,
    ).toBe(422);
    const r = await f.post(
      `/api/projects/${f.project.id}/remodel/concepts`,
      input,
    );
    expect(r.status).toBe(202);
    const j = await ready(f, r.body.id);
    expect(j.status).toBe("ready");
    expect(
      (await f.post(`/api/projects/${f.project.id}/remodel/concepts`, input))
        .body.id,
    ).toBe(j.id);
    expect(calls).toBe(1);
    const result = await f.user.get(
      `/api/projects/${f.project.id}/remodel/concepts/${j.id}/image`,
    );
    const pixels = await sharp(result.body)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([...pixels.data.subarray(0, 3)]).toEqual([32, 64, 48]);
    expect([
      ...pixels.data.subarray((100 * 300 + 150) * 3, (100 * 300 + 150) * 3 + 3),
    ]).not.toEqual([32, 64, 48]);
    expect(
      (
        await f.user.get(
          `/api/projects/${f.other.id}/remodel/concepts/${j.id}/image`,
        )
      ).status,
    ).toBe(404);
    const { defaultProposal } = await import("../proposal-fixture");
    const proposal = (
      await f.post(
        `/api/projects/${f.project.id}/proposals`,
        defaultProposal("Test"),
      )
    ).body;
    const apply = await f.post(
      `/api/projects/${f.project.id}/remodel/concepts/${j.id}/proposal`,
      { proposalId: proposal.id, revision: proposal.revision },
    );
    expect(apply.status).toBe(200);
    expect(apply.body.designImage).toMatch(/^data:image\/png;base64,/);
    expect(apply.body.revision).toBe(proposal.revision + 1);
    expect(
      (
        await f.post(
          `/api/projects/${f.project.id}/remodel/concepts/${j.id}/proposal`,
          { proposalId: proposal.id, revision: proposal.revision },
        )
      ).status,
    ).toBe(409);
  } finally {
    f.db.close();
  }
});
test("provider failure retains photo and reports no fabricated result", async () => {
  const f = await fixture({
    name: "test-only",
    model: "synthetic-test",
    edit: async () => {
      throw Error("PRIVATE_API_KEY_MUST_NOT_LEAK");
    },
  });
  try {
    const r = await f.post(`/api/projects/${f.project.id}/remodel/concepts`, {
      photoId: f.photo.id,
      region,
      material: "metal",
      consent: true,
      requestKey: "failure-test-00000001",
    });
    const j = await ready(f, r.body.id);
    expect(j.status).toBe("failed");
    expect(j.error).not.toContain("PRIVATE");
    expect(j.imageUrl).toBeNull();
    expect(
      (
        await f.user.get(
          `/api/projects/${f.project.id}/remodel/photos/${f.photo.id}`,
        )
      ).status,
    ).toBe(200);
  } finally {
    f.db.close();
  }
});
test("saved marks persist, foreign tenants cannot download photos, and issued proposals stay locked", async () => {
  const f = await fixture({
    name: "test-only",
    model: "synthetic-test",
    edit: async () => ({
      image: await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 3,
          background: "#bb4422",
        },
      })
        .png()
        .toBuffer(),
    }),
  });
  try {
    expect(
      (
        await f.user
          .put(
            `/api/projects/${f.project.id}/remodel/photos/${f.photo.id}/mark`,
          )
          .set("Origin", "http://localhost")
          .set("X-CSRF-Token", f.csrf)
          .send({ region, material: "metal" })
      ).status,
    ).toBe(200);
    expect(
      (await f.user.get(`/api/projects/${f.project.id}/remodel`)).body.photos[0]
        .region,
    ).toEqual(region);
    const stranger = request.agent(f.http);
    await stranger
      .post("/api/auth/register")
      .set("Origin", "http://localhost")
      .send({
        name: "Other",
        company: "Other",
        email: "stranger@example.test",
        password: "fictional-password-2026",
      });
    expect(
      (
        await stranger.get(
          `/api/projects/${f.project.id}/remodel/photos/${f.photo.id}`,
        )
      ).status,
    ).toBe(404);
    const input = {
      photoId: f.photo.id,
      region,
      material: "wood",
      consent: true,
      requestKey: "contract-lock-test-01",
    };
    const r = await f.post(
      `/api/projects/${f.project.id}/remodel/concepts`,
      input,
    );
    const j = await ready(f, r.body.id);
    expect(j.status).toBe("ready");
    expect(
      (
        await f.post(`/api/projects/${f.project.id}/remodel/concepts`, {
          ...input,
          material: "metal",
        })
      ).status,
    ).toBe(409);
    const { defaultProposal } = await import("../proposal-fixture");
    const proposal = (
      await f.post(
        `/api/projects/${f.project.id}/proposals`,
        defaultProposal("Immutable"),
      )
    ).body;
    const share = await f.post(`/api/projects/${f.project.id}/shares`, {
      proposalId: proposal.id,
    });
    const client = request.agent(f.http);
    const exchange = await client
      .post("/api/client/exchange")
      .set("Origin", "http://localhost")
      .send({ token: share.body.token });
    const accepted = await client
      .post("/api/client/accept")
      .set("Origin", "http://localhost")
      .set("X-CSRF-Token", exchange.body.csrf)
      .send({ name: "Homeowner", consent: true, selectedIds: [] });
    expect(accepted.status).toBe(201);
    expect(
      (
        await f.post(
          `/api/projects/${f.project.id}/remodel/concepts/${j.id}/proposal`,
          { proposalId: proposal.id, revision: proposal.revision },
        )
      ).status,
    ).toBe(409);
    expect(
      (
        f.db
          .prepare("SELECT sha256 FROM agreements WHERE id=?")
          .get(accepted.body.id) as any
      ).sha256,
    ).toBe(accepted.body.sha256);
    expect(
      (await client.get(`/api/projects/${f.project.id}/remodel`)).status,
    ).toBe(401);
  } finally {
    f.db.close();
  }
});
test("revoked sessions cannot persist provider output after a long running edit", async () => {
  let resume!: (v: any) => void,
    called = false;
  const f = await fixture({
    name: "test-only",
    model: "synthetic-test",
    edit: async () => {
      called = true;
      return new Promise((resolve) => {
        resume = resolve;
      });
    },
  });
  try {
    const r = await f.post(`/api/projects/${f.project.id}/remodel/concepts`, {
      photoId: f.photo.id,
      region,
      material: "wood",
      consent: true,
      requestKey: "revoke-running-test-01",
    });
    for (let i = 0; i < 100 && !called; i++)
      await new Promise((r) => setTimeout(r, 5));
    expect(called).toBe(true);
    f.db.exec("DELETE FROM sessions");
    resume({
      image: await sharp({
        create: {
          width: 1024,
          height: 1024,
          channels: 3,
          background: "#bb4422",
        },
      })
        .png()
        .toBuffer(),
    });
    for (let i = 0; i < 150; i++) {
      const row = f.db
        .prepare("SELECT status,image FROM remodel_concepts WHERE id=?")
        .get(r.body.id) as any;
      if (row.status === "failed") {
        expect(row.image).toBeNull();
        return;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    throw Error("Revoked job did not fail");
  } finally {
    f.db.close();
  }
});
test("development allowance reserves failed attempts and stops before another provider call", async () => {
  process.env.PHOTO_REMODEL_BUDGET_CENTS = "100";
  let calls = 0;
  const f = await fixture({
    name: "test-only",
    model: "synthetic-test",
    edit: async () => {
      calls++;
      throw Error("Synthetic failure");
    },
  });
  try {
    const input = {
      photoId: f.photo.id,
      region,
      material: "wood",
      consent: true,
      requestKey: "budget-one-test-0001",
    };
    const first = await f.post(
      `/api/projects/${f.project.id}/remodel/concepts`,
      input,
    );
    expect(first.status).toBe(202);
    expect((await ready(f, first.body.id)).status).toBe("failed");
    expect(
      (
        await f.post(`/api/projects/${f.project.id}/remodel/concepts`, {
          ...input,
          requestKey: "budget-two-test-0002",
        })
      ).status,
    ).toBe(402);
    expect(calls).toBe(1);
    expect(
      (await f.user.get(`/api/projects/${f.project.id}/remodel`)).body.provider
        .remainingAttempts,
    ).toBe(0);
  } finally {
    f.db.close();
    delete process.env.PHOTO_REMODEL_BUDGET_CENTS;
  }
});
test("photo, saved region and generated output survive backup restoration into a reopened database", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createBackup, restoreBackup } = await import("../../server/backup");
  const dir = mkdtempSync(join(tmpdir(), "photo-restore-"));
  const f = await fixture(
    {
      name: "test-only",
      model: "synthetic-test",
      edit: async () => ({
        image: await sharp({
          create: {
            width: 1024,
            height: 1024,
            channels: 3,
            background: "#bb4422",
          },
        })
          .png()
          .toBuffer(),
      }),
    },
    join(dir, "live.sqlite"),
  );
  let restored: ReturnType<typeof createApp> | undefined;
  try {
    await f.user
      .put(`/api/projects/${f.project.id}/remodel/photos/${f.photo.id}/mark`)
      .set("Origin", "http://localhost")
      .set("X-CSRF-Token", f.csrf)
      .send({ region, material: "glass" });
    const r = await f.post(`/api/projects/${f.project.id}/remodel/concepts`, {
      photoId: f.photo.id,
      region,
      material: "glass",
      consent: true,
      requestKey: "persist-restore-test-01",
    });
    const concept = await ready(f, r.body.id);
    expect(concept.status).toBe("ready");
    const before = await f.user.get(concept.imageUrl);
    const backup = join(dir, "backup.sqlite");
    await createBackup(f.db, backup);
    const path = join(dir, "restored.sqlite");
    restoreBackup(backup, path);
    restored = createApp(path);
    const agent = request.agent(restored.http);
    expect(
      (await agent.get(`/api/projects/${f.project.id}/remodel`)).status,
    ).toBe(401);
    await agent.post("/api/auth/login").set("Origin", "http://localhost").send({
      email: "photo@example.test",
      password: "fictional-password-2026",
    });
    const library = await agent.get(`/api/projects/${f.project.id}/remodel`);
    expect(library.body.photos[0].sha256).toBe(f.photo.sha256);
    expect(library.body.photos[0].region).toEqual(region);
    expect(library.body.concepts[0].status).toBe("ready");
    expect((await agent.get(concept.imageUrl)).body).toEqual(before.body);
  } finally {
    f.db.close();
    restored?.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("access revoked during image preparation prevents external dispatch", async () => {
  let release!: () => void;
  let started!: () => void;
  const preparing = new Promise<void>((resolve) => {
    started = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = remodelImages.prepareEdit;
  const preparation = vi
    .spyOn(remodelImages, "prepareEdit")
    .mockImplementation(async (...args) => {
      started();
      await gate;
      return original(...args);
    });
  const edit = vi.fn();
  const f = await fixture({ name: "test-only", model: "synthetic-test", edit });
  try {
    const response = await f.post(
      `/api/projects/${f.project.id}/remodel/concepts`,
      {
        photoId: f.photo.id,
        region,
        material: "wood",
        consent: true,
        requestKey: "revoke-preparation-0001",
      },
    );
    expect(response.status).toBe(202);
    await preparing;
    f.db.exec("DELETE FROM sessions");
    release();
    for (let i = 0; i < 150; i++) {
      const row = f.db
        .prepare("SELECT status FROM remodel_concepts WHERE id=?")
        .get(response.body.id) as any;
      if (row.status === "failed") {
        expect(edit).not.toHaveBeenCalled();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw Error("Revoked preparation did not fail");
  } finally {
    release();
    preparation.mockRestore();
    f.db.close();
  }
});

test("private local finish study saves a real color simulation, never modifies the source photo, and cannot leak to another project", async () => {
  const f = await fixture();
  try {
    const base = `/api/projects/${f.project.id}/remodel`;
    const initial = await f.user.get(`${base}/photos/${f.photo.id}`);
    expect(initial.status).toBe(200);
    const result = await f.post(`${base}/color-studies`, {photoId:f.photo.id, region, color:"ivory"});
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({status:"ready", provider:"on-device-color-study", colorStudy:true, colorName:"Warm ivory"});
    const picture = await f.user.get(`${base}/concepts/${result.body.id}/image`);
    expect(picture.status).toBe(200);
    const rawBefore = await sharp(initial.body).raw().toBuffer();
    const rawAfter = await sharp(picture.body).raw().toBuffer();
    // Outside polygon the original stays pixel-for-pixel unchanged.
    expect(rawAfter.subarray(0, 3)).toEqual(rawBefore.subarray(0, 3));
    // Inside the selected region the color simulation changes pixels.
    expect(rawAfter.subarray((100*300+150)*3,(100*300+150)*3+3)).not.toEqual(rawBefore.subarray((100*300+150)*3,(100*300+150)*3+3));
    const sourceAgain = await f.user.get(`${base}/photos/${f.photo.id}`);
    expect(sourceAgain.body).toEqual(initial.body);
    expect((await f.user.get(`/api/projects/${f.other.id}/remodel/concepts/${result.body.id}/image`)).status).toBe(404);
    const invalid = await f.post(`${base}/color-studies`, {photoId:f.photo.id, region, color:"script"});
    expect(invalid.status).toBeGreaterThanOrEqual(400);
    const library = await f.user.get(base);
    expect(library.body.provider.available).toBe(false);
    expect(library.body.concepts.find((c:any)=>c.id===result.body.id).colorStudy).toBe(true);
  } finally { f.db.close(); }
});
