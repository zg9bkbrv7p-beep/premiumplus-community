import { test, expect } from "vitest";
import {
  regionSchema,
  insideRegion,
  remodelPrompt,
} from "../../shared/remodel";
const square = [
  { x: 0.1, y: 0.1 },
  { x: 0.8, y: 0.1 },
  { x: 0.8, y: 0.8 },
  { x: 0.1, y: 0.8 },
];
test("regions use normalized photo coordinates and reject degenerate or self-crossing marks", () => {
  expect(regionSchema.parse(square)).toEqual(square);
  expect(insideRegion(0.5, 0.5, square)).toBe(true);
  expect(insideRegion(0.95, 0.5, square)).toBe(false);
  for (const bad of [
    [],
    square.slice(0, 2),
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0.01, y: 0 },
      { x: 0, y: 0.01 },
    ],
    [...square, { x: 2, y: 0.5 }],
  ])
    expect(() => regionSchema.parse(bad)).toThrow();
  expect(remodelPrompt("glass")).toContain("actual property photograph");
  expect(remodelPrompt("glass")).toContain("glass");
});

test("custom change descriptions guide the actual-photo edit without a railing-only assumption",()=>{
  const prompt=remodelPrompt("wood","Paint the marked wall ivory and preserve the trim.");
  expect(prompt).toContain("Paint the marked wall ivory");
  expect(prompt).toContain("actual property photograph");
  expect(prompt).not.toContain("wood railing");
});
