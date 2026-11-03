import { describe, it, expect } from 'vitest';
import { formatImperial, parseImperial, snapToGrid } from '../../shared/units';
describe('imperial units', () => {
 it('parses feet and inches into exact meters', () => { expect(parseImperial(`5' 6"`)).toBeCloseTo(1.6764, 10); expect(parseImperial('-2 ft 3 in')).toBeCloseTo(-.6858, 10); expect(parseImperial('bad')).toBeNull(); });
 it('formats dimensions and offers inch grids', () => { expect(formatImperial(1.6764)).toBe(`5′ 6″`); expect(snapToGrid(.1, 'inch')).toBeCloseTo(.1016); expect(snapToGrid(.2, 'six-inch')).toBeCloseTo(.1524); expect(snapToGrid(.27, 'off')).toBe(.27); });
});
