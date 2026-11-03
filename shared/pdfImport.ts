import { validateProposal, type ProposalData } from "./proposal";
export const sectionNames = {
  scope: "Scope of work",
  schedule: "Schedule",
  payments: "Payment terms and deposits",
  warranty: "Warranty",
  exclusions: "Exclusions",
} as const;
export type SectionKey = keyof typeof sectionNames;
export type PdfReview = {
  sections: Record<SectionKey, string>;
  items: { label: string; quantity: string; price: string }[];
  reference: string;
  raw: string;
  warnings: string[];
};
export const chargeSummary =
  /\b(deposit|payment|installment|instalment|balance|subtotal|sub-total|total|tax|discount|due|paid|retainage|retainer|retention|draw|invoice|milestone)\b|%/i;
const canonical = (v: string) =>
  v
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function parsePdfText(raw: string): PdfReview {
  const r: PdfReview = {
    sections: {
      scope: "",
      schedule: "",
      payments: "",
      warranty: "",
      exclusions: "",
    },
    items: [],
    reference: "",
    raw,
    warnings: [
      "Review every extracted section against the PDF. Layouts and headings vary. Missing or ambiguous quantities/prices require manual correction.",
    ],
  };
  let section: SectionKey | "items" | undefined;
  let columns:
    | { label: number; quantity: number; price: number; count: number }
    | undefined;
  const amount = (value: string) =>
    value
      .replace(/^\$/, "")
      .replace(
        /^(\d{1,3}(?:,\d{3})+)(\.\d{1,2})?$/,
        (_, a, b) => a.replace(/,/g, "") + (b || ""),
      );
  for (const original of raw.split(/\r?\n/)) {
    const line = original.trim();
    if (!line) continue;
    if (/^(customer|client|owner|property address|address)\s*:/i.test(line)) {
      r.reference += (r.reference ? "\n" : "") + line;
      continue;
    }
    const heading = line.match(
      /^(scope(?: of work)?|materials(?: and priced work)?|priced work|line items|items|schedule|timeline|payment terms(?: and deposits)?|payments|deposits|warranty|exclusions)\s*(?::\s*(.*))?$/i,
    );
    if (heading) {
      columns = undefined;
      const h = heading[1].toLowerCase();
      section = h.startsWith("scope")
        ? "scope"
        : /^(materials|priced|line|items)/.test(h)
          ? "items"
          : /^(schedule|timeline)/.test(h)
            ? "schedule"
            : /^(payment|deposit)/.test(h)
              ? "payments"
              : h === "warranty"
                ? "warranty"
                : "exclusions";
      if (!heading[2]) continue;
    }
    const value = heading?.[2] || line;
    if (section === "items") {
      const cells = value.split(/\s*\|\s*|\s{2,}/).map((v) => v.trim());
      const labelColumn = cells.findIndex((v) =>
        /^(description|item|material|work)$/i.test(v),
      );
      const quantityColumn = cells.findIndex((v) =>
        /^(qty|quantity)$/i.test(v),
      );
      const priceColumn = cells.findIndex((v) =>
        /^(unit price|unit cost|unit rate)$/i.test(v),
      );
      if (labelColumn >= 0 && quantityColumn >= 0 && priceColumn >= 0) {
        columns = {
          label: labelColumn,
          quantity: quantityColumn,
          price: priceColumn,
          count: cells.length,
        };
        continue;
      }

      if (
        chargeSummary.test(value) ||
        /^[-_=\s]+$/.test(value) ||
        /^(description|item)\s*\|?\s*(qty|quantity)/i.test(value)
      ) {
        r.warnings.push(`Not imported as a charge: ${value.slice(0, 180)}`);
        continue;
      }
      const match = value.match(
        /^(.+?)\s*\|\s*(?:qty|quantity)\s*:\s*(\S+)\s*\|\s*(?:unit price|unit cost|price)\s*:\s*\$?([\d,.]+)\s*$/i,
      );
      if (columns && cells.length === columns.count) {
        r.items.push({
          label: cells[columns.label],
          quantity: cells[columns.quantity],
          price: amount(cells[columns.price]),
        });
        continue;
      }
      r.items.push(
        match
          ? {
              label: match[1].trim(),
              quantity: match[2],
              price: match[3].replace(
                /^(\d{1,3}(?:,\d{3})+)(\.\d{1,2})?$/,
                (_, a, b) => a.replace(/,/g, "") + (b || ""),
              ),
            }
          : { label: value.slice(0, 200), quantity: "", price: "" },
      );
    } else if (section) {
      r.sections[section] += (r.sections[section] ? "\n" : "") + value;
    }
  }
  if (!Object.values(r.sections).some(Boolean) && !r.items.length)
    r.warnings.push(
      "No recognized sections. Use the extracted source below to enter sections manually; nothing will be inferred.",
    );
  if (r.items.length > 100)
    r.warnings.push(
      "Only the first 100 candidate work rows are shown. Split the PDF before importing additional work.",
    );
  r.items = r.items.slice(0, 100);
  return r;
}
export function applyPdfImport(
  current: ProposalData,
  review: PdfReview,
  selection: { sections: SectionKey[]; items: number[] },
): ProposalData {
  const next: ProposalData = structuredClone(current);
  const append = (existing: string, text: string) =>
    !text.trim() || canonical(existing).includes(canonical(text))
      ? existing
      : (existing ? existing + "\n\n" : "") + text.trim();
  for (const key of new Set(selection.sections)) {
    if (!(key in sectionNames)) throw Error("Unknown PDF section");
    const value = review.sections[key];
    if (key === "scope" || key === "schedule")
      next[key] = append(next[key], value);
    else if (value.trim())
      next.terms = append(next.terms, sectionNames[key] + ":\n" + value.trim());
  }
  for (const i of new Set(selection.items)) {
    const item = review.items[i];
    if (!item) throw Error("Unknown imported item");
    if (chargeSummary.test(item.label))
      throw Error(
        "Payments, balances and totals cannot be added as work items",
      );
    if (
      !/^\d+$/.test(item.quantity) ||
      Number(item.quantity) <= 0 ||
      !Number.isSafeInteger(Number(item.quantity))
    )
      throw Error(
        "Enter an explicit positive whole-number quantity for every selected item",
      );
    if (!/^\d+(\.\d{1,2})?$/.test(item.price))
      throw Error(
        "Enter an explicit unit price in dollars with at most two decimals",
      );
    const quantity = Number(item.quantity),
      price = Math.round(Number(item.price) * 100);
    const existing = [...next.items, ...next.options].filter(
      (v) => canonical(v.label) === canonical(item.label),
    );
    if (existing.length) {
      if (existing.some((v) => v.quantity !== quantity || v.price !== price))
        throw Error(
          `Duplicate description with different pricing: ${item.label}. Review it manually in the existing proposal.`,
        );
      continue;
    }
    next.items.push({
      id: crypto.randomUUID(),
      label: item.label.trim(),
      quantity,
      price,
    });
  }
  return validateProposal(next);
}
