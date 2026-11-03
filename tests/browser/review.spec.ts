async function completeForSharing(page:any){await page.getByLabel("Homeowner name",{exact:true}).fill("Test Homeowner");await page.getByLabel("Homeowner email or phone",{exact:true}).fill("homeowner@example.test");await page.getByLabel("Scope of work",{exact:true}).fill("Install 120 linear feet of cedar fencing and remove debris.");await page.getByRole("checkbox",{name:"I checked the quantities and pricing for this project.",exact:true}).check();}
import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Review User");
  await page.getByLabel("Studio / company").fill("Review Studio");
  await page
    .getByLabel("Email address")
    .fill(`review${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-2026");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page.getByLabel("Project name", { exact: true }).fill("Review House");
  await page.getByLabel("Site address").fill("100 Test Lane");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
}
test("proposal save preserves later edits and invalid preview stays in the editor", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Proposal", exact: true }).click();
  await page
    .getByRole("button", { name: "Create proposal", exact: true })
    .click();
  await page.getByLabel("Proposal title").fill("First version");
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  let reached!: () => void;
  const seen = new Promise<void>((r) => {
    reached = r;
  });
  await page.route("**/api/projects/*/proposals/*", async (route) => {
    if (route.request().method() === "PATCH") {
      reached();
      await held;
      await route.continue();
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Save proposal", exact: true })
    .click();
  await seen;
  await page.getByLabel("Proposal title").fill("Keep this newer title");
  release();
  await expect(
    page.getByRole("button", { name: "Save proposal", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Proposal title")).toHaveValue(
    "Keep this newer title",
  );
  await expect(
    page.getByText("New edits not saved", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/projects/*/proposals/*");
  await page.getByLabel("items quantity 1").fill("0");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Proposal title")).toBeVisible();
  await page.getByLabel("items quantity 1").fill("1");
  await page
    .getByRole("button", { name: "Save proposal", exact: true })
    .click();
  await expect(page.getByText("Proposal saved", { exact: true })).toBeVisible();
});
test("share does not publish an older draft when new edits arrive during saving", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Proposal", exact: true }).click();
  await page
    .getByRole("button", { name: "Create proposal", exact: true })
    .click();
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  let reached!: () => void;
  const seen = new Promise<void>((r) => {
    reached = r;
  });
  await page.route("**/api/projects/*/proposals/*", async (route) => {
    if (route.request().method() === "PATCH") {
      reached();
      await held;
      await route.continue();
    } else await route.continue();
  });
  await completeForSharing(page);
  await page
    .getByRole("button", { name: "Share with client", exact: true })
    .click();
  await seen;
  await page.getByLabel("Scope of work").fill("New scope during sharing");
  release();
  await expect(page.getByRole("alert")).toContainText("changed while saving");
  await expect(page.getByLabel("Private client link")).toHaveCount(0);
  await page.unroute("**/api/projects/*/proposals/*");
  await page
    .getByRole("button", { name: "Save proposal", exact: true })
    .click();
  await expect(page.getByText("Proposal saved", { exact: true })).toBeVisible();
});
test("proposal version changes require confirming dirty edits", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Proposal", exact: true }).click();
  await page
    .getByRole("button", { name: "Create proposal", exact: true })
    .click();
  await completeForSharing(page);
  await page
    .getByRole("button", { name: "Share with client", exact: true })
    .click();
  await page.getByLabel("Private client link").waitFor();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "New revision", exact: true }).click();
  await page.getByLabel("Proposal title").fill("Keep this unsaved title");
  const selector = page.getByLabel("Proposal version");
  const old = await selector.locator("option").last().getAttribute("value");
  let prompted = false;
  page.on("dialog", async (d) => {
    prompted = true;
    await d.dismiss();
  });
  await selector.selectOption(old!);
  expect(prompted).toBe(true);
  await expect(page.getByLabel("Proposal title")).toHaveValue(
    "Keep this unsaved title",
  );
});
test("project details can be corrected and persist after reload", async ({
  page,
}) => {
  await setup(page);
  await page
    .getByRole("button", { name: "Edit project details", exact: true })
    .click();
  await page.getByLabel("Project name", { exact: true }).fill("Corrected House");
  await page.getByLabel("Site address").fill("12 Correct Lane");
  await page
    .getByRole("button", { name: "Save project details", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Corrected House", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator(".project-detail-list").getByText("12 Correct Lane", { exact: true }),
  ).toBeVisible();
});
test("fresh client link initializes once in Vite StrictMode", async ({
  browser,
}) => {
  const { createApp } = await import("../../server/app");
  const { createServer } = await import("vite");
  const { default: request } = await import("supertest");
  const { defaultProposal } = await import("../proposal-fixture");
  const app = createApp(":memory:", "http://localhost:3193");
  const vite = await createServer({
    configFile: false,
    root: process.cwd(),
    server: { middlewareMode: true, hmr: false },
    appType: "spa",
  });
  app.http.use(vite.middlewares);
  const server = app.http.listen(3193, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  try {
    const a = request.agent(app.http);
    const reg = await a
      .post("/api/auth/register")
      .set("Origin", "http://localhost:3193")
      .send({
        name: "Dev",
        company: "Dev",
        email: "dev@example.test",
        password: "fictional-password-2026",
      });
    const c = reg.body.csrf;
    const post = (p: string, b: any) =>
      a
        .post(p)
        .set("Origin", "http://localhost:3193")
        .set("X-CSRF-Token", c)
        .send(b);
    const p = (await post("/api/projects", { name: "Development House",address:"100 Test Lane" })).body;
    const prop = (
      await post(`/api/projects/${p.id}/proposals`, defaultProposal("Dev"))
    ).body;
    const share = (
      await post(`/api/projects/${p.id}/shares`, { proposalId: prop.id })
    ).body;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route("**/api/client/exchange", async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.continue();
    });
    await page.goto("http://localhost:3193/client#share=" + share.token);
    await expect(
      page
        .getByRole("heading", { name: "Development House", exact: true })
        .first(),
    ).toBeVisible();
    await context.close();
  } finally {
    await vite.close();
    await new Promise<void>((r, e) =>
      server.close((err) => (err ? e(err) : r())),
    );
    app.db.close();
  }
});
