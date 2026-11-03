import { expect, test } from "vitest";
import { money } from "../../src/api";
test("client pricing displays the exact cents charged in the agreement", () => {
  expect(money(12345)).toBe("$123.45");
  expect(money(100)).toBe("$1.00");
  expect(money(0)).toBe("$0.00");
});
