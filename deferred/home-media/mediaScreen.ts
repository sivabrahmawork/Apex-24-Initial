// services/mediaScreen.ts — Claude vision screen on EVERY image before it is publicly served.
// Conservative gate: blocks sexual content, graphic violence, and any unsafe depiction of minors.
// This is a first line, not a substitute for hash-based CSAM tooling at scale.
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM = `You screen user-uploaded images for an Indian social platform. Respond ONLY with JSON:
{"verdict":"pass"|"block","category":"sexual|violence|minor_safety|none","reason":"one line"}
Block: nudity or sexual content; graphic violence/gore; any sexualized, endangering or exploitative
depiction of a minor (block on ANY doubt about minors). Otherwise pass.`;

export async function screenImage(base64: string, mediaType: string) {
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: SYSTEM,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType as any, data: base64 } },
          { type: "text", text: "Screen this image." },
        ],
      }],
    });
    const text = res.content.filter(b => b.type === "text").map(b => (b as any).text).join("");
    const out = JSON.parse(text.replace(/```json|```/g, "").trim());
    return out.verdict === "pass" ? { pass: true as const } :
      { pass: false as const, category: out.category ?? "unspecified" };
  } catch {
    return { pass: false as const, category: "screen_error" }; // fail CLOSED: unscreened media never publishes
  }
}
