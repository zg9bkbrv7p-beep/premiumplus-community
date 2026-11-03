/** Distances are only estimates tied to an explicitly supplied reference. */
export type Point = { x: number; y: number };
export type Calibration = { first: Point; second: Point; referenceFeet: number; feetPerPixel: number };
export function pixelDistance(a: Point,b: Point): number {
  return Math.hypot(a.x-b.x,a.y-b.y);
}
export function calibrate(first:Point, second:Point, referenceFeet:number):Calibration {
  const pixels=pixelDistance(first,second);
  if(!Number.isFinite(referenceFeet)||referenceFeet<=0 || referenceFeet>100000) throw new Error('Enter a real, positive distance in feet.');
  if(!Number.isFinite(pixels)||pixels<5) throw new Error('Place reference points farther apart.');
  return {first, second, referenceFeet, feetPerPixel:referenceFeet/pixels};
}
export function measure(first:Point,second:Point,scale:Calibration):number {
  if(!scale || !(scale.feetPerPixel>0)) throw new Error('Calibrate the plan first.');
  return pixelDistance(first,second)*scale.feetPerPixel;
}
export function asProjectExport(input: {projectId:string;projectName:string;address:string;planName:string;calibration:Calibration|null;measurements:{first:Point;second:Point;feet:number}[]} ) {
  return {
    schema:'premiumplus.plan-lab.v1',
    origin:{existingProjectId:input.projectId,projectName:input.projectName,referenceAddress:input.address,permanentStartingRecord:true},
    plot:{name:input.planName,calibration:input.calibration,measurements:input.measurements,units:'feet',accuracy:'approximate — verify with an independent known distance'},
    scope:'contractor-working-copy',
    warnings:['Measurements are reference-scaled 2D estimates, not surveyed dimensions.','No accepted contracts or homeowner decisions were modified.','This JSON export does not save to the application database.'],
  };
}
