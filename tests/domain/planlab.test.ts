import {describe,it,expect} from 'vitest';
import {calibrate,measure,asProjectExport} from '../../src/planlab/measure';
describe('PDF and 2D Plan Tools',()=>{
 it('calibrates a known 40-foot line across 400 image pixels',()=>{const c=calibrate({x:200,y:172},{x:600,y:172},40);expect(c.feetPerPixel).toBeCloseTo(.1);expect(measure({x:10,y:10},{x:110,y:10},c)).toBeCloseTo(10);});
 it('rejects absent, invalid and zero-length calibration',()=>{expect(()=>calibrate({x:1,y:1},{x:1,y:1},40)).toThrow();expect(()=>calibrate({x:1,y:1},{x:10,y:1},0)).toThrow();expect(()=>calibrate({x:1,y:1},{x:10,y:1},Number.NaN)).toThrow();});
 it('cannot measure before calibration',()=>{expect(()=>measure({x:0,y:0},{x:10,y:10},null as never)).toThrow();});
 it('exports with existing project origin and no contract mutation',()=>{const doc=asProjectExport({projectId:'existing-p',projectName:'Fictional fence',address:'Fictional address',planName:'plan.png',calibration:null,measurements:[]});expect(doc.origin.existingProjectId).toBe('existing-p');expect(doc.warnings.join(' ')).toMatch(/were modified/);expect(doc.plot.units).toBe('feet');});
});
