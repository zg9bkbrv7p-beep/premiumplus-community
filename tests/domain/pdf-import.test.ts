import { test, expect } from "vitest";
import { parsePdfText, applyPdfImport } from "../../shared/pdfImport";
import { defaultProposal } from "../../shared/proposal";
test("sections preserve reference data and exclude payments, totals and ambiguous prices", () => {
  const r = parsePdfText(
    "Customer: Jane\nAddress: 10 Test Road\nScope of work\nReplace railing\nMaterials and priced work\nWood railing | Qty: 2 | Unit price: $125.50\nDeposit | Qty: 1 | Unit price: $500\nGrand total $251.00\nGlass panel $400\nSchedule\nTwo weeks\nPayment terms\n30% deposit; 15% final payment\nWarranty\nOne year\nExclusions\nPainting",
  );
  expect(r.sections.scope).toBe("Replace railing");
  expect(r.reference).toContain("Jane");
  expect(r.items).toHaveLength(2);
  expect(r.items[0]).toMatchObject({
    label: "Wood railing",
    quantity: "2",
    price: "125.50",
  });
  expect(r.items[1].quantity).toBe("");
  expect(r.sections.payments).toContain("30%");
});
test("selected imports append without changing existing numbers and repeated imports do not double count", () => {
  const p = defaultProposal("A");
  const r = parsePdfText(
    "Scope\nExtra work\nItems\nWood railing | Qty: 2 | Unit price: $125.50",
  );
  const selection = { sections: ["scope"] as const, items: [0] };
  const a = applyPdfImport(p, r, {
    sections: [...selection.sections],
    items: [0],
  });
  expect(a.items.slice(0, 2)).toEqual(p.items);
  expect(a.items[2].price).toBe(12550);
  expect(a.terms).toBe(p.terms);
  expect(applyPdfImport(a, r, { sections: ["scope"], items: [0] })).toEqual(a);
  expect(() =>
    applyPdfImport(p, parsePdfText("Items\nGlass $400"), {
      sections: [],
      items: [0],
    }),
  ).toThrow(/quantity/i);
});
test("ambiguous currency, fractional quantities, summaries and conflicting duplicates require correction", () => {
  const p = defaultProposal("Original");
  for (const row of [
    { label: "Wood", quantity: "1.5", price: "100" },
    { label: "Wood", quantity: "", price: "100" },
    { label: "Wood", quantity: "1", price: "12,34" },
    { label: "Final payment", quantity: "1", price: "100" },
    { label: "Design & project planning", quantity: "2", price: "10" },
  ]) {
    const review = parsePdfText("Items");
    review.items = [row];
    expect(() =>
      applyPdfImport(p, review, { sections: [], items: [0] }),
    ).toThrow();
    expect(p).toEqual(defaultProposal("Original"));
  }
});
test("terms are labeled and selected sections alone are applied; item aliases cannot duplicate an option", () => {
  const p = defaultProposal("Original");
  const r = parsePdfText(
    "Scope: Ignore\nSchedule: Six weeks\nPayment terms: 30% / 30% / 25% / 15%\nWarranty: One year\nExclusions: Painting",
  );
  const next = applyPdfImport(p, r, {
    sections: ["schedule", "payments", "warranty"],
    items: [],
  });
  expect(next.scope).toBe(p.scope);
  expect(next.items).toEqual(p.items);
  expect(next.terms).toContain("Payment terms and deposits:\n30%");
  expect(next.terms).toContain("Warranty:\nOne year");
  expect(next.terms).not.toContain("Painting");
  const duplicate = parsePdfText(
    "Items\nPremium finish package | Qty: 1 | Unit price: $2250",
  );
  expect(
    applyPdfImport(p, duplicate, { sections: [], items: [0] }).items,
  ).toEqual(p.items);
});
test("explicit table columns map quantities and unit prices while percentages never become charges", () => {
  const r = parsePdfText(
    "Materials\nDescription    Qty    Unit price    Amount\n2x4 lumber    6    $12.50    $75.00\nFirst draw    1    $500.00    $500.00\n30% upon signing    1    $750    $750",
  );
  expect(r.items).toEqual([
    { label: "2x4 lumber", quantity: "6", price: "12.50" },
  ]);
  expect(
    applyPdfImport(defaultProposal("A"), r, {
      sections: [],
      items: [0],
    }).items.at(-1)?.quantity,
  ).toBe(6);
});
