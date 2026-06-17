import { ProviderConfig } from "../types";

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "local",
    name: "Free Local",
    kind: "local",
    baseUrl: "",
    needsApiKey: false,
    models: ["local-rules"]
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    needsApiKey: true,
    models: ["gpt-5", "gpt-5-mini", "gpt-4.1", "gpt-4.1-mini", "o3", "o4-mini"]
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    needsApiKey: true,
    models: ["claude-sonnet-4-6", "claude-opus-4-1", "claude-sonnet-4-5", "claude-sonnet-4-0", "claude-3-7-sonnet-latest"]
  },
  {
    id: "gemini",
    name: "Google Gemini",
    kind: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    needsApiKey: true,
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]
  },
  {
    id: "xai",
    name: "xAI",
    kind: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
    needsApiKey: true,
    models: ["grok-4", "grok-3", "grok-3-mini"]
  },
  {
    id: "mistral",
    name: "Mistral AI",
    kind: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    needsApiKey: true,
    models: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"]
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    kind: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    needsApiKey: true,
    models: ["deepseek-chat", "deepseek-reasoner"]
  },
  {
    id: "groq",
    name: "Groq",
    kind: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    needsApiKey: true,
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it"]
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    needsApiKey: true,
    models: ["openai/gpt-5", "anthropic/claude-sonnet-4", "google/gemini-2.5-pro", "meta-llama/llama-3.3-70b-instruct"]
  },
  {
    id: "ollama",
    name: "Ollama",
    kind: "ollama",
    baseUrl: "http://localhost:11434",
    needsApiKey: false,
    models: ["llama3.2", "qwen2.5", "mistral", "gemma3"]
  },
  {
    id: "custom",
    name: "Custom OpenAI-compatible",
    kind: "openai-compatible",
    baseUrl: "https://api.example.com/v1",
    needsApiKey: false,
    models: ["custom-model"]
  }
];

export const getProvider = (providerId: string): ProviderConfig =>
  PROVIDERS.find((provider) => provider.id === providerId) ?? PROVIDERS[0]!;
