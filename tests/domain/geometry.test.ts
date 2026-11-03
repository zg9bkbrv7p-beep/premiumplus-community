import { expect, test } from "vitest";
import {
  validatePlan,
  snap,
  wallSegments,
  removeWall,
  History,
  defaultPlan,
} from "../../shared/geometry";
test("grid and history preserve exact edits", () => {
  expect(snap(1.23)).toBe(1.2);
  const h = new History(1);
  h.commit(2);
  h.commit(3);
  expect(h.undo()).toBe(2);
  expect(h.undo()).toBe(1);
  expect(h.redo()).toBe(2);
  h.commit(4);
  expect(h.redo()).toBe(4);
});
test("wall openings create matching 3D solid dimensions", () => {
  const p = defaultPlan();
  p.openings = [
    {
      id: "door",
      wallId: "w1",
      kind: "door",
      offset: 1,
      width: 1,
      height: 2.1,
      sill: 0,
    },
  ];
  expect(validatePlan(p)).toEqual(p);
  const solids = wallSegments(p, "w1");
  const volume = solids.reduce((sum, s) => sum + s.width * s.height * 0.15, 0);
  expect(volume).toBeCloseTo((8 * 2.8 - 2.1) * 0.15);
  expect(removeWall(p, "w1").openings).toHaveLength(0);
});
test("invalid, intersecting, and oversized geometry is rejected", () => {
  const p = defaultPlan();
  p.walls[0].a.x = Infinity;
  expect(() => validatePlan(p)).toThrow();
  p.walls[0].a.x = 0;
  p.openings = [
    {
      id: "a",
      wallId: "w1",
      kind: "window",
      offset: 1,
      width: 2,
      height: 1,
      sill: 1,
    },
    {
      id: "b",
      wallId: "w1",
      kind: "door",
      offset: 2,
      width: 1,
      height: 2,
      sill: 0,
    },
  ];
  expect(() => validatePlan(p)).toThrow();
  p.openings[1].offset = 100;
  expect(() => validatePlan(p)).toThrow();
});
