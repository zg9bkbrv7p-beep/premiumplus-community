import { test, expect } from "@playwright/test";

test("new contractor opens Photo Preview without creating fake projects", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const registration = await page.request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "New Contractor",
      company: "First Studio",
      email: `first-${Date.now()}@example.test`,
      password: "fictional-password-2026",
    },
  });
  expect(registration.ok()).toBeTruthy();
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "New project", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Create Your First Project",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading",{name:"Dashboard",exact:true})).toBeVisible();
  await expect(page.locator(".demo-sample-card")).toHaveCount(0);
  await expect(page.locator(".dashboard-hero")).toHaveCount(0);
  expect(await (await page.request.get("/api/projects")).json()).toEqual([]);
  await page
    .getByRole("button", { name: "Create Your First Project", exact: true })
    .click();
  await page.getByLabel("Project name").fill("First real customer");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "First real customer", exact: true }),
  ).toBeVisible();
  const projects = await (await page.request.get("/api/projects")).json();
  expect(projects).toHaveLength(1);
  expect(projects[0].name).toBe("First real customer");
});
