import { test, expect } from "@playwright/test";
test("contractor uses plans, shares, client accepts without 3D; persistence and revocation", async ({
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
    page.getByRole("heading", { name: "Dashboard" }),
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
  await page.locator(".project-tabs").getByRole("button", {name:"Photo Preview",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Start with your property.",exact:true})).toBeVisible();
  await expect(page.locator(".scene-host canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Proposal", exact: true }).click();
  await page
    .getByRole("button", { name: "Create proposal", exact: true })
    .click();
  await expect(page.getByLabel("Proposal title")).toBeVisible();
  await page
    .getByLabel("Scope of work")
    .fill("A beautiful new living space with carefully selected finishes.");
  await page.getByLabel("Homeowner name",{exact:true}).fill("Taylor Homeowner");
  await page.getByLabel("Homeowner email or phone",{exact:true}).fill("taylor@example.test");
  await page.getByRole("checkbox",{name:"I checked the quantities and pricing for this project.",exact:true}).check();
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
  await expect(cp.getByRole("button",{name:/Explore in 3D|Design studio/})).toHaveCount(0);
  await expect(cp.locator(".scene-host canvas")).toHaveCount(0);
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
  await page.locator(".project-tabs").getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator('.project-detail-list').getByText('Taylor Homeowner',{exact:true})).toBeVisible();
  await expect(page.locator('.scope-snapshot').getByText('A beautiful new living space with carefully selected finishes.',{exact:true})).toBeVisible();
  await expect(page.locator('.scope-snapshot').getByText('Premium finish package',{exact:true})).toBeVisible();
  await page.locator('.project-tabs').getByRole('button',{name:'Documents',exact:true}).click();
  await expect(page.getByText('Signed Contract v1',{exact:true})).toBeVisible();
  await page.locator('.project-tabs').getByRole('button',{name:'Overview',exact:true}).click();
  await page.getByRole("button", { name: "View history", exact: true }).click();
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
test("mobile workspace and Plan Lab fit viewport", async ({ page }) => {
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
    .getByRole("button", { name: "Photo Preview", exact: true })
    .click();
  await expect(page.getByRole("heading",{name:"Start with your property.",exact:true})).toBeVisible();
  await expect(page.locator(".plan-lab canvas")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "artifacts/mobile-planlab.png",
    fullPage: true,
  });
});
test("unsaved proposal edits warn before leaving the project tab", async ({page})=>{
  const reg=await page.request.post('/api/auth/register',{headers:{Origin:'http://localhost:3100'},data:{name:'Draft QA',company:'Draft QA',email:`draft-${Date.now()}@example.test`,password:'fictional-password-2026'}});
  expect(reg.ok()).toBeTruthy();const auth=await reg.json();
  const created=await page.request.post('/api/projects',{headers:{Origin:'http://localhost:3100','X-CSRF-Token':auth.csrf},data:{name:'Draft House'}});
  expect(created.ok()).toBeTruthy();const p=await created.json();
  await page.goto(`/?project=${p.id}&tab=proposal`);
  await page.getByRole('button',{name:'Create proposal',exact:true}).click();
  await page.getByLabel('Scope of work').fill('Keep this unsaved proposal scope');
  let prompted=false;page.on('dialog',async dialog=>{prompted=true;await dialog.dismiss();});
  await page.locator('.project-tabs').getByRole('button',{name:'Photo Preview',exact:true}).click();
  expect(prompted).toBe(true);
  await expect(page.getByLabel('Scope of work')).toHaveValue('Keep this unsaved proposal scope');
});
