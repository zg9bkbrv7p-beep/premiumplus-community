/** Original PREMIUM+ wall tools inspired by common CAD interaction patterns.
 * Sketches and canvas image distances are approximate until independently checked.
 */
import type { Plan, Wall } from './geometry';

const FEET_TO_METERS = 0.3048;
const INCHES_TO_METERS = 0.0254;
export type WallDraft = {
  lengthFeet: number;
  heightFeet: number;
  thicknessInches: number;
  color: string;
};
/** Returns a new plan; never mutates proposal/contract snapshots or saves automatically. */
export function appendDimensionedWall(plan: Plan, draft: WallDraft, id: string): Plan {
  const { lengthFeet, heightFeet, thicknessInches, color } = draft;
  if (![lengthFeet, heightFeet, thicknessInches].every(Number.isFinite)) throw Error('Enter valid wall dimensions.');
  const meters = lengthFeet * FEET_TO_METERS;
  const height = heightFeet * FEET_TO_METERS;
  const thickness = thicknessInches * INCHES_TO_METERS;
  if (meters < 0.2 || meters > 100 || height <= 0 || height > 10 || thickness <= 0 || thickness > 1)
    throw Error('Wall dimensions exceed the supported design limits.');
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw Error('Choose a valid wall color.');
  if (!id || [...plan.walls, ...plan.openings, ...plan.furniture].some(v => v.id === id))
    throw Error('The wall must have a unique identifier.');
  // Put the new draft below existing geometry. Exact length is preserved;
  // it stays detached until the contractor aligns it in the editor.
  const minY = plan.walls.length ? Math.min(...plan.walls.flatMap(w => [w.a.y, w.b.y])) : 0;
  const maxY = plan.walls.length ? Math.max(...plan.walls.flatMap(w => [w.a.y, w.b.y])) : 0;
  const y = minY >= -98 ? minY - 1 : maxY + 1;
  if (y < -100 || y > 100) throw Error('No room to place a new wall in this drawing.');
  const x = 4 - meters / 2;
  const wall: Wall = {
    id, a: {x, y}, b: {x: x + meters, y},
    height, thickness, color,
  };
  return { ...plan, walls: [...plan.walls, wall] };
}
