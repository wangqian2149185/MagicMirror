import AsyncStorage from "@react-native-async-storage/async-storage";
import Clipboard from "expo-clipboard";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Picker } from "@react-native-picker/picker";

import { GUIDE_MODULES, SAFETY_BOUNDARY } from "./src/data/interviewGuide";
import { getProvider, PROVIDERS } from "./src/data/providers";
import { analyzeModule, effectiveModel, generateFinalReport } from "./src/lib/ai";
import { Answer, AppConfig, ModuleAnalysis, QuestionKind, SessionState } from "./src/types";

const CONFIG_KEY = "portrait-app-config";
const SESSION_KEY = "portrait-app-session";

const defaultConfig: AppConfig = {
  providerId: "openai",
  model: "gpt-5",
  customModel: "",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1"
};

const defaultSession: SessionState = {
  moduleIndex: 0,
  phase: "open",
  openIndex: 0,
  ratingIndex: 0,
  validateIndex: 0,
  answers: [],
  analyses: [],
  finalReport: ""
};

const isRatingQuestion = (question: string) => /^from 1 to 10/i.test(question.trim());

const openQuestionsFor = (moduleIndex: number) => {
  const module = GUIDE_MODULES[moduleIndex];
  if (!module) {
    return [];
  }
  return [
    module.mainQuestions[0],
    module.followUps[0],
    module.mainQuestions[1],
    module.followUps[1],
    module.mainQuestions[2]
  ].filter(Boolean) as string[];
};

const ratingQuestionsFor = (moduleIndex: number) =>
  GUIDE_MODULES[moduleIndex]?.calibrationQuestions.filter(isRatingQuestion) ?? [];

const yesNoQuestionsFor = (moduleIndex: number) =>
  GUIDE_MODULES[moduleIndex]?.calibrationQuestions.filter((question) => !isRatingQuestion(question)) ?? [];

const questionId = (moduleId: string, kind: QuestionKind, index: number) => `${moduleId}:${kind}:${index}`;

const now = () => new Date().toISOString();

const coerceAnalysis = (
  moduleId: string,
  title: string,
  analysis: ModuleAnalysis,
  yesNoQuestions: string[]
): ModuleAnalysis => ({
  ...analysis,
  moduleId,
  title,
  predictedAnswers:
    analysis.predictedAnswers.length > 0
      ? yesNoQuestions.map((question, index) => {
          const found = analysis.predictedAnswers.find((prediction) => prediction.question === question);
          return (
            found ?? {
              question,
              predictedAnswer: index % 2 === 0,
              rationale: "Fallback prediction because the model did not return this item."
            }
          );
        })
      : yesNoQuestions.map((question, index) => ({
          question,
          predictedAnswer: index % 2 === 0,
          rationale: "Fallback prediction because the model did not return calibration answers."
        }))
});

const localModuleAnalysis = (moduleIndex: number, moduleAnswers: Answer[]) => {
  const module = GUIDE_MODULES[moduleIndex];
  const yesNoQuestions = yesNoQuestionsFor(moduleIndex);
  const textAnswers = moduleAnswers
    .filter((answer) => answer.kind === "open")
    .map((answer) => String(answer.value))
    .filter(Boolean);
  const ratings = moduleAnswers.filter((answer) => answer.kind === "rating").map((answer) => Number(answer.value));
  const avgRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 5;
  const analysis: ModuleAnalysis = {
    moduleId: module?.id ?? "",
    title: module?.title ?? "Module",
    summary:
      textAnswers.length > 0
        ? `This section has ${textAnswers.length} narrative answer(s). The app needs model access for a richer interpretation, so this local summary treats patterns as tentative.`
        : "This section has limited evidence, so interpretations should remain low confidence.",
    observations: textAnswers.slice(0, 3),
    patterns: module?.detect.slice(0, 3).map((pattern) => `Possible ${pattern}`) ?? [],
    confidence: textAnswers.length >= 3 ? "medium" : "low",
    predictedAnswers: yesNoQuestions.map((question) => ({
      question,
      predictedAnswer: avgRating >= 6,
      rationale: "Local fallback based mainly on scoring intensity."
    }))
  };
  return analysis;
};

const localFinalReport = (session: SessionState) => {
  const supported = session.analyses.flatMap((analysis) => analysis.patterns).slice(0, 8);
  const evidence = session.answers
    .filter((answer) => answer.kind === "open")
    .map((answer) => `- ${answer.question}: ${String(answer.value).slice(0, 180)}`)
    .slice(0, 8)
    .join("\n");

  return `# Personality Portrait

## Core Summary
This is a local draft because model-based report generation was unavailable. The strongest material comes from the user's concrete examples and repeated patterns across modules.

## Main Drivers
${supported.slice(0, 3).map((item) => `- ${item}`).join("\n") || "- Needs more evidence"}

## Main Sensitivities
${supported.slice(3, 6).map((item) => `- ${item}`).join("\n") || "- Needs more evidence"}

## Thinking Style
Review the Cognitive Style module for evidence-linked interpretation.

## Emotional Pattern
Review the Emotional Pattern module for triggers, expression, and recovery.

## Relationship Pattern
Review the Relationship Pattern module for trust, closeness, and boundaries.

## Stress Pattern
Review the Stress Response module for pressure behavior.

## Conflict and Authority Pattern
Review the Conflict, Authority, and Power module for hierarchy and respect patterns.

## Strengths
- Patterns should be interpreted cautiously and linked to examples.

## Blind Spots
- Any blind spot remains tentative until the user confirms or corrects it.

## Core Inner Conflict
Needs model synthesis or additional reflection.

## Growth Direction
Use the final module answers to choose practical, observable next steps.

## Evidence Used
${evidence || "- No open-ended evidence recorded."}

## Uncertainty
This report avoids diagnosis and fixed labels. More counterexamples and corrections would improve accuracy.
`;
};

export default function App() {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [session, setSession] = useState<SessionState>(defaultSession);
  const [isReady, setIsReady] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [draft, setDraft] = useState("");
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const currentModule = GUIDE_MODULES[session.moduleIndex];
  const provider = getProvider(config.providerId);
  const openQuestions = useMemo(() => openQuestionsFor(session.moduleIndex), [session.moduleIndex]);
  const ratingQuestions = useMemo(() => ratingQuestionsFor(session.moduleIndex), [session.moduleIndex]);
  const yesNoQuestions = useMemo(() => yesNoQuestionsFor(session.moduleIndex), [session.moduleIndex]);
  const currentAnalysis = session.analyses.find((analysis) => analysis.moduleId === currentModule?.id);

  useEffect(() => {
    const load = async () => {
      try {
        const [savedConfig, savedSession] = await Promise.all([
          AsyncStorage.getItem(CONFIG_KEY),
          AsyncStorage.getItem(SESSION_KEY)
        ]);
        if (savedConfig) {
          setConfig({ ...defaultConfig, ...JSON.parse(savedConfig) });
          setIsConfigured(true);
        }
        if (savedSession) {
          setSession({ ...defaultSession, ...JSON.parse(savedSession) });
        }
      } finally {
        setIsReady(true);
      }
    };
    load();
  }, []);

  useSpeechRecognitionEvent("start", () => setListening(true));
  useSpeechRecognitionEvent("end", () => setListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const spoken = event.results[0]?.transcript.trim();
    if (spoken) {
      setDraft((previous) => `${previous ? `${previous} ` : ""}${spoken}`);
    }
  });
  useSpeechRecognitionEvent("error", (event) => {
    setListening(false);
    setError(event.message || `Voice input stopped: ${event.error}`);
  });

  useEffect(() => {
    if (isReady && isConfigured) {
      AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config)).catch(() => undefined);
    }
  }, [config, isConfigured, isReady]);

  useEffect(() => {
    if (isReady) {
      AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session)).catch(() => undefined);
    }
  }, [isReady, session]);

  useEffect(() => {
    setDraft("");
  }, [session.moduleIndex, session.phase, session.openIndex]);

  const saveConfig = () => {
    if (provider.needsApiKey && !config.apiKey.trim()) {
      Alert.alert("API key required", `${provider.name} needs an API key before the interview can use AI summaries.`);
      return;
    }
    setIsConfigured(true);
  };

  const changeProvider = (providerId: string) => {
    const next = getProvider(providerId);
    setConfig((previous) => ({
      ...previous,
      providerId,
      model: next.models[0] ?? "",
      baseUrl: next.baseUrl,
      customModel: ""
    }));
  };

  const addAnswer = (kind: QuestionKind, index: number, question: string, value: string | number | boolean) => {
    if (!currentModule) {
      return;
    }
    const answer: Answer = {
      questionId: questionId(currentModule.id, kind, index),
      moduleId: currentModule.id,
      kind,
      question,
      value,
      createdAt: now()
    };
    setSession((previous) => ({ ...previous, answers: [...previous.answers, answer] }));
  };

  const answerOpen = () => {
    const question = openQuestions[session.openIndex];
    if (!question || !draft.trim()) {
      Alert.alert("Answer needed", "Please type or speak an answer before continuing.");
      return;
    }
    addAnswer("open", session.openIndex, question, draft.trim());
    setSession((previous) => {
      const nextIndex = previous.openIndex + 1;
      return nextIndex >= openQuestions.length
        ? { ...previous, phase: ratingQuestions.length ? "rating" : "analyzing", openIndex: nextIndex }
        : { ...previous, openIndex: nextIndex };
    });
  };

  const answerRating = (value: number) => {
    const question = ratingQuestions[session.ratingIndex];
    if (!question) {
      return;
    }
    addAnswer("rating", session.ratingIndex, question, value);
    setSession((previous) => {
      const nextIndex = previous.ratingIndex + 1;
      return nextIndex >= ratingQuestions.length
        ? { ...previous, phase: "analyzing", ratingIndex: nextIndex }
        : { ...previous, ratingIndex: nextIndex };
    });
  };

  const runModuleAnalysis = async () => {
    if (!currentModule) {
      return;
    }
    setBusy(true);
    setError("");
    const moduleAnswers = session.answers.filter((answer) => answer.moduleId === currentModule.id);
    try {
      const rawAnalysis = await analyzeModule(config, {
        title: currentModule.title,
        purpose: currentModule.purpose,
        answers: moduleAnswers,
        yesNoQuestions,
        detect: currentModule.detect
      });
      const analysis = coerceAnalysis(currentModule.id, currentModule.title, rawAnalysis, yesNoQuestions);
      setSession((previous) => ({
        ...previous,
        analyses: [...previous.analyses.filter((item) => item.moduleId !== currentModule.id), analysis],
        phase: yesNoQuestions.length ? "validate" : "open",
        validateIndex: 0
      }));
    } catch (analysisError) {
      const analysis = localModuleAnalysis(session.moduleIndex, moduleAnswers);
      const detail = analysisError instanceof Error ? analysisError.message : "unknown error";
      setError(`Model analysis failed, so the app used local fallback predictions. Detail: ${detail}`);
      setSession((previous) => ({
        ...previous,
        analyses: [...previous.analyses.filter((item) => item.moduleId !== currentModule.id), analysis],
        phase: yesNoQuestions.length ? "validate" : "open",
        validateIndex: 0
      }));
    } finally {
      setBusy(false);
    }
  };

  const finishModule = (answersAfterUpdate: Answer[]) => {
    if (!currentModule) {
      return;
    }
    const analysis = session.analyses.find((item) => item.moduleId === currentModule.id);
    const yesNoAnswers = answersAfterUpdate.filter(
      (answer) => answer.moduleId === currentModule.id && answer.kind === "yesno"
    );
    const predictions = analysis?.predictedAnswers ?? [];
    const matches = yesNoAnswers.filter((answer) => {
      const prediction = predictions.find((item) => item.question === answer.question);
      return prediction ? prediction.predictedAnswer === answer.value : false;
    }).length;
    const agreement = yesNoAnswers.length ? matches / yesNoAnswers.length : 1;

    setSession((previous) => ({
      ...previous,
      analyses: previous.analyses.map((item) => (item.moduleId === currentModule.id ? { ...item, agreement } : item)),
      phase: agreement >= 0.8 ? "open" : "calibrate",
      moduleIndex: agreement >= 0.8 ? previous.moduleIndex + 1 : previous.moduleIndex,
      openIndex: 0,
      ratingIndex: 0,
      validateIndex: 0
    }));
  };

  const answerYesNo = (value: boolean) => {
    const question = yesNoQuestions[session.validateIndex];
    if (!question || !currentModule) {
      return;
    }
    const answer: Answer = {
      questionId: questionId(currentModule.id, "yesno", session.validateIndex),
      moduleId: currentModule.id,
      kind: "yesno",
      question,
      value,
      createdAt: now()
    };
    const answersAfterUpdate = [...session.answers, answer];
    if (session.validateIndex + 1 >= yesNoQuestions.length) {
      setSession((previous) => ({ ...previous, answers: answersAfterUpdate }));
      finishModule(answersAfterUpdate);
    } else {
      setSession((previous) => ({
        ...previous,
        answers: answersAfterUpdate,
        validateIndex: previous.validateIndex + 1
      }));
    }
  };

  const saveCalibration = () => {
    if (!currentModule || !draft.trim()) {
      Alert.alert("Correction needed", "Please add what the app misunderstood before moving on.");
      return;
    }
    const correction = draft.trim();
    setSession((previous) => ({
      ...previous,
      analyses: previous.analyses.map((analysis) =>
        analysis.moduleId === currentModule.id ? { ...analysis, correction } : analysis
      ),
      moduleIndex: previous.moduleIndex + 1,
      phase: "open",
      openIndex: 0,
      ratingIndex: 0,
      validateIndex: 0
    }));
  };

  const generateReport = async () => {
    setBusy(true);
    setError("");
    try {
      const report = await generateFinalReport(config, { answers: session.answers, analyses: session.analyses });
      setSession((previous) => ({ ...previous, finalReport: report.trim() }));
    } catch (reportError) {
      const detail = reportError instanceof Error ? reportError.message : "unknown error";
      setError(`Model report failed, so the app generated a local draft. Detail: ${detail}`);
      setSession((previous) => ({ ...previous, finalReport: localFinalReport(previous) }));
    } finally {
      setBusy(false);
    }
  };

  const resetInterview = () => {
    Alert.alert("Reset interview?", "This clears all answers and generated reports on this device.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: () => {
          setSession(defaultSession);
          setDraft("");
          AsyncStorage.removeItem(SESSION_KEY).catch(() => undefined);
        }
      }
    ]);
  };

  const startVoice = async () => {
    setError("");
    try {
      const permissions = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permissions.granted) {
        Alert.alert("Permission needed", "Microphone and speech-recognition permission are needed for voice input.");
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: false,
        continuous: false
      });
    } catch (voiceError) {
      setListening(false);
      setError(voiceError instanceof Error ? voiceError.message : "Could not start voice input.");
    }
  };

  const stopVoice = async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } finally {
      setListening(false);
    }
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isConfigured) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.setup}>
          <Text style={styles.appTitle}>Personality Portrait</Text>
          <Text style={styles.bodyText}>{SAFETY_BOUNDARY}</Text>
          <Text style={styles.label}>API company</Text>
          <View style={styles.pickerFrame}>
            <Picker selectedValue={config.providerId} onValueChange={changeProvider}>
              {PROVIDERS.map((item) => (
                <Picker.Item key={item.id} label={item.name} value={item.id} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Model</Text>
          <View style={styles.pickerFrame}>
            <Picker selectedValue={config.model} onValueChange={(model) => setConfig((previous) => ({ ...previous, model }))}>
              {provider.models.map((model) => (
                <Picker.Item key={model} label={model} value={model} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Custom model override</Text>
          <TextInput
            style={styles.input}
            value={config.customModel}
            onChangeText={(customModel) => setConfig((previous) => ({ ...previous, customModel }))}
            placeholder="Optional exact model id"
            autoCapitalize="none"
          />

          <Text style={styles.label}>API key</Text>
          <TextInput
            style={styles.input}
            value={config.apiKey}
            onChangeText={(apiKey) => setConfig((previous) => ({ ...previous, apiKey }))}
            placeholder={provider.needsApiKey ? "Required" : "Optional"}
            secureTextEntry
            autoCapitalize="none"
          />

          <Text style={styles.label}>Base URL</Text>
          <TextInput
            style={styles.input}
            value={config.baseUrl}
            onChangeText={(baseUrl) => setConfig((previous) => ({ ...previous, baseUrl }))}
            autoCapitalize="none"
          />

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              API keys stay in local device storage for this prototype. For a public app, use a backend proxy instead.
            </Text>
          </View>

          <Pressable style={styles.primaryButton} onPress={saveConfig}>
            <Text style={styles.primaryButtonText}>START INTERVIEW</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (session.moduleIndex >= GUIDE_MODULES.length || session.phase === "complete") {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Header onReset={resetInterview} />
          <Text style={styles.sectionEyebrow}>Complete</Text>
          <Text style={styles.title}>Final Results</Text>
          <Text style={styles.bodyText}>
            The report is evidence-linked and intentionally non-diagnostic. You can copy it as Markdown.
          </Text>
          {busy ? <ActivityIndicator size="large" /> : null}
          {!session.finalReport ? (
            <Pressable style={styles.primaryButton} onPress={generateReport} disabled={busy}>
              <Text style={styles.primaryButtonText}>GENERATE REPORT</Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.reportBox}>
                <Text style={styles.reportText}>{session.finalReport}</Text>
              </View>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => Clipboard.setStringAsync(session.finalReport).catch(() => undefined)}
              >
                <Text style={styles.secondaryButtonText}>COPY MARKDOWN</Text>
              </Pressable>
            </>
          )}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!currentModule) {
    return null;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Header onReset={resetInterview} />
          <Text style={styles.sectionEyebrow}>
            Section {session.moduleIndex + 1} of {GUIDE_MODULES.length}
          </Text>
          <Text style={styles.title}>{currentModule.title}</Text>
          <Text style={styles.bodyText}>{currentModule.purpose}</Text>

          {session.phase === "open" ? (
            <OpenQuestion
              question={openQuestions[session.openIndex] ?? ""}
              index={session.openIndex + 1}
              total={openQuestions.length}
              draft={draft}
              listening={listening}
              onDraft={setDraft}
              onStartVoice={startVoice}
              onStopVoice={stopVoice}
              onNext={answerOpen}
            />
          ) : null}

          {session.phase === "rating" ? (
            <RatingQuestion
              question={ratingQuestions[session.ratingIndex] ?? ""}
              index={session.ratingIndex + 1}
              total={ratingQuestions.length}
              onAnswer={answerRating}
            />
          ) : null}

          {session.phase === "analyzing" ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Summarize and predict</Text>
              <Text style={styles.bodyText}>
                The app will summarize this section, predict the YES/NO calibration answers, then check whether those
                predictions align with you at 80% or better.
              </Text>
              {busy ? <ActivityIndicator size="large" /> : null}
              <Pressable style={styles.primaryButton} onPress={runModuleAnalysis} disabled={busy}>
                <Text style={styles.primaryButtonText}>TRAIN THIS SECTION</Text>
              </Pressable>
            </View>
          ) : null}

          {session.phase === "validate" ? (
            <YesNoQuestion
              question={yesNoQuestions[session.validateIndex] ?? ""}
              index={session.validateIndex + 1}
              total={yesNoQuestions.length}
              prediction={currentAnalysis?.predictedAnswers.find(
                (prediction) => prediction.question === yesNoQuestions[session.validateIndex]
              )}
              onAnswer={answerYesNo}
            />
          ) : null}

          {session.phase === "calibrate" ? (
            <OpenQuestion
              question="The app's predictions did not reach 80% agreement. What did it misunderstand? Add a correction, exception, or counterexample."
              index={1}
              total={1}
              draft={draft}
              listening={listening}
              onDraft={setDraft}
              onStartVoice={startVoice}
              onStopVoice={stopVoice}
              onNext={saveCalibration}
              buttonText="SAVE AND CONTINUE"
            />
          ) : null}

          {currentAnalysis ? (
            <View style={styles.analysisBox}>
              <Text style={styles.panelTitle}>Current section summary</Text>
              <Text style={styles.bodyText}>{currentAnalysis.summary}</Text>
              {typeof currentAnalysis.agreement === "number" ? (
                <Text style={styles.bodyText}>Prediction agreement: {Math.round(currentAnalysis.agreement * 100)}%</Text>
              ) : null}
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Header({ onReset }: { onReset: () => void }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Portrait Interview</Text>
        <Text style={styles.headerMeta}>Private prototype</Text>
      </View>
      <Pressable style={styles.resetButton} onPress={onReset}>
        <Text style={styles.resetButtonText}>RESET</Text>
      </Pressable>
    </View>
  );
}

function OpenQuestion({
  question,
  index,
  total,
  draft,
  listening,
  onDraft,
  onStartVoice,
  onStopVoice,
  onNext,
  buttonText = "NEXT"
}: {
  question: string;
  index: number;
  total: number;
  draft: string;
  listening: boolean;
  onDraft: (value: string) => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onNext: () => void;
  buttonText?: string;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.progressLabel}>
        Open question {index}/{total}
      </Text>
      <Text style={styles.question}>{question}</Text>
      <TextInput
        style={styles.textArea}
        value={draft}
        onChangeText={onDraft}
        placeholder="Type your answer, or use voice input."
        multiline
        textAlignVertical="top"
      />
      <View style={styles.voiceRow}>
        <Pressable style={[styles.voiceButton, listening && styles.voiceButtonActive]} onPress={listening ? onStopVoice : onStartVoice}>
          <Text style={styles.voiceButtonText}>{listening ? "STOP VOICE" : "VOICE INPUT"}</Text>
        </Pressable>
        <Pressable style={styles.primaryButtonSmall} onPress={onNext}>
          <Text style={styles.primaryButtonText}>{buttonText}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RatingQuestion({
  question,
  index,
  total,
  onAnswer
}: {
  question: string;
  index: number;
  total: number;
  onAnswer: (value: number) => void;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.progressLabel}>
        Scoring question {index}/{total}
      </Text>
      <Text style={styles.question}>{question}</Text>
      <View style={styles.signalRow}>
        {Array.from({ length: 10 }, (_, itemIndex) => {
          const value = itemIndex + 1;
          return (
            <Pressable
              key={value}
              accessibilityLabel={`Score ${value}`}
              style={[styles.signalButton, { height: 24 + value * 7 }]}
              onPress={() => onAnswer(value)}
            >
              <Text style={styles.signalText}>{value}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function YesNoQuestion({
  question,
  index,
  total,
  prediction,
  onAnswer
}: {
  question: string;
  index: number;
  total: number;
  prediction?: { predictedAnswer: boolean; rationale: string };
  onAnswer: (value: boolean) => void;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.progressLabel}>
        Calibration {index}/{total}
      </Text>
      <Text style={styles.question}>{question}</Text>
      {prediction ? (
        <View style={styles.prediction}>
          <Text style={styles.predictionText}>
            App prediction: {prediction.predictedAnswer ? "YES" : "NO"} · {prediction.rationale}
          </Text>
        </View>
      ) : null}
      <View style={styles.yesNoRow}>
        <Pressable style={[styles.macroButton, styles.yesButton]} onPress={() => onAnswer(true)}>
          <Text style={styles.macroButtonText}>YES</Text>
        </Pressable>
        <Pressable style={[styles.macroButton, styles.noButton]} onPress={() => onAnswer(false)}>
          <Text style={styles.macroButtonText}>NO</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7F5EF"
  },
  flex: {
    flex: 1
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  setup: {
    padding: 22,
    gap: 12
  },
  content: {
    padding: 18,
    gap: 14
  },
  appTitle: {
    color: "#16201C",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 39
  },
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerTitle: {
    color: "#17201B",
    fontSize: 18,
    fontWeight: "800"
  },
  headerMeta: {
    color: "#6A716B",
    fontSize: 12,
    marginTop: 2
  },
  resetButton: {
    borderWidth: 1,
    borderColor: "#C9CEC4",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#FFFFFF"
  },
  resetButtonText: {
    color: "#3C473F",
    fontSize: 12,
    fontWeight: "800"
  },
  sectionEyebrow: {
    color: "#866A28",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: "#17201B",
    fontSize: 29,
    lineHeight: 34,
    fontWeight: "800"
  },
  bodyText: {
    color: "#3B443E",
    fontSize: 16,
    lineHeight: 23
  },
  label: {
    color: "#27312B",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#C9CEC4",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    color: "#17201B",
    fontSize: 16
  },
  pickerFrame: {
    borderWidth: 1,
    borderColor: "#C9CEC4",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#FFFFFF"
  },
  notice: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D6C894",
    backgroundColor: "#FFF8D8",
    padding: 12
  },
  noticeText: {
    color: "#5E4B13",
    fontSize: 14,
    lineHeight: 20
  },
  panel: {
    borderWidth: 1,
    borderColor: "#D9DDD4",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 14
  },
  panelTitle: {
    color: "#17201B",
    fontSize: 18,
    fontWeight: "800"
  },
  progressLabel: {
    color: "#5D655F",
    fontSize: 13,
    fontWeight: "800"
  },
  question: {
    color: "#14201B",
    fontSize: 22,
    lineHeight: 29,
    fontWeight: "800"
  },
  textArea: {
    minHeight: 170,
    borderWidth: 1,
    borderColor: "#C9CEC4",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "#FBFCFA",
    color: "#17201B",
    fontSize: 16,
    lineHeight: 23
  },
  voiceRow: {
    flexDirection: "row",
    gap: 10
  },
  voiceButton: {
    minHeight: 52,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#57716A",
    backgroundColor: "#E7F0ED"
  },
  voiceButtonActive: {
    backgroundColor: "#CDE3DB",
    borderColor: "#274E43"
  },
  voiceButtonText: {
    color: "#1C4B3F",
    fontWeight: "900",
    fontSize: 14
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#1D4F43",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryButtonSmall: {
    minHeight: 52,
    flex: 1,
    borderRadius: 8,
    backgroundColor: "#1D4F43",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900"
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1D4F43",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#FFFFFF"
  },
  secondaryButtonText: {
    color: "#1D4F43",
    fontSize: 14,
    fontWeight: "900"
  },
  signalRow: {
    minHeight: 116,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 4
  },
  signalButton: {
    flex: 1,
    minWidth: 26,
    borderRadius: 7,
    backgroundColor: "#D88C4B",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 7
  },
  signalText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900"
  },
  prediction: {
    borderRadius: 8,
    backgroundColor: "#EEF4F6",
    borderWidth: 1,
    borderColor: "#C8D7DC",
    padding: 10
  },
  predictionText: {
    color: "#243D46",
    fontSize: 14,
    lineHeight: 19
  },
  yesNoRow: {
    flexDirection: "row",
    gap: 10
  },
  macroButton: {
    flex: 1,
    minHeight: 112,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  yesButton: {
    backgroundColor: "#1D6A58"
  },
  noButton: {
    backgroundColor: "#8A3E36"
  },
  macroButtonText: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900"
  },
  analysisBox: {
    borderWidth: 1,
    borderColor: "#D6C894",
    borderRadius: 8,
    backgroundColor: "#FFFDF0",
    padding: 14,
    gap: 8
  },
  reportBox: {
    borderWidth: 1,
    borderColor: "#D9DDD4",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 14
  },
  reportText: {
    color: "#17201B",
    fontSize: 15,
    lineHeight: 22
  },
  errorText: {
    color: "#9B2C22",
    fontSize: 14,
    lineHeight: 20
  }
});
