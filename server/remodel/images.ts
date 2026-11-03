import sharp from "sharp";
import { insideRegion, type Mark } from "../../shared/remodel";
export async function normalizePhoto(input: Buffer) {
  const png = input
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpeg = input[0] === 255 && input[1] === 216 && input[2] === 255,
    webp =
      input.subarray(0, 4).toString() === "RIFF" &&
      input.subarray(8, 12).toString() === "WEBP";
  if (!png && !jpeg && !webp) throw Error("Unsupported raster format");
  const { data, info } = await sharp(input, {
    limitInputPixels: 40000000,
    animated: false,
  })
    .rotate()
    .resize({
      width: 1024,
      height: 1024,
      fit: "inside",
      withoutEnlargement: true,
    })
    .toColourspace("srgb")
    .removeAlpha()
    .png()
    .toBuffer({ resolveWithObject: true });
  if (info.width < 128 || info.height < 128)
    throw Error("Photo must be at least 128 × 128 pixels");
  return { image: data, width: info.width, height: info.height };
}
export async function prepareEdit(
  image: Buffer,
  width: number,
  height: number,
  region: Mark[],
) {
  const left = Math.floor((1024 - width) / 2),
    top = Math.floor((1024 - height) / 2);
  const padded = await sharp(image)
    .extend({
      left,
      right: 1024 - width - left,
      top,
      bottom: 1024 - height - top,
      background: "#f5f3ef",
    })
    .png()
    .toBuffer();
  const raw = Buffer.alloc(1024 * 1024 * 4, 255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (insideRegion((x + 0.5) / width, (y + 0.5) / height, region))
        raw[((top + y) * 1024 + left + x) * 4 + 3] = 0;
  const mask = await sharp(raw, {
    raw: { width: 1024, height: 1024, channels: 4 },
  })
    .png()
    .toBuffer();
  return { image: padded, mask, left, top };
}
export async function finishEdit(
  original: Buffer,
  generated: Buffer,
  width: number,
  height: number,
  region: Mark[],
) {
  const meta = await sharp(generated, { limitInputPixels: 2000000 }).metadata();
  if (meta.width !== 1024 || meta.height !== 1024)
    throw Error("Provider returned unexpected image dimensions");
  const before = await sharp(original)
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer(),
    after = await sharp(generated)
      .extract({
        left: Math.floor((1024 - width) / 2),
        top: Math.floor((1024 - height) / 2),
        width,
        height,
      })
      .toColourspace("srgb")
      .removeAlpha()
      .raw()
      .toBuffer();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (insideRegion((x + 0.5) / width, (y + 0.5) / height, region)) {
        const i = (y * width + x) * 3;
        before[i] = after[i];
        before[i + 1] = after[i + 1];
        before[i + 2] = after[i + 2];
      }
  return sharp(before, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}
export async function proposalConcept(image: Buffer, material: string, brief = "", kind: "ai" | "color-study" = "ai") {
  const { data, info } = await sharp(image)
    .resize({ width: 1024, height: 1024, fit: "inside" })
    .png({ palette: true, colours: 256 })
    .toBuffer({ resolveWithObject: true });
  const footer = Buffer.from(
    `<svg width="${info.width}" height="48"><rect width="100%" height="100%" fill="#173d32"/><text x="14" y="20" fill="#fff9ef" font-size="13" font-family="sans-serif">${kind === "color-study" ? "LOCAL FINISH COLOR STUDY · NOT PHOTOREALISTIC" : `AI renovation concept · ${brief ? "Property renovation" : material + " railing"}`}</text><text x="14" y="38" fill="#fff9ef" font-size="11" font-family="sans-serif">Illustrative only. Field measurements and professional safety/code review required.</text></svg>`,
  );
  const png = await sharp(data)
    .extend({ top: 0, left: 0, right: 0, bottom: 48, background: "#173d32" })
    .composite([{ input: footer, top: info.height, left: 0 }])
    .png({ palette: true, colours: 256 })
    .toBuffer();
  return "data:image/png;base64," + png.toString("base64");
}
