import { z } from "zod";
const coord = z.number().finite().min(-100).max(100),
  dim = z.number().finite().positive().max(100);
const point = z.object({ x: coord, y: coord });
const wall = z.object({
  id: z.string().min(1),
  a: point,
  b: point,
  height: dim.max(10),
  thickness: dim.max(1),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
const opening = z.object({
  id: z.string().min(1),
  wallId: z.string(),
  kind: z.enum(["door", "window"]),
  offset: z.number().min(0),
  width: dim,
  height: dim,
  sill: z.number().min(0).max(10),
});
const furniture = z.object({
  id: z.string(),
  kind: z.enum(["sofa", "table", "bed", "plant", "chair", "cabinet", "refrigerator", "oven"]),
  x: coord,
  y: coord,
  rotation: z.number().finite(),
  width: dim,
  depth: dim,
  height: dim,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
});
const schema = z.object({
  version: z.literal(1),
  walls: z.array(wall).max(500),
  openings: z.array(opening).max(500),
  furniture: z.array(furniture).max(500),
  floorColor: z.string().regex(/^#[0-9a-f]{6}$/i),
});
export type Plan = z.infer<typeof schema>;
export type Wall = Plan["walls"][number];
export type Opening = Plan["openings"][number];
export type Furniture = Plan["furniture"][number];
export const length = (w: Wall) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
export function validatePlan(input: unknown): Plan {
  const p = schema.parse(input);
  const ids = [...p.walls, ...p.openings, ...p.furniture].map((x) => x.id);
  if (new Set(ids).size !== ids.length)
    throw Error("Every object needs a unique ID");
  for (const w of p.walls)
    if (length(w) < 0.2 || length(w) > 100)
      throw Error("Walls must be 0.2–100 m");
  for (const o of p.openings) {
    const w = p.walls.find((w) => w.id === o.wallId);
    if (
      !w ||
      o.offset + o.width > length(w) + 0.00001 ||
      o.sill + o.height > w.height + 0.00001
    )
      throw Error("Opening must fit inside its wall");
    if (
      p.openings.some(
        (b) =>
          b !== o &&
          b.wallId === o.wallId &&
          b.offset < o.offset + o.width &&
          b.offset + b.width > o.offset,
      )
    )
      throw Error("Openings cannot overlap");
  }
  return p;
}
export function snap(v: number) {
  return Math.round(v * 5) / 5;
}
export function removeWall(p: Plan, id: string): Plan {
  return {
    ...p,
    walls: p.walls.filter((w) => w.id !== id),
    openings: p.openings.filter((o) => o.wallId !== id),
  };
}
export type WallSolid = {
  offset: number;
  width: number;
  bottom: number;
  height: number;
};
export function wallSegments(p: Plan, id: string): WallSolid[] {
  const w = p.walls.find((w) => w.id === id)!;
  const result: WallSolid[] = [];
  let cursor = 0;
  for (const o of p.openings
    .filter((o) => o.wallId === id)
    .sort((a, b) => a.offset - b.offset)) {
    if (o.offset > cursor)
      result.push({
        offset: cursor,
        width: o.offset - cursor,
        bottom: 0,
        height: w.height,
      });
    if (o.sill > 0)
      result.push({
        offset: o.offset,
        width: o.width,
        bottom: 0,
        height: o.sill,
      });
    if (w.height > o.sill + o.height)
      result.push({
        offset: o.offset,
        width: o.width,
        bottom: o.sill + o.height,
        height: w.height - o.sill - o.height,
      });
    cursor = o.offset + o.width;
  }
  if (cursor < length(w))
    result.push({
      offset: cursor,
      width: length(w) - cursor,
      bottom: 0,
      height: w.height,
    });
  return result;
}
export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  constructor(public present: T) {}
  commit(value: T) {
    this.past.push(this.present);
    if (this.past.length > 100) this.past.shift();
    this.present = value;
    this.future = [];
    return value;
  }
  undo() {
    if (this.past.length) {
      this.future.push(this.present);
      this.present = this.past.pop()!;
    }
    return this.present;
  }
  redo() {
    if (this.future.length) {
      this.past.push(this.present);
      this.present = this.future.pop()!;
    }
    return this.present;
  }
}
export function defaultPlan(): Plan {
  return {
    version: 1,
    walls: [
      {
        id: "w1",
        a: { x: 0, y: 0 },
        b: { x: 8, y: 0 },
        height: 2.8,
        thickness: 0.15,
        color: "#e8e2d8",
      },
      {
        id: "w2",
        a: { x: 8, y: 0 },
        b: { x: 8, y: 6 },
        height: 2.8,
        thickness: 0.15,
        color: "#e8e2d8",
      },
      {
        id: "w3",
        a: { x: 8, y: 6 },
        b: { x: 0, y: 6 },
        height: 2.8,
        thickness: 0.15,
        color: "#e8e2d8",
      },
      {
        id: "w4",
        a: { x: 0, y: 6 },
        b: { x: 0, y: 0 },
        height: 2.8,
        thickness: 0.15,
        color: "#e8e2d8",
      },
    ],
    openings: [],
    furniture: [],
    floorColor: "#d7c5a8",
  };
}
