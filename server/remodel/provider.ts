import { remodelPrompt, type RailingMaterial } from "../../shared/remodel";
export interface EditInput {
  image: Buffer;
  mask: Buffer;
  material: RailingMaterial;
  brief?: string;
}
export interface RemodelProvider {
  name: string;
  model: string;
  edit: (
    input: EditInput,
  ) => Promise<{ image: Buffer; usage?: unknown; requestId?: string }>;
}
export const providerDisclosure = {
  name: "OpenAI",
  model: "gpt-image-1.5",
  quality: "medium",
  size: "1024x1024",
  outputPriceUsd: 0.034,
  pricingUrl: "https://developers.openai.com/api/docs/models/gpt-image-1.5",
  notice:
    "OpenAI receives the property photo and area mask. Medium square output is $0.034 plus image/text input charges. The application reserves $1 per attempt against the configured development cap; this is a safety allowance, not a quoted supplier invoice. Failed or interrupted requests may be billed. No automatic retries.",
};
export function configuredProvider(): RemodelProvider | undefined {
  if (
    process.env.PHOTO_REMODEL_PROVIDER !== "openai" ||
    process.env.PHOTO_REMODEL_PROCESSING_APPROVED !== "1" ||
    !process.env.PHOTO_REMODEL_OPENAI_KEY
  )
    return;
  return {
    name: "OpenAI",
    model: "gpt-image-1.5",
    edit: async (input) => {
      const body = new FormData();
      body.set("model", "gpt-image-1.5");
      body.set("prompt", remodelPrompt(input.material, input.brief));
      body.set("n", "1");
      body.set("size", "1024x1024");
      body.set("quality", "medium");
      body.set("output_format", "png");
      body.set("background", "opaque");
      body.set("input_fidelity", "high");
      body.set(
        "image",
        new Blob([new Uint8Array(input.image)], { type: "image/png" }),
        "property.png",
      );
      body.set(
        "mask",
        new Blob([new Uint8Array(input.mask)], { type: "image/png" }),
        "area-mask.png",
      );
      const r = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PHOTO_REMODEL_OPENAI_KEY}`,
        },
        body,
        signal: AbortSignal.timeout(180000),
      });
      if (!r.ok) throw Error("Image provider request failed");
      const text = await r.text();
      if (text.length > 16000000) throw Error("Provider output too large");
      const data = JSON.parse(text),
        b64 = data.data?.[0]?.b64_json;
      if (
        typeof b64 !== "string" ||
        !b64.length ||
        b64.length > 14000000 ||
        !/^[A-Za-z0-9+/=]+$/.test(b64)
      )
        throw Error("Image provider returned no usable image");
      return {
        image: Buffer.from(b64, "base64"),
        usage: data.usage,
        requestId: r.headers.get("x-request-id") || undefined,
      };
    },
  };
}
