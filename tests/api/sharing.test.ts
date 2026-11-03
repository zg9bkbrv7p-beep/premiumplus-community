import { test, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../server/app";
import { defaultProposal } from "../proposal-fixture";
test("revocable project capabilities and immutable acceptance use server totals", async () => {
  const app = createApp(":memory:");
  try {
    const a = request.agent(app.http);
    const reg = await a
      .post("/api/auth/register")
      .set("Origin", "http://localhost")
      .send({
        name: "Alex",
        company: "North",
        email: "alex@example.test",
        password: "fictional-long-password",
      });
    const csrf = reg.body.csrf;
    const post = (path: string, data: any) =>
      a
        .post(path)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", csrf)
        .send(data);
    const p = await post("/api/projects", {address:'100 Test Lane', name: "Test home" });
    expect(p.status).toBe(201);
    const prop = await post(
      `/api/projects/${p.body.id}/proposals`,
      defaultProposal("Home"),
    );
    expect(prop.status).toBe(201);
    const share = await post(`/api/projects/${p.body.id}/shares`, {
      proposalId: prop.body.id,
    });
    expect(share.status).toBe(201);
    const client = request.agent(app.http);
    const exchange = await client
      .post("/api/client/exchange")
      .set("Origin", "http://localhost")
      .send({ token: share.body.token });
    expect(exchange.status).toBe(200);
    const c = exchange.body.csrf;
    const cp = (path: string, data: any) =>
      client
        .post(path)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", c)
        .send(data);
    const view = await client.get("/api/client/project");
    expect(view.body.project.id).toBe(p.body.id);
    expect(view.body.proposal.status).toBe("shared");
    expect((await client.get("/api/projects/" + p.body.id)).status).toBe(401);
    expect(
      (
        await cp("/api/client/accept", {
          name: "Home Owner",
          consent: false,
          selectedIds: [],
        })
      ).status,
    ).toBe(422);
    const accepted = await cp("/api/client/accept", {
      name: "Home Owner",
      consent: true,
      selectedIds: ["finishes"],
      total: 1,
    });
    expect(accepted.status).toBe(201);
    expect(accepted.body.total).toBe(1625000);
    expect(
      (
        await cp("/api/client/accept", {
          name: "Home Owner",
          consent: true,
          selectedIds: [],
        })
      ).body.id,
    ).toBe(accepted.body.id);
    expect(
      (
        await a
          .patch(`/api/projects/${p.body.id}/proposals/${prop.body.id}`)
          .set("Origin", "http://localhost")
          .set("X-CSRF-Token", csrf)
          .send({ revision: 1, ...defaultProposal("Changed") })
      ).status,
    ).toBe(409);
    expect(() =>
      app.db.prepare("UPDATE agreements SET name=?").run("tampered"),
    ).toThrow();
    expect(
      (await cp("/api/client/comments", { body: "Looks wonderful" })).status,
    ).toBe(201);
    expect((await cp("/api/client/comments", { body: "  " })).status).toBe(422);
    const revoke = await a
      .delete(`/api/projects/${p.body.id}/shares/${share.body.id}`)
      .set("Origin", "http://localhost")
      .set("X-CSRF-Token", csrf);
    expect(revoke.status).toBe(200);
    for (const url of ["/api/client/project", "/api/client/comments"])
      expect((await client.get(url)).status).toBe(401);
    expect(
      (
        await cp("/api/client/accept", {
          name: "No",
          consent: true,
          selectedIds: [],
        })
      ).status,
    ).toBe(401);
  } finally {
    app.db.close();
  }
});
test("expired shares cannot exchange or retain access; another company cannot revoke them", async () => {
  const app = createApp(":memory:");
  try {
    const owner = request.agent(app.http);
    let r = await owner
      .post("/api/auth/register")
      .set("Origin", "http://localhost")
      .send({
        name: "Owner",
        company: "Studio",
        email: "expiry@example.test",
        password: "fictional-password-2026",
      });
    const c = r.body.csrf;
    const post = (p: string, b: any) =>
      owner
        .post(p)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", c)
        .send(b);
    const p = (await post("/api/projects", {address:'100 Test Lane', name: "Expiry House" })).body;
    const prop = (
      await post(`/api/projects/${p.id}/proposals`, defaultProposal("Expiry"))
    ).body;
    const share = (
      await post(`/api/projects/${p.id}/shares`, { proposalId: prop.id })
    ).body;
    const client = request.agent(app.http);
    expect(
      (
        await client
          .post("/api/client/exchange")
          .set("Origin", "http://localhost")
          .send({ token: share.token })
      ).status,
    ).toBe(200);
    const other = request.agent(app.http);
    r = await other
      .post("/api/auth/register")
      .set("Origin", "http://localhost")
      .send({
        name: "Other",
        company: "Other",
        email: "other-expiry@example.test",
        password: "fictional-password-2026",
      });
    expect(
      (
        await other
          .delete(`/api/projects/${p.id}/shares/${share.id}`)
          .set("Origin", "http://localhost")
          .set("X-CSRF-Token", r.body.csrf)
      ).status,
    ).toBe(404);
    app.db
      .prepare("UPDATE shares SET expires=? WHERE id=?")
      .run(Date.now() - 1, share.id);
    expect((await client.get("/api/client/project")).status).toBe(401);
    expect(
      (
        await request(app.http)
          .post("/api/client/exchange")
          .set("Origin", "http://localhost")
          .send({ token: share.token })
      ).status,
    ).toBe(401);
  } finally {
    app.db.close();
  }
});
