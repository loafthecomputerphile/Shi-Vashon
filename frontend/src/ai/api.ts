import { Outfit, Clothing } from "@/types";

// OpenRouter image generation via the /api/v1/images contract: send prompt +
// input_references (image_url parts), read the generated image back from
// data[0].b64_json (base64) — returned here as a data URL.
const REQUEST_URL = "https://openrouter.ai/api/v1/images";

// Same slots as the Outfit interface in types.ts.
const SLOT_ORDER = ["top", "bottom", "hat", "dress", "jacket"] as const;

// Output size: 3:4 portrait, like a mirror shot.
const ASPECT_RATIO = "3:4";

export class OutfitImaginator {
  private model: string;
  private apiKey: string;
  private targetImage: string | null = null;

  constructor(model: string) {
    this.model = model;
    this.apiKey = "";
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  setTargetImage(imageUrl: string) {
    this.targetImage = imageUrl;
  }

  // Generate a picture of the whole outfit: the clothing images are placed
  // onto the target image (model/person). Returns the generated image URL
  // (data URL) or null on any failure — never throws.
  async requestImage(outfit: Outfit): Promise<string | null> {
    if (!this.targetImage) return null;
    const images = SLOT_ORDER.map((s) => outfit[s]?.path).filter((p): p is string => !!p);
    if (images.length === 0) return null;
    return this.generate(makePrompt(outfit), this.targetImage, images);
  }

  // Same, for one clothing item (e.g. a cleaner product shot).
  async requestClothingImage(item: Clothing): Promise<string | null> {
    if (!item.path || !this.targetImage) return null;
    return this.generate(makeClothingPrompt(item), this.targetImage, [item.path]);
  }

  // Reference images are sent in slot order (Image 1..N); the target image is
  // always the LAST image — the prompt tells the model to dress it. Throws
  // with the API's own message on failure; callers catch and surface it.
  private async generate(prompt: string, targetImage: string, refImageUrls: string[]): Promise<string | null> {
    if (refImageUrls.length === 0) return null;
    const result = await this.chat({
      model: this.model,
      prompt,
      // Portrait, like a mirror shot.
      aspect_ratio: ASPECT_RATIO,
      input_references: [
        ...refImageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
        { type: "image_url", image_url: { url: targetImage } },
      ],
    });
    const b64 = (result as { data?: { b64_json?: string }[] })?.data?.[0]?.b64_json;
    return b64 ? `data:image/png;base64,${b64}` : null;
  }

  private async chat(body: object): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(REQUEST_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("Couldn't reach OpenRouter — check your connection.");
    }
    if (!response.ok) {
      // Surface the API's own message (bad model slug, auth, quota, …).
      const text = await response.text().catch(() => "");
      let msg = text;
      try {
        msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text;
      } catch {
        /* keep raw text */
      }
      throw new Error(`OpenRouter ${response.status}: ${msg || response.statusText}`);
    }
    return await response.json();
  }
}

// e.g. "Image 1 shows the top. Image 2 shows the bottom. The final image is
// the target. Dress the person in the target image with the clothing items
// from the other images, keeping their face, pose and background unchanged."
export function makePrompt(outfit: Outfit): string {
  const parts: string[] = [];
  let count = 0;
  for (const slot of SLOT_ORDER) {
    if (!outfit[slot]) continue;
    count++;
    parts.push(`Image ${count} shows the ${slot}.`);
  }
  if (parts.length === 0) return "";
  parts.push(
    `The final image is the target. Dress the person in the target image in these ${count} clothing items, keeping the person's face, pose, body and background unchanged.`,
  );
  return parts.join(" ");
}

export function makeClothingPrompt(item: Clothing): string {
  return (
    `The first image shows a ${item.type} called "${item.name}" by ${item.brand}. ` +
    `The final image is the target. Show this exact item on the person in the target image, keeping their face, pose, body and background unchanged.`
  );
}
