import { test, expect } from "vitest";
import { Box3, Vector3 } from "three";
import { buildFurniture } from "../../src/design/furniture";
test("all furniture geometry respects editable width, depth, and height", () => {
  for (const kind of ["sofa", "bed", "chair", "table", "plant"] as const) {
    const f = {
      id: kind,
      kind,
      x: 0,
      y: 0,
      rotation: 0,
      width: 2,
      depth: 1.4,
      height: 1.7,
      color: "#bca888",
    };
    const g = buildFurniture(f);
    const box = new Box3().setFromObject(g);
    const size = box.getSize(new Vector3());
    expect(size.x).toBeCloseTo(2);
    expect(size.y).toBeCloseTo(1.7);
    expect(size.z).toBeCloseTo(1.4);
    expect(box.min.y).toBeCloseTo(0);
  }
});
