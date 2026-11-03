import { test, expect } from "@playwright/test";
import sharp from "sharp";
test("synthetic integration fixture covers comparison, reopening, and selected PNG in existing proposal", async ({
  page,
}) => {
  const origin = "http://localhost:3101",
    headers = { Origin: origin };
  const reg = await page.request.post("/api/auth/register", {
    headers,
    data: {
      name: "Concept QA",
      company: "Concept QA",
      email: `concept-${Date.now()}@example.test`,
      password: "fictional-password-2026",
    },
  });
  expect(reg.ok()).toBeTruthy();
  const csrf = (await reg.json()).csrf;
  const post = async (path: string, data: any) => {
    const r = await page.request.post(path, {
      headers: { ...headers, "X-CSRF-Token": csrf },
      data,
    });
    expect(r.ok()).toBeTruthy();
    return r.json();
  };
  const p = await post("/api/projects", { name: "Photo concept fixture" });
  const { defaultProposal } = await import("../../shared/proposal");
  const proposal = await post(
    `/api/projects/${p.id}/proposals`,
    defaultProposal("Existing draft"),
  );
  await post(
    `/api/projects/${p.id}/proposals`,
    defaultProposal("Another draft"),
  );
  await page.goto(`/?project=${p.id}&tab=remodel`);
  const photo = await sharp({
    create: { width: 480, height: 320, channels: 3, background: "#31543a" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Upload property photo", { exact: true })
    .setInputFiles({
      name: "source.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await expect(
    page.getByText("Photo saved privately", { exact: false }),
  ).toBeVisible();
  await page.getByTestId("remodel-marker").scrollIntoViewIfNeeded();
  const box = await page.getByTestId("remodel-marker").boundingBox();
  for (const [x, y] of [
    [0.15, 0.15],
    [0.85, 0.15],
    [0.85, 0.85],
    [0.15, 0.85],
  ])
    await page.mouse.click(box!.x + box!.width * x, box!.y + box!.height * y);
  await page.getByRole("button",{name:"Continue",exact:true}).click();
  await page.getByLabel("Describe your changes").fill("Replace this marked fence with warm cedar boards; keep the gate position.");
  await page.getByRole("button",{name:"Save & review",exact:true}).click();
  await page.getByRole("checkbox",{name:"I approve sending this photo",exact:false}).check();
  await page.getByRole("button",{name:"Generate concept",exact:true}).click();
  await expect(
    page.getByLabel("Before and after comparison", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByLabel("Before and after comparison", { exact: true })
    .fill("75");
  await page.reload();
  await page.locator(".concept-library button").first().click();
  await expect(
    page.getByLabel("Before and after comparison", { exact: true }),
  ).toBeVisible();
  const download=page.waitForEvent("download");
  await page.getByRole("link",{name:"Export homeowner PDF",exact:true}).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  await page.locator(".photo-proposal-details summary").click();
  await page
    .getByLabel("Draft proposal", { exact: true })
    .selectOption(proposal.id);
  await page
    .getByRole("button", { name: "Use this concept in proposal", exact: true })
    .click();
  await expect(page.getByLabel("Proposal title")).toHaveValue(proposal.title);
  await expect(
    page.getByAltText("Proposal design image", { exact: true }),
  ).toBeVisible();
  const reopened = await (
    await page.request.get("/api/projects/" + p.id)
  ).json();
  expect(
    reopened.proposals.find((v: any) => v.id === proposal.id).designImage,
  ).toMatch(/^data:image\/png;base64,/);
  expect(reopened.plan).toEqual(p.plan);
  expect(reopened.proposals.find((v: any) => v.id === proposal.id).scope).toBe(
    proposal.scope,
  );
});
