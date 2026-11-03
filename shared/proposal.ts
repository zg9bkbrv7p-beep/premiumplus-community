import { z } from "zod";
const line = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(200),
  quantity: z.number().int().positive().max(100000),
  price: z.number().int().min(0).max(10000000000),
});
export type Line = z.infer<typeof line>;
const schema = z.object({
  title: z.string().trim().min(1).max(200),
  scope: z.string().max(20000),
  currency: z.literal("USD"),
  items: z.array(line).min(1).max(100),
  options: z.array(line).max(30),
  schedule: z.string().max(2000),
  terms: z.string().max(20000),
  customerName: z.string().trim().max(120).default(''),
  customerContact: z.string().trim().max(200).default(''),
  pricingReviewed: z.boolean().default(false),
  designImage: z
    .string()
    .max(2200000)
    .refine(
      (s) => s === "" || /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s),
      "Choose a captured PNG image",
    ),
});
export type ProposalData = z.infer<typeof schema>;
export function validateProposal(v: unknown): ProposalData {
  const p = schema.parse(v);
  const ids = [...p.items, ...p.options].map((x) => x.id);
  if (new Set(ids).size !== ids.length) throw Error("Line IDs must be unique");
  calculateTotal(
    p.items,
    p.options,
    p.options.map((o) => o.id),
  );
  return p;
}
export function calculateTotal(
  items: Line[],
  options: Line[],
  selected: string[],
): number {
  items.forEach((v) => line.parse(v));
  options.forEach((v) => line.parse(v));
  if (
    new Set(selected).size !== selected.length ||
    selected.some((id) => !options.some((o) => o.id === id))
  )
    throw Error("Invalid option selection");
  const n = [
    ...items,
    ...options.filter((o) => selected.includes(o.id)),
  ].reduce((s, o) => s + o.quantity * o.price, 0);
  if (!Number.isSafeInteger(n)) throw Error("Total is too large");
  return n;
}
export function defaultProposal(name: string): ProposalData {
  return {
    title: name + " · Project proposal",
    scope:
      "A considered approach to your next chapter. Describe the project scope, materials, and the work included in your proposal.",
    currency: "USD",
    items: [
      {
        id: "design",
        label: "Design & project planning",
        quantity: 1,
        price: 150000,
      },
      {
        id: "construction",
        label: "Construction & installation",
        quantity: 1,
        price: 1250000,
      },
    ],
    options: [
      {
        id: "finishes",
        label: "Premium finish package",
        quantity: 1,
        price: 225000,
      },
    ],
    schedule: "Estimated duration: 6–8 weeks from agreed start date.",
    terms:
      "This proposal includes only the work listed above. Any scope changes require a separate written agreement. Prices are in USD. No payment is collected through this preview.",
    designImage: "",
    customerName: '',
    customerContact: '',
    pricingReviewed: false,
  };
}
