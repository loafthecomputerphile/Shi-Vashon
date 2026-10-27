import { Outfit, Clothing } from "@/types";

// api.ts — talks to the app's worker, which forwards to OpenRouter to "try
// on" clothes using AI image generation.
//
// The idea: we send the AI a picture of a person (the "target" image, taken
// from Settings) plus pictures of the clothing items, and it sends back a
// picture of the person wearing them. The reply comes back as base64 text,
// which we turn into a data URL so it can be saved in the wardrobe database
// like any other image.
//
// The API key never touches the browser — the worker adds it server-side.
// We only POST the same JSON body OpenRouter expects to /api/generate and
// pass the reply back through.

// Same slots as the Outfit interface in types.ts.
const SLOT_ORDER = ["top", "bottom", "hat", "dress", "jacket"] as const;

// Output size: 3:4 portrait, like a mirror shot.
const ASPECT_RATIO = "3:4";

export class OutfitImaginator {
  private model: string;
  private targetImage: string | null = null;

  constructor(model: string) {
    this.model = model;
  }

  setTargetImage(imageUrl: string) {
    this.targetImage = imageUrl;
  }

  // Generate a picture of the whole outfit: the clothing images are placed
  // onto the target image (model/person). Returns the generated image URL
  // (data URL) or null on any failure — never throws.
  async requestImage(outfit: Outfit): Promise<string | null> {
    if (!this.targetImage) return null;

    // Collect the image of every filled slot, skipping empty ones.
    const images: string[] = [];
    for (const slot of SLOT_ORDER) {
      const item = outfit[slot];
      if (item && item.path) images.push(item.path);
    }
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

    // Build the list of input images: clothing refs first, target last.
    const references: object[] = [];
    for (const url of refImageUrls) {
      references.push({ type: "image_url", image_url: { url } });
    }
    references.push({ type: "image_url", image_url: { url: targetImage } });

    const result = await this.chat({
      model: this.model,
      prompt,
      aspect_ratio: ASPECT_RATIO,
      input_references: references,
    });

    // The reply's shape is unknown to TypeScript, so we check each step
    // ourselves instead of trusting a cast: data[0].b64_json holds the image.
    let b64: string | null = null;
    if (typeof result === "object" && result !== null && "data" in result) {
      const data = (result as { data?: unknown }).data;
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null) {
        const first = data[0] as { b64_json?: unknown };
        if (typeof first.b64_json === "string") b64 = first.b64_json;
      }
    }
    return b64 ? `data:image/png;base64,${b64}` : null;
  }

  // One POST through the worker (/api/generate adds the key + quota).
  // Returns the parsed JSON response. Throws a readable error when the
  // network fails, we're not logged in, the daily limit is hit, or the
  // model API answers with an error.
  private async chat(body: object): Promise<unknown> {
    // Same base as lib/auth.ts: '' in dev (Vite proxy), worker URL in prod.
    const base = import.meta.env.VITE_API_URL ?? '';
    let response: Response;
    try {
      response = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("Couldn't reach the server — check your connection.");
    }

    if (!response.ok) {
      // Surface the server's own message (quota, login, upstream error, …).
      let msg = response.statusText;
      try {
        const parsed = (await response.json()) as { error?: string };
        if (parsed?.error) msg = parsed.error;
      } catch {
        // no JSON body — fall back to statusText
      }
      throw new Error(msg);
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
