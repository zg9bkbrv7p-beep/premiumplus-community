import { expect, test } from "vitest";
import { calculateTotal, validateProposal } from "../../shared/proposal";
test("selected upgrades have exact integer totals", () => {
  expect(
    calculateTotal(
      [{ id: "a", label: "Build", quantity: 2, price: 12345 }],
      [{ id: "b", label: "Upgrade", quantity: 1, price: 500 }],
      ["b"],
    ),
  ).toBe(25190);
});
test("bad prices, quantities, overflow, and duplicated options are rejected", () => {
  for (const quantity of [0, -1, 1.5, Infinity])
    expect(() =>
      calculateTotal(
        [{ id: "a", label: "Build", quantity, price: 100 }],
        [],
        [],
      ),
    ).toThrow();
  expect(() =>
    calculateTotal(
      [
        {
          id: "a",
          label: "Build",
          quantity: 2,
          price: Number.MAX_SAFE_INTEGER,
        },
      ],
      [],
      [],
    ),
  ).toThrow();
  expect(() =>
    calculateTotal(
      [],
      [{ id: "b", label: "Up", quantity: 1, price: 1 }],
      ["b", "b"],
    ),
  ).toThrow();
  expect(() => calculateTotal([], [], ["unknown"])).toThrow();
  expect(() =>
    validateProposal({ currency: "USD", items: [], options: [] }),
  ).toThrow();
});
test("a published proposal cannot offer an overflowing combination of upgrades", () => {
  expect(() =>
    validateProposal({
      title: "Large",
      scope: "Scope",
      currency: "USD",
      items: [{ id: "base", label: "Base", quantity: 1, price: 1 }],
      options: Array.from({ length: 10 }, (_, i) => ({
        id: "up" + i,
        label: "Upgrade",
        quantity: 100000,
        price: 10000000000,
      })),
      schedule: "Soon",
      terms: "Terms",
      designImage: "",
    }),
  ).toThrow();
});
