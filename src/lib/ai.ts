import { AppConfig, ChatMessage, MbtiAssessment, ModuleAnalysis } from "../types";
import { getProvider } from "../data/providers";

const compactJson = (value: unknown) => JSON.stringify(value, null, 2);

const extractJson = (text: string) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Model did not return JSON.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
};

export const effectiveModel = (config: AppConfig) => config.customModel.trim() || config.model.trim();

export const callModel = async (config: AppConfig, messages: ChatMessage[]) => {
  const provider = getProvider(config.providerId);
  const model = effectiveModel(config);
  const baseUrl = config.baseUrl.trim() || provider.baseUrl;

  if (!model) {
    throw new Error("Choose or enter a model.");
  }
  if (provider.needsApiKey && !config.apiKey.trim()) {
    throw new Error("This provider requires an API key.");
  }

  if (provider.kind === "anthropic") {
    const system = messages.find((message) => message.role === "system")?.content ?? "";
    const userMessages = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content }));
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({ model, system, messages: userMessages, max_tokens: 1800, temperature: 0.2 })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Anthropic request failed.");
    }
    return data.content?.map((part: { text?: string }) => part.text).filter(Boolean).join("\n") ?? "";
  }

  if (provider.kind === "gemini") {
    const system = messages.find((message) => message.role === "system")?.content;
    const contents = messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }]
      }));
    const response = await fetch(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 1800 }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message ?? "Gemini request failed.");
    }
    return data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text).filter(Boolean).join("\n") ?? "";
  }

  if (provider.kind === "ollama") {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model, messages, stream: false, options: { temperature: 0.2 } })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? "Ollama request failed.");
    }
    return data.message?.content ?? "";
  }

  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }
  if (config.providerId === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/local/personality-portrait-mobile";
    headers["X-Title"] = "Personality Portrait Mobile";
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, temperature: 0.2 })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message ?? "OpenAI-compatible request failed.");
  }
  return data.choices?.[0]?.message?.content ?? "";
};

const systemPrompt =
  "You are a cautious, non-diagnostic personality portrait interviewer. Separate observations from interpretations, avoid clinical labels, avoid fixed personality types, and use evidence-linked, tentative language.";

export const analyzeModule = async (
  config: AppConfig,
  args: {
    title: string;
    purpose: string;
    answers: unknown[];
    yesNoQuestions: string[];
    detect: string[];
  }
): Promise<ModuleAnalysis> => {
  const prompt = `Analyze this interview module and predict likely yes/no calibration answers.

Return only JSON with this shape:
{
  "summary": "2-4 cautious sentences",
  "observations": ["observable detail from answers"],
  "patterns": ["tentative pattern"],
  "confidence": "low|medium|high",
  "predictedAnswers": [
    {"question": "exact yes/no question", "predictedAnswer": true, "rationale": "short reason"}
  ]
}

Module: ${args.title}
Purpose: ${args.purpose}
Patterns to consider, not force: ${args.detect.join(", ")}
Yes/no questions to predict: ${compactJson(args.yesNoQuestions)}
Answers so far: ${compactJson(args.answers)}`;

  const raw = await callModel(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ]);
  const parsed = extractJson(raw);
  return {
    moduleId: "",
    title: args.title,
    summary: String(parsed.summary ?? ""),
    observations: Array.isArray(parsed.observations) ? parsed.observations.map(String) : [],
    patterns: Array.isArray(parsed.patterns) ? parsed.patterns.map(String) : [],
    confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
    predictedAnswers: Array.isArray(parsed.predictedAnswers)
      ? parsed.predictedAnswers.map((prediction: { question?: string; predictedAnswer?: boolean; rationale?: string }) => ({
          question: String(prediction.question ?? ""),
          predictedAnswer: Boolean(prediction.predictedAnswer),
          rationale: String(prediction.rationale ?? "")
        }))
      : []
  };
};

export const rephraseQuestion = async (
  config: AppConfig,
  args: {
    question: string;
    previousWording?: string;
    kind: "open" | "rating" | "yesno";
  }
) => {
  const prompt = `Rephrase this interview question without changing its intent.

Rules:
- Return one clear question only.
- Preserve the exact underlying meaning.
- Do not add a new topic.
- If it is a yes/no question, keep it answerable with YES or NO.
- If it is a 1-10 scoring question, keep the same 1-10 scale.
- You may add a short concrete example only if it clarifies the same intent.

Question type: ${args.kind}
Original question: ${args.question}
Current wording on screen: ${args.previousWording || args.question}`;

  const raw = await callModel(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ]);

  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .split("\n")
    .map((line: string) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)[0] ?? args.question;
};

export const generateFinalReport = async (
  config: AppConfig,
  args: {
    answers: unknown[];
    analyses: unknown[];
  }
) => {
  const prompt = `Create the final report as Markdown using this exact structure:
***Reference only. This result is for self-reflection and the app is not responsible for decisions, outcomes, or interpretations based on it.***

# Personality Portrait
## Core Summary
## Main Drivers
## Main Sensitivities
## Thinking Style
## Emotional Pattern
## Relationship Pattern
## Stress Pattern
## Conflict and Authority Pattern
## Strengths
## Blind Spots
## Core Inner Conflict
## Growth Direction
## Evidence Used
## Uncertainty

Rules:
- Do not diagnose.
- Do not assign a fixed type.
- Keep the reference-only disclaimer as the first visible line, surrounded by ***.
- Use phrases like "appears to", "may", "one possible pattern".
- Link claims to evidence.
- Include uncertainty and missing information.
- Keep the report useful and concise.

Module analyses: ${compactJson(args.analyses)}
All answers: ${compactJson(args.answers)}`;

  return callModel(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ]);
};

export const generateMbtiAssessment = async (
  config: AppConfig,
  args: {
    answers: unknown[];
    analyses: unknown[];
  }
): Promise<MbtiAssessment> => {
  const prompt = `Estimate an MBTI-style preference profile from this interview evidence.

Important:
- MBTI here is only a lightweight self-reflection lens, not a diagnosis or fixed identity.
- Use evidence-linked, cautious language.
- Give a percentage from 0 to 100 for the left-side letter in each pair:
  EI uses E on the left and I on the right.
  SN uses S on the left and N on the right.
  TF uses T on the left and F on the right.
  JP uses J on the left and P on the right.
- Example: if the user is 40% E and 60% I, set EI leftScore to 40 and chosenLetter to "I".

Return only JSON with this exact shape:
{
  "type": "INTJ",
  "confidence": "low|medium|high",
  "summary": "2-3 cautious sentences",
  "dimensions": [
    {"key":"EI","leftLetter":"E","rightLetter":"I","leftScore":40,"chosenLetter":"I","rationale":["evidence reason"]},
    {"key":"SN","leftLetter":"S","rightLetter":"N","leftScore":45,"chosenLetter":"N","rationale":["evidence reason"]},
    {"key":"TF","leftLetter":"T","rightLetter":"F","leftScore":70,"chosenLetter":"T","rationale":["evidence reason"]},
    {"key":"JP","leftLetter":"J","rightLetter":"P","leftScore":65,"chosenLetter":"J","rationale":["evidence reason"]}
  ]
}

Module analyses: ${compactJson(args.analyses)}
All answers: ${compactJson(args.answers)}`;

  const raw = await callModel(config, [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ]);
  const parsed = extractJson(raw);
  const dimensions = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
  return {
    type: String(parsed.type ?? "UNKN").slice(0, 4).toUpperCase(),
    confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "low",
    summary: String(parsed.summary ?? ""),
    dimensions: dimensions.map((dimension: {
      key?: "EI" | "SN" | "TF" | "JP";
      leftLetter?: "E" | "S" | "T" | "J";
      rightLetter?: "I" | "N" | "F" | "P";
      leftScore?: number;
      chosenLetter?: string;
      rationale?: string[];
    }) => ({
      key: dimension.key ?? "EI",
      leftLetter: dimension.leftLetter ?? "E",
      rightLetter: dimension.rightLetter ?? "I",
      leftScore: Math.max(0, Math.min(100, Number(dimension.leftScore ?? 50))),
      chosenLetter: String(dimension.chosenLetter ?? ""),
      rationale: Array.isArray(dimension.rationale) ? dimension.rationale.map(String).slice(0, 3) : []
    }))
  };
};
