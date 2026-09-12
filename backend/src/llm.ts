import OpenAI from "openai";
import type { ChatPort } from "./ports.ts";

/**
 * OpenAI's SDK pointed at OpenRouter — the sponsor path, and it means
 * `response_format: json_object` works the same as it does against OpenAI.
 */
export const openRouterChat = (apiKey: string): ChatPort => {
  const client = new OpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" });

  return async ({ model, system, user }) => {
    const res = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return res.choices[0]?.message?.content ?? "";
  };
};
