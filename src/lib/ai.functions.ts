import { createServerFn } from "@tanstack/react-start";

export interface GiftSuggestion {
  gift: string;
  reason: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          gift: { type: "string", enum: ["গোলাপ", "লাভ", "মুকুট"] },
          reason: { type: "string" },
        },
        required: ["gift", "reason"],
      },
    },
  },
  required: ["suggestions"],
} as const;

/** Suggests gifts from what the viewer writes about the video, via Lovable AI. */
export const suggestGifts = createServerFn({ method: "POST" })
  .inputValidator((data: { message: string }) => {
    const message = String(data?.message ?? "").trim().slice(0, 500);
    if (message.length === 0) throw new Error("empty");
    return { message };
  })
  .handler(async ({ data }): Promise<GiftSuggestion[]> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        instructions:
          "You suggest virtual gifts for a Bangladeshi short-video app. Available gifts: গোলাপ (10 coins, light appreciation), লাভ (30 coins, strong affection), মুকুট (100 coins, top praise). Reply with 1-3 suggestions, each reason one short sentence in Bengali.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `দর্শক লিখেছে: ${data.message}\nJSON আকারে গিফট সাজেশন দাও।`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "gift_suggestions",
            strict: true,
            schema: SCHEMA,
          },
        },
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`AI Gateway error ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const event = JSON.parse(payload) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string };
          };
          if (event.type === "response.output_text.delta" && event.delta) {
            text += event.delta;
          } else if (
            event.type === "response.completed" &&
            event.response?.output_text
          ) {
            text = event.response.output_text;
          }
        } catch {
          // ignore keep-alive / partial frames
        }
      }
    }

    try {
      const parsed = JSON.parse(text) as { suggestions?: GiftSuggestion[] };
      return (parsed.suggestions ?? []).slice(0, 3);
    } catch {
      return [];
    }
  });
