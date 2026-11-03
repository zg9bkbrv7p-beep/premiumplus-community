import { test, expect } from "@playwright/test";
import { textPdf } from "../pdf-fixture";
import { defaultProposal } from "../../shared/proposal";
const pdf = textPdf([
  "Customer: Fictional Owner",
  "Address: 10 Test Road",
  "Scope of work",
  "Replace existing railing",
  "Items",
  "Wood railing | Qty: 2 | Unit price: $125.50",
  "Glass panel $400",
  "Deposit | Qty: 1 | Unit price: $500",
  "Grand total $999",
  "Schedule",
  "Three weeks",
  "Payment terms",
  "30% / 30% / 25% / 15% after completion",
  "Warranty",
  "One year",
  "Exclusions",
  "Painting",
]);
test("PDF review preserves edits, requires selection and Save, reopens and avoids duplicate charges", async ({
  page,
  browserName,
}) => {
  await page.setViewportSize(
    browserName === "webkit"
      ? { width: 390, height: 844 }
      : { width: 1280, height: 900 },
  );
  const auth = await (
    await page.request.post("/api/auth/register", {
      headers: { Origin: "http://localhost:3100" },
      data: {
        name: "PDF Review",
        company: "PDF QA",
        email: `pdf-${Date.now()}@example.test`,
        password: "fictional-password-2026",
      },
    })
  ).json();
  const headers = {
    Origin: "http://localhost:3100",
    "X-CSRF-Token": auth.csrf,
  };
  const project = await (
    await page.request.post("/api/projects", {
      headers,
      data: { name: "Import customer" },
    })
  ).json();
  const original = defaultProposal("Original");
  const proposal = await (
    await page.request.post(`/api/projects/${project.id}/proposals`, {
      headers,
      data: original,
    })
  ).json();
  const current = async () => {
    const p = await (
      await page.request.get(`/api/projects/${project.id}`)
    ).json();
    return p.proposals.find((v: any) => v.id === proposal.id);
  };
  await page.goto(`/?project=${project.id}&tab=proposal`);
  await page
    .getByLabel("Proposal title", { exact: true })
    .fill("Pending title stays");
  const open = () =>
    page.getByRole("button", { name: "Import PDF", exact: true }).click();
  const upload = async () => {
    await open();
    await page
      .getByLabel("Choose proposal PDF", { exact: true })
      .setInputFiles({
        name: "source.pdf",
        mimeType: "application/pdf",
        buffer: pdf,
      });
    await expect(
      page.getByLabel("Extracted Scope of work", { exact: true }),
    ).toBeVisible();
  };
  await upload();
  await expect(
    page.getByRole("button", { name: "Apply selected sections", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Cancel import", exact: true })
    .click();
  expect((await current()).scope).toBe(original.scope);
  expect(
    (await (await page.request.get(`/api/projects/${project.id}/live`)).json())
      .files,
  ).toHaveLength(0);
  await upload();
  await page
    .getByLabel("Extracted Scope of work", { exact: true })
    .fill("Verified railing scope");
  await page.getByLabel("Apply Scope of work", { exact: true }).check();
  await page
    .getByLabel("Apply Payment terms and deposits", { exact: true })
    .check();
  await page.getByLabel("Apply imported item 1", { exact: true }).check();
  await page.getByLabel("Apply imported item 2", { exact: true }).check();
  await page
    .getByRole("button", { name: "Apply selected sections", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("quantity");
  expect(
    (await (await page.request.get(`/api/projects/${project.id}/live`)).json())
      .files,
  ).toHaveLength(0);
  await page
    .getByLabel("Imported label 2", { exact: true })
    .fill("Glass panel");
  await page.getByLabel("Imported quantity 2", { exact: true }).fill("3");
  await page.getByLabel("Imported price 2", { exact: true }).fill("40.00");
  await page
    .getByRole("button", { name: "Apply selected sections", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Proposal title", { exact: true })).toHaveValue(
    "Pending title stays",
  );
  expect((await current()).items).toEqual(original.items); // Apply never saves.
  await page
    .getByRole("button", { name: "Save proposal", exact: true })
    .click();
  await expect(page.getByText("Proposal saved", { exact: true })).toBeVisible();
  await page.reload();
  const saved = await current();
  expect(saved.items).toHaveLength(4);
  expect(saved.items.slice(0, 2)).toEqual(original.items);
  expect(saved.scope).toBe(original.scope + "\n\nVerified railing scope");
  expect(saved.schedule).toBe(original.schedule);
  expect(saved.terms).toContain("15% after completion");
  expect(saved.designImage).toBe(original.designImage);
  await upload();
  await page.getByLabel("Apply imported item 1", { exact: true }).check();
  await page
    .getByRole("button", { name: "Apply selected sections", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save proposal", exact: true })
    .click();
  await expect(page.getByText("Proposal saved", { exact: true })).toBeVisible();
  expect((await current()).items).toHaveLength(4);
  expect(
    (await (await page.request.get(`/api/projects/${project.id}/live`)).json())
      .files,
  ).toHaveLength(1);
  await open();
  await page
    .getByLabel("Choose proposal PDF", { exact: true })
    .setInputFiles({
      name: "scan.pdf",
      mimeType: "application/pdf",
      buffer: textPdf([]),
    });
  await expect(page.getByRole("alert")).toContainText("Scanned");
  await page
    .getByRole("button", { name: "Cancel import", exact: true })
    .click();
  expect((await current()).items).toHaveLength(4);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
