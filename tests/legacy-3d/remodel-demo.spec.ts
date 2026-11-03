import { test, expect } from "@playwright/test";
import sharp from "sharp";
test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
async function setup(page: any) {
  const r = await page.request.post("/api/auth/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Photo Review",
      company: "Photo QA",
      email: `photo-${Date.now()}@example.test`,
      password: "fictional-password-2026",
    },
  });
  expect(r.ok()).toBeTruthy();
  const { csrf } = await r.json();
  const p = await page.request.post("/api/projects", {
    headers: { Origin: "http://localhost:3100", "X-CSRF-Token": csrf },
    data: { name: "Customer first" },
  });
  return { project: await p.json(), csrf };
}
test("isolated demo edits real Three.js geometry, saves locally, and never changes customer projects", async ({
  page,
}) => {
  const { project } = await setup(page);
  await page.goto("/");
  const hero = page.locator(".dashboard-hero");
  await expect(
    hero.getByRole("button", { name: "Explore 3D Demo" }),
  ).toBeVisible();
  expect(
    await page
      .locator(".project-card")
      .first()
      .evaluate(
        (el) =>
          !!(
            el.compareDocumentPosition(
              document.querySelector(".demo-sample-card")!,
            ) & Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
  ).toBeTruthy();
  await hero.getByRole("button", { name: "Explore 3D Demo" }).click();
  await expect(page.locator(".scene-host canvas")).toBeVisible();
  await page.getByRole("button", { name: "2D plan", exact: true }).click();
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  const count = await page.getByTestId("furniture").count();
  await page.getByRole("button", { name: "Add chair", exact: true }).click();
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "2D plan", exact: true }).click();
  await expect(page.getByTestId("furniture")).toHaveCount(count + 1);
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await expect(page.locator(".scene-host canvas")).toBeVisible();
  const projects = await (await page.request.get("/api/projects")).json();
  expect(projects).toHaveLength(1);
  expect(projects[0].id).toBe(project.id);
  expect(projects[0].plan).toEqual(project.plan);
  await page
    .getByRole("button", { name: "Back to workspace", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your next great space." }),
  ).toBeVisible();
});
test("iPhone viewport can upload, touch-mark, save and reopen a real source without fake generation", async ({
  page,
}) => {
  const { project } = await setup(page);
  await page.goto(`/?project=${project.id}&tab=remodel`);
  await expect(
    page.getByRole("heading", {
      name: "Remodel the property in front of you.",
    }),
  ).toBeVisible();
  expect(
    await page
      .getByLabel("Take property photo", { exact: true })
      .getAttribute("capture"),
  ).toBe("environment");
  const image = await sharp({
    create: { width: 360, height: 240, channels: 3, background: "#3a5846" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Upload property photo", { exact: true })
    .setInputFiles({
      name: "property.png",
      mimeType: "image/png",
      buffer: image,
    });
  await expect(
    page.getByText("Photo saved privately to this customer project.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark area", exact: true }).click();
  const marker = page.getByTestId("remodel-marker");
  await marker.scrollIntoViewIfNeeded();
  const box = await marker.boundingBox();
  for (const [x, y] of [
    [0.2, 0.2],
    [0.8, 0.2],
    [0.8, 0.8],
    [0.2, 0.8],
  ])
    await page.touchscreen.tap(
      box!.x + box!.width * x,
      box!.y + box!.height * y,
    );
  await page
    .getByRole("button", { name: "Glass railing", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save marked area", exact: true })
    .click();
  await expect(
    page.getByText("Marked area saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /property.png/ }).click();
  await expect(
    page.getByRole("button", { name: "Glass railing", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("4 points", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Generate renovation concept",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(page.locator(".concept-library img")).toHaveCount(0);
  const p = await (
    await page.request.get("/api/projects/" + project.id)
  ).json();
  expect(p.image).toBe(project.image);
  expect(p.plan).toEqual(project.plan);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
