import { test, expect } from "@playwright/test";
test("contractor designs, shares, client selects and accepts; persistence and revocation", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Alex Rivera");
  await page.getByLabel("Studio / company").fill("North Studio");
  await page.getByLabel("Email address").fill(`alex${stamp}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-2026");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Your next great space." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page.getByLabel("Project name").fill("The Willow House");
  await page
    .getByLabel("Site address")
    .fill("48 Willow Lane · fictional project");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "The Willow House", exact: true }),
  ).toBeVisible();
  await page
    .locator("#main")
    .getByRole("button", { name: "Design studio", exact: true })
    .click();
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  await page.getByRole("button", { name: "Add sofa", exact: true }).click();
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .locator("#main")
    .getByRole("button", { name: "Design studio", exact: true })
    .click();
  await expect(page.getByTestId("furniture")).toHaveCount(1);
  await page.getByRole("button", { name: "3D view", exact: true }).click();
  await expect(page.locator(".scene-host canvas")).toBeVisible();
  await page
    .getByRole("button", { name: "Capture for proposal", exact: true })
    .click();
  await expect(
    page.getByText("Image saved to project", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Proposal", exact: true }).click();
  await page
    .getByRole("button", { name: "Create proposal", exact: true })
    .click();
  await expect(page.getByLabel("Proposal title")).toBeVisible();
  await page
    .getByLabel("Scope of work")
    .fill("A beautiful new living space with carefully selected finishes.");
  await page
    .getByRole("button", { name: "Save proposal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Share with client", exact: true })
    .click();
  const url = await page.getByLabel("Private client link").inputValue();
  expect(url).toContain("#share=");
  const client = await browser.newContext();
  const cp = await client.newPage();
  await cp.goto(url);
  await expect(
    cp.getByRole("heading", { name: "The Willow House", exact: true }).first(),
  ).toBeVisible();
  expect(cp.url()).not.toContain("share=");
  await cp.getByLabel("Premium finish package").check();
  await cp.getByLabel("Your full name").fill("Taylor Homeowner");
  await cp
    .getByLabel(
      "I have reviewed this proposal and agree to the selected scope, price, and terms.",
    )
    .check();
  await cp
    .getByRole("button", { name: "Accept proposal", exact: true })
    .click();
  await expect(
    cp.getByText("A great beginning.", { exact: true }),
  ).toBeVisible();
  await cp.reload();
  await expect(
    cp.getByText("A great beginning.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(
    page.getByText("Proposal accepted by Taylor Homeowner"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revoke link", exact: true })
    .first()
    .click();
  await cp.reload();
  await expect(
    cp.getByText("This link is expired or has been revoked", { exact: true }),
  ).toBeVisible();
  await client.close();
});
test("mobile workspace and design fit viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Mobile User");
  await page.getByLabel("Studio / company").fill("Mobile Studio");
  await page
    .getByLabel("Email address")
    .fill(`mobile${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-2026");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page.getByLabel("Project name").fill("Mobile House");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .locator("#main")
    .getByRole("button", { name: "Design studio", exact: true })
    .click();
  await expect(page.getByTestId("plan-canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/mobile-design.png",
    fullPage: true,
  });
});
test("drawing, openings, undo, retained failed saves and keyboard inspection", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Editor User");
  await page.getByLabel("Studio / company").fill("Editor Studio");
  await page
    .getByLabel("Email address")
    .fill(`editor${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-2026");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page.getByLabel("Project name").fill("Editor House");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .locator("#main")
    .getByRole("button", { name: "Design studio", exact: true })
    .click();
  const xy = async (x: number, y: number) =>
    page.getByTestId("plan-canvas").evaluate(
      (el, pt) => {
        const p = new DOMPoint(pt.x, pt.y).matrixTransform(
          (el as SVGSVGElement).getScreenCTM()!,
        );
        return { x: p.x, y: p.y };
      },
      { x, y },
    );
  await page.getByRole("button", { name: "Draw wall", exact: true }).click();
  await page.getByTestId("plan-canvas").scrollIntoViewIfNeeded();
  let a = await xy(4, 0),
    b = await xy(4, 6);
  await page.mouse.click(a.x, a.y);
  await page.mouse.click(b.x, b.y);
  await expect(page.getByLabel("Wall height", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add door", exact: true }).click();
  await page.getByTestId("plan-canvas").scrollIntoViewIfNeeded();
  a = await xy(4, 3);
  await page.mouse.click(a.x, a.y);
  await expect(page.getByLabel("Opening width")).toBeVisible();
  await page.getByRole("button", { name: "Add sofa", exact: true }).click();
  await expect(page.getByTestId("furniture")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("furniture")).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.getByTestId("furniture")).toHaveCount(1);
  await page.route("**/api/projects/*", async (route) => {
    if (route.request().method() === "PATCH")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Save temporarily unavailable" }),
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Save temporarily unavailable",
  );
  await expect(page.getByTestId("furniture")).toHaveCount(1);
  await page.unroute("**/api/projects/*");
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("furniture")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Select & move", exact: true })
    .click();
  await page.getByTestId("plan-canvas").scrollIntoViewIfNeeded();
  a = await xy(4, 3);
  b = await xy(5, 4);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByLabel("Position X", { exact: true })).toHaveValue("5");
  await expect(page.getByLabel("Position Y", { exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: "Save design", exact: true }).click();
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
});
test("unsaved design edits warn before leaving the project tab", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Draft User");
  await page.getByLabel("Studio / company").fill("Draft Studio");
  await page
    .getByLabel("Email address")
    .fill(`draft${Date.now()}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("fictional-password-2026");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await page
    .getByRole("button", { name: "New project", exact: true })
    .first()
    .click();
  await page.getByLabel("Project name").fill("Draft House");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page
    .locator("#main")
    .getByRole("button", { name: "Design studio", exact: true })
    .click();
  await page.getByRole("button", { name: "Add sofa", exact: true }).click();
  let prompted = false;
  page.on("dialog", async (dialog) => {
    prompted = true;
    await dialog.dismiss();
  });
  await page
    .locator("#main")
    .getByRole("button", { name: "Proposal", exact: true })
    .click();
  expect(prompted).toBe(true);
  await expect(page.getByTestId("furniture")).toHaveCount(1);
});
