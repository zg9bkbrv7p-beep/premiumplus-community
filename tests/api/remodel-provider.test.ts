import { test, expect, vi } from "vitest";
import { configuredProvider } from "../../server/remodel/provider";
test("OpenAI adapter is approved/key gated and sends actual source/mask through the edits API", async () => {
  const original = { ...process.env };
  try {
    delete process.env.PHOTO_REMODEL_OPENAI_KEY;
    expect(configuredProvider()).toBeUndefined();
    process.env.PHOTO_REMODEL_PROVIDER = "openai";
    process.env.PHOTO_REMODEL_PROCESSING_APPROVED = "1";
    process.env.PHOTO_REMODEL_OPENAI_KEY = "test-only-not-a-real-key";
    const fetcher = vi.fn(async (url: any, options: any) => {
      expect(url).toBe("https://api.openai.com/v1/images/edits");
      const form = options.body as FormData;
      expect(form.get("model")).toBe("gpt-image-1.5");
      expect(form.get("quality")).toBe("medium");
      expect(form.get("size")).toBe("1024x1024");
      expect(
        Buffer.from(await (form.get("image") as Blob).arrayBuffer()).toString(),
      ).toBe("actual source bytes");
      expect(
        Buffer.from(await (form.get("mask") as Blob).arrayBuffer()).toString(),
      ).toBe("actual mask bytes");
      return new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("output").toString("base64") }],
          usage: { total_tokens: 100 },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetcher);
    const result = await configuredProvider()!.edit({
      image: Buffer.from("actual source bytes"),
      mask: Buffer.from("actual mask bytes"),
      material: "glass",
    });
    expect(result.image.toString()).toBe("output");
    expect(fetcher).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
    for (const key of [
      "PHOTO_REMODEL_OPENAI_KEY",
      "PHOTO_REMODEL_PROVIDER",
      "PHOTO_REMODEL_PROCESSING_APPROVED",
    ]) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});
