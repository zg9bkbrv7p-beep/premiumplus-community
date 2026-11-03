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
    data: { name: "Riverside renovation" },
  });
  return { project: await p.json(), csrf };
}
test("retired demo URL and dashboard lead to Photo Preview without changing projects",async({page})=>{
  const {project}=await setup(page);
  await page.goto('/?demo=3d');
  await expect(page.getByRole('button',{name:'Explore 3D Demo',exact:true})).toHaveCount(0);
  await expect(page.getByText('Interactive 3D sample',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();
  await expect(page.locator('.dashboard-hero')).toHaveCount(0);
  await page.locator('.contractor-project-row').filter({hasText:'Riverside renovation'}).click();
  await expect(page.getByRole('heading',{name:'Project Details',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Open Photo Preview',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Start with your property.',exact:true})).toBeVisible();
  await expect(page.locator('.scene-host canvas')).toHaveCount(0);
  const saved=await (await page.request.get('/api/projects/'+project.id)).json();
  expect(saved.plan).toEqual(project.plan);
  expect(await (await page.request.get('/api/projects')).json()).toHaveLength(1);
});
test("iPhone viewport can upload, touch-mark, save and reopen a real source without fake generation", async ({
  page,
}) => {
  const { project } = await setup(page);
  await page.goto(`/?project=${project.id}&tab=remodel`);
  await expect(
    page.getByRole("heading", {
      name: "Start with your property.",
    }),
  ).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:"artifacts/iphone-photo-preview.png",fullPage:true});
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
    page.getByText("Photo saved privately to this project.", {
      exact: false,
    }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Glass railing", exact: true }).click();
  const description=await page.getByLabel("Describe your changes").inputValue();
  await page.getByRole("button", { name: "Save & review", exact: true }).click();
  await expect(page.getByText("No image service is connected.", {exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Generate concept",exact:true})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Export homeowner PDF",exact:true})).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: /property.png/ }).click();
  await page.getByRole("button",{name:"3 Changes",exact:true}).click();
  await expect(page.getByLabel("Describe your changes")).toHaveValue(description);
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
