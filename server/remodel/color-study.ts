import sharp from "sharp";
import { insideRegion, type Mark } from "../../shared/remodel";

/** A local finish-color simulation, not an AI-generated structural remodel. */
export const finishColors = {
  ivory: {name: "Warm ivory", hex: "#E3DDCA"},
  sage: {name: "Soft sage", hex: "#9CAB91"},
  forest: {name: "Deep forest", hex: "#365848"},
  cedar: {name: "Cedar brown", hex: "#9B7356"},
  charcoal: {name: "Slate charcoal", hex: "#586162"},
  terracotta: {name: "Clay terracotta", hex: "#BA8068"},
} as const;
export type FinishColor = keyof typeof finishColors;

export async function applyFinishColor(source: Buffer, region: Mark[], color: FinishColor) {
  const {data, info} = await sharp(source, {limitInputPixels: 2000000})
    .toColourspace("srgb").removeAlpha().raw().toBuffer({resolveWithObject:true});
  if (info.channels !== 3) throw Error("Unexpected source image format");
  const hex = finishColors[color].hex;
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (!insideRegion((x + .5)/info.width, (y + .5)/info.height, region)) continue;
    const i = (y * info.width + x)*3;
    const luminance = (data[i]*.2126 + data[i+1]*.7152 + data[i+2]*.0722) / 255;
    const shade = .58 + luminance * .75;
    for (let channel=0; channel<3; channel++) {
      const tint = Math.min(255, rgb[channel] * shade);
      data[i+channel] = Math.round(data[i+channel] * .22 + tint * .78);
    }
  }
  return sharp(data, {raw:{width:info.width,height:info.height,channels:3}}).png().toBuffer();
}
