/* ============================================================
   Cloudflare Worker — POST /api/optimize
   Keeps the Groq API key on the server.

   Set GROQ_API_KEY in Cloudflare:
   Settings → Variables and Secrets → Add GROQ_API_KEY
   ============================================================ */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

export async function onRequestPost(context) {
  const apiKey = context.env.GROQ_API_KEY;

  if (!apiKey) {
    return jsonResponse(
      {
        error:
          "API key not configured. Add GROQ_API_KEY to your Cloudflare Worker variables and secrets.",
      },
      500,
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return jsonResponse({ error: "Invalid request body" }, 400);
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const modelId = typeof body?.modelId === "string" ? body.modelId : "any";

  if (!prompt) {
    return jsonResponse({ error: "Missing prompt" }, 400);
  }

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: buildSystemPrompt(modelId) },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message =
        errorBody?.error?.message ||
        errorBody?.message ||
        `Groq API error: ${response.status}`;
      return jsonResponse({ error: message }, response.status);
    }

    const data = await response.json();
    const optimized = data?.choices?.[0]?.message?.content;

    if (typeof optimized !== "string" || !optimized.trim()) {
      return jsonResponse({ error: "No response from GPT-OSS 120B" }, 502);
    }

    return jsonResponse({
      prompt: optimized.trim(),
      notes: buildNotes(modelId),
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500,
    );
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildSystemPrompt(modelId) {
  const base = `You are MetaPrompt, an expert prompt engineer. Your task is to take a user's raw intent and generate the most effective prompt for a specific AI model. You know each model's training quirks, preferred format, token limits, and reasoning style.

Output ONLY the optimised prompt as plain text, ready to copy-paste. Never add meta-commentary, explanations, or markdown formatting around the prompt.`;

  const modelGuidance = {
    any: `\n\nFor universal prompts: Use neutral formatting and clear constraints that work across all major providers. Balance clarity, structure, and adaptability.`,
    claude: `\n\nFor Claude (Anthropic): Use XML tags for structure (<role>, <task>, <instructions>, <output_format>). Include explicit role/task separation. Support chain-of-thought with thinking tags. Be thorough and nuanced.`,
    grok: `\n\nFor Grok (xAI): Keep it conversational and direct. Minimal scaffolding. Emphasise honesty, real-time awareness, and directness. Avoid unnecessary hedging.`,
    chatgpt: `\n\nFor ChatGPT (OpenAI): Use [System]/[User] message separation. Markdown formatting throughout. Clear constraints and output spec. Include role definition.`,
    gemini: `\n\nFor Gemini (Google): Use structured headings and numbered guidelines. Emphasise grounding and factual accuracy. Include multimodal references where applicable.`,
    copilot: `\n\nFor Copilot (Microsoft): Use Goal-Context-Source-Expectation framework. Be specific about desired output. Provide source references. Set clear expectations.`,
    kimi: `\n\nFor Kimi (Moonshot AI): Use long-context document style with horizontal rules and explicit sectioning. Structured sections for retrieval. Err on the side of more detail.`,
    nemotron: `\n\nFor NemoTron (NVIDIA): Use specification-style language with requirements/constraints pattern. Production-ready code emphasis. Technical precision.`,
    deepseek: `\n\nFor DeepSeek: Use chain-of-thought directives and step-by-step decomposition. Reasoning-before-answer structure. Show your work.`,
  };

  return base + (modelGuidance[modelId] || "");
}

function buildNotes(modelId) {
  const notes = {
    any: "<strong>Universal strategy:</strong> Neutral formatting and clear constraints that work across all major providers.",
    claude: "<strong>Claude strategy:</strong> XML-scaffolded structure with role/task/instructions separation.",
    grok: "<strong>Grok strategy:</strong> Conversational and direct. Minimal scaffolding, maximum honesty.",
    chatgpt: "<strong>ChatGPT strategy:</strong> System/user message separation with markdown formatting.",
    gemini: "<strong>Gemini strategy:</strong> Grounding, factual accuracy, and structured headings.",
    copilot: "<strong>Copilot strategy:</strong> Goal-Context-Source-Expectation framework.",
    kimi: "<strong>Kimi strategy:</strong> Long-context document style with structured sections.",
    nemotron: "<strong>NemoTron strategy:</strong> Specification-style with requirements and constraints.",
    deepseek: "<strong>DeepSeek strategy:</strong> Chain-of-thought and step-by-step decomposition.",
  };
  return notes[modelId] || "Optimised for your target model.";
}
