/** Storage always uses meters; units affect presentation and input only. */
export type Grid = 'metric' | 'inch' | 'six-inch' | 'off';
export const INCH = .0254;
export function snapToGrid(value: number, grid: Grid): number {
 const step = grid === 'metric' ? .2 : grid === 'inch' ? INCH : grid === 'six-inch' ? 6 * INCH : 0;
 return step ? Math.round(value / step) * step : value;
}
export function formatImperial(meters: number): string {
 const inches = Math.round(Math.abs(meters) / INCH * 100) / 100;
 const feet = Math.floor(inches / 12);
 return `${meters < 0 ? '-' : ''}${feet}′ ${Number((inches - feet * 12).toFixed(2))}″`;
}
export function parseImperial(value: string): number | null {
 const text = value.trim().replace(/′/g,"'").replace(/″/g,'"');
 const pair = text.match(/^(-)?\s*(\d+(?:\.\d+)?)\s*(?:'|ft)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/i);
 if (pair) return (pair[1] ? -1 : 1) * (Number(pair[2]) * 12 + Number(pair[3] || 0)) * INCH;
 const inches = text.match(/^(-?\d+(?:\.\d+)?)\s*(?:"|in)$/i);
 return inches ? Number(inches[1]) * INCH : null;
}
