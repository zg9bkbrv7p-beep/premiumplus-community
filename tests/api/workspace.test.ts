import { beforeEach, afterEach, expect, test } from "vitest";
import request from "supertest";
import { createApp } from "../../server/app";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
let dir: string, app: ReturnType<typeof createApp>;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "vision-test-"));
  app = createApp(join(dir, "test.sqlite"));
});
afterEach(() => {
  app.db.close();
  rmSync(dir, { recursive: true, force: true });
});
async function register(email = "owner@example.test") {
  const agent = request.agent(app.http);
  const r = await agent
    .post("/api/auth/register")
    .set("Origin", "http://localhost")
    .send({
      name: "Alex Rivera",
      company: "Studio North",
      email,
      password: "fictional-password-2026",
    });
  expect(r.status).toBe(201);
  return { agent, csrf: r.body.csrf };
}
test("persistent projects have company isolation and optimistic revision checks", async () => {
  expect((await request(app.http).get("/api/projects")).status).toBe(401);
  const { agent, csrf } = await register();
  const p = await agent
    .post("/api/projects")
    .set("Origin", "http://localhost")
    .set("X-CSRF-Token", csrf)
    .send({
      name: "The Willow House",
      address: "Fictional site",
      description: "A calm family home",
    });
  expect(p.status).toBe(201);
  expect(p.body.revision).toBe(1);
  const other = await register("other@example.test");
  expect((await other.agent.get("/api/projects/" + p.body.id)).status).toBe(
    404,
  );
  expect(
    (
      await agent
        .patch("/api/projects/" + p.body.id)
        .set("Origin", "http://localhost")
        .set("X-CSRF-Token", csrf)
        .send({ revision: 0, name: "Overwrite" })
    ).status,
  ).toBe(409);
  expect(
    (
      await agent
        .patch("/api/projects/" + p.body.id)
        .set("Origin", "http://localhost")
        .send({ revision: 1, name: "No csrf" })
    ).status,
  ).toBe(403);
  app.db.close();
  app = createApp(join(dir, "test.sqlite"));
  const login = await request
    .agent(app.http)
    .post("/api/auth/login")
    .set("Origin", "http://localhost")
    .send({ email: "owner@example.test", password: "fictional-password-2026" });
  expect(login.status).toBe(200);
  const row = app.db
    .prepare("SELECT password FROM users WHERE email=?")
    .get("owner@example.test") as any;
  expect(row.password).not.toContain("fictional-password");
  expect(
    (app.db.prepare("SELECT COUNT(*) AS n FROM projects").get() as any).n,
  ).toBe(1);
});
test("sessions reject hostile origins and bad credentials", async () => {
  const { agent, csrf } = await register();
  expect(
    (
      await agent
        .post("/api/projects")
        .set("Origin", "https://evil.test")
        .set("X-CSRF-Token", csrf)
        .send({ name: "No" })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app.http)
        .post("/api/auth/login")
        .set("Origin", "http://localhost")
        .send({ email: "owner@example.test", password: "bad" })
    ).status,
  ).toBe(401);
});
