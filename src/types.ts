export type ProviderKind = "local" | "openai-compatible" | "anthropic" | "gemini" | "ollama";

export type ProviderConfig = {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  models: string[];
  needsApiKey: boolean;
};

export type AppConfig = {
  providerId: string;
  model: string;
  customModel: string;
  apiKey: string;
  baseUrl: string;
};

export type InterviewModule = {
  id: string;
  title: string;
  purpose: string;
  mainQuestions: string[];
  followUps: string[];
  calibrationQuestions: string[];
  detect: string[];
};

export type QuestionKind = "open" | "rating" | "yesno";

export type Answer = {
  questionId: string;
  moduleId: string;
  kind: QuestionKind;
  question: string;
  value: string | number | boolean;
  createdAt: string;
};

export type PredictedAnswer = {
  question: string;
  predictedAnswer: boolean;
  rationale: string;
};

export type ModuleAnalysis = {
  moduleId: string;
  title: string;
  summary: string;
  observations: string[];
  patterns: string[];
  confidence: "low" | "medium" | "high";
  predictedAnswers: PredictedAnswer[];
  agreement?: number;
  correction?: string;
};

export type MbtiDimension = {
  key: "EI" | "SN" | "TF" | "JP";
  leftLetter: "E" | "S" | "T" | "J";
  rightLetter: "I" | "N" | "F" | "P";
  leftScore: number;
  chosenLetter: string;
  rationale: string[];
};

export type MbtiAssessment = {
  type: string;
  confidence: "low" | "medium" | "high";
  summary: string;
  dimensions: MbtiDimension[];
};

export type SessionState = {
  moduleIndex: number;
  phase: "open" | "rating" | "analyzing" | "validate" | "calibrate" | "complete";
  openIndex: number;
  ratingIndex: number;
  validateIndex: number;
  answers: Answer[];
  analyses: ModuleAnalysis[];
  finalReport: string;
  mbtiAssessment: MbtiAssessment | null;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};
