import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
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
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TextInput,
  View,
  ViewStyle
} from "react-native";
import { Picker } from "@react-native-picker/picker";

import { GUIDE_MODULES, SAFETY_BOUNDARY } from "./src/data/interviewGuide";
import { getProvider, PROVIDERS } from "./src/data/providers";
import { analyzeModule, effectiveModel, generateFinalReport, rephraseQuestion } from "./src/lib/ai";
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

const REVERSED_YES_NO_QUESTIONS: Record<string, string> = {
  "Do you often feel you matured earlier than others?": "Do you usually feel you developed at about the same pace as people around you?",
  "Do you find it difficult to accept being ordinary?": "Is being ordinary something you can usually accept without much inner conflict?",
  "Are you more motivated by challenge than comfort?": "Does comfort usually motivate you more than challenge?",
  "Is it hard for you to act against your principles?": "Is it usually easy for you to compromise your principles when the situation asks for it?",
  "Do you quickly notice hidden patterns?": "Do hidden patterns usually take you a while to notice?",
  "Do you become impatient with unclear logic?": "Can you usually stay patient when the logic is unclear?",
  "Do you often look calm outside but feel intense inside?": "Do your outward emotions usually match what you feel inside?",
  "Do you recover quickly after anger?": "Does anger usually stay with you for a long time?",
  "Under stress, do you carry things alone rather than ask for help?": "Under stress, do you usually ask for help instead of carrying things alone?",
  "Under stress, do you avoid tasks or people?": "Under stress, do you usually stay engaged with tasks and people?",
  "Do you dislike owing others favors?": "Are you generally comfortable owing others favors?",
  "Do you need a lot of personal space in close relationships?": "In close relationships, are you usually comfortable with very little personal space?",
  "Is it hard for you to follow authority you consider low-quality?": "Can you usually follow authority even when you consider it low-quality?",
  "Do you mentally rank people by competence?": "Do you usually avoid mentally comparing people by competence?",
  "Are you afraid of being seen as incompetent?": "Are you generally comfortable with others seeing your incompetence or inexperience?",
  "Do you use achievement to prove your worth?": "Is your sense of worth usually separate from achievement?",
  "Are you willing to admit blind spots?": "Is it usually hard for you to admit blind spots?",
  "Do you prefer discovering things yourself rather than being told?": "Do you usually prefer being told directly rather than discovering things yourself?"
};

const ORIGINAL_BY_REVERSED_YES_NO = Object.fromEntries(
  Object.entries(REVERSED_YES_NO_QUESTIONS).map(([original, reversed]) => [reversed, original])
) as Record<string, string>;

const yesNoQuestionsFor = (moduleIndex: number) =>
  GUIDE_MODULES[moduleIndex]?.calibrationQuestions
    .filter((question) => !isRatingQuestion(question))
    .map((question, index) => (index % 2 === 1 ? REVERSED_YES_NO_QUESTIONS[question] ?? question : question)) ?? [];

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
          const originalQuestion = ORIGINAL_BY_REVERSED_YES_NO[question];
          const foundOriginal = originalQuestion
            ? analysis.predictedAnswers.find((prediction) => prediction.question === originalQuestion)
            : undefined;
          return (
            found ??
            (foundOriginal
              ? {
                  question,
                  predictedAnswer: !foundOriginal.predictedAnswer,
                  rationale: `Reverse-worded calibration of: ${foundOriginal.rationale}`
                }
              : {
              question,
              predictedAnswer: index % 2 === 0,
              rationale: "Fallback prediction because the model did not return this item."
                })
          );
        })
      : yesNoQuestions.map((question, index) => ({
          question,
          predictedAnswer: ORIGINAL_BY_REVERSED_YES_NO[question] ? false : index % 2 === 0,
          rationale: "Fallback prediction because the model did not return calibration answers."
        }))
});

const predictionForAnsweredQuestion = (predictions: ModuleAnalysis["predictedAnswers"], question: string) => {
  const exact = predictions.find((item) => item.question === question);
  if (exact) {
    return exact;
  }
  const originalQuestion = ORIGINAL_BY_REVERSED_YES_NO[question];
  const original = originalQuestion ? predictions.find((item) => item.question === originalQuestion) : undefined;
  return original ? { ...original, question, predictedAnswer: !original.predictedAnswer } : undefined;
};

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
      predictedAnswer: ORIGINAL_BY_REVERSED_YES_NO[question] ? avgRating < 6 : avgRating >= 6,
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

const localRephraseQuestion = (question: string, kind: QuestionKind) => {
  if (kind === "rating") {
    return `On the same 1 to 10 scale, where 1 means very low and 10 means very high: ${question.replace(/^From 1 to 10,\s*/i, "")}`;
  }
  if (kind === "yesno") {
    return `Thinking about your usual real-life behavior, would your honest answer be YES or NO: ${question}`;
  }
  return `Said another way, with a specific example if one comes to mind: ${question}`;
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
  const [questionVariants, setQuestionVariants] = useState<Record<string, string>>({});
  const [rephrasingKey, setRephrasingKey] = useState("");

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
      const prediction = predictionForAnsweredQuestion(predictions, answer.question);
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

  const copyReport = async () => {
    if (!session.finalReport) {
      return;
    }
    setError("");
    try {
      await Clipboard.setStringAsync(session.finalReport);
      Alert.alert("Copied", "Markdown report copied to clipboard.");
    } catch (copyError) {
      const detail = copyError instanceof Error ? copyError.message : "unknown error";
      setError(`Copy failed. Detail: ${detail}`);
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

  const editApiSettings = () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
    }
    setListening(false);
    setError("");
    setIsConfigured(false);
  };

  const displayQuestionFor = (key: string, question: string) => questionVariants[key] ?? question;

  const handleRephrase = async (key: string, question: string, kind: QuestionKind) => {
    if (!question || rephrasingKey) {
      return;
    }
    setRephrasingKey(key);
    setError("");
    const currentWording = displayQuestionFor(key, question);
    try {
      const nextWording = await rephraseQuestion(config, { question, previousWording: currentWording, kind });
      setQuestionVariants((previous) => ({ ...previous, [key]: nextWording || localRephraseQuestion(question, kind) }));
    } catch (rephraseError) {
      const detail = rephraseError instanceof Error ? rephraseError.message : "unknown error";
      setQuestionVariants((previous) => ({ ...previous, [key]: localRephraseQuestion(question, kind) }));
      setError(`Question re-phrase used a local fallback. Detail: ${detail}`);
    } finally {
      setRephrasingKey("");
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

          <FeedbackButton style={styles.primaryButton} onPress={saveConfig} textStyle={styles.primaryButtonText}>
            START INTERVIEW
          </FeedbackButton>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (session.moduleIndex >= GUIDE_MODULES.length || session.phase === "complete") {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content}>
          <Header onReset={resetInterview} onEditConfig={editApiSettings} />
          <Text style={styles.sectionEyebrow}>Complete</Text>
          <Text style={styles.title}>Final Results</Text>
          <Text style={styles.bodyText}>
            The report is evidence-linked and intentionally non-diagnostic. You can copy it as Markdown.
          </Text>
          {busy ? <ActivityIndicator size="large" /> : null}
          {!session.finalReport ? (
            <FeedbackButton style={styles.primaryButton} onPress={generateReport} disabled={busy} textStyle={styles.primaryButtonText}>
              GENERATE REPORT
            </FeedbackButton>
          ) : (
            <>
              <View style={styles.reportBox}>
                <Text style={styles.reportText}>{session.finalReport}</Text>
              </View>
              <FeedbackButton
                style={styles.secondaryButton}
                textStyle={styles.secondaryButtonText}
                onPress={copyReport}
              >
                COPY MARKDOWN
              </FeedbackButton>
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

  const openQuestion = openQuestions[session.openIndex] ?? "";
  const openQuestionKey = questionId(currentModule.id, "open", session.openIndex);
  const ratingQuestion = ratingQuestions[session.ratingIndex] ?? "";
  const ratingQuestionKey = questionId(currentModule.id, "rating", session.ratingIndex);
  const yesNoQuestion = yesNoQuestions[session.validateIndex] ?? "";
  const yesNoQuestionKey = questionId(currentModule.id, "yesno", session.validateIndex);
  const calibrationQuestion =
    "The app's predictions did not reach 80% agreement. What did it misunderstand? Add a correction, exception, or counterexample.";
  const calibrationQuestionKey = `${currentModule.id}:calibrate:0`;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Header onReset={resetInterview} onEditConfig={editApiSettings} />
          <Text style={styles.sectionEyebrow}>
            Section {session.moduleIndex + 1} of {GUIDE_MODULES.length}
          </Text>
          <Text style={styles.title}>{currentModule.title}</Text>
          <Text style={styles.bodyText}>{currentModule.purpose}</Text>

          {session.phase === "open" ? (
            <OpenQuestion
              question={displayQuestionFor(openQuestionKey, openQuestion)}
              index={session.openIndex + 1}
              total={openQuestions.length}
              draft={draft}
              listening={listening}
              onDraft={setDraft}
              onStartVoice={startVoice}
              onStopVoice={stopVoice}
              onNext={answerOpen}
              onRephrase={() => handleRephrase(openQuestionKey, openQuestion, "open")}
              rephraseBusy={rephrasingKey === openQuestionKey}
            />
          ) : null}

          {session.phase === "rating" ? (
            <RatingQuestion
              question={displayQuestionFor(ratingQuestionKey, ratingQuestion)}
              index={session.ratingIndex + 1}
              total={ratingQuestions.length}
              onAnswer={answerRating}
              onRephrase={() => handleRephrase(ratingQuestionKey, ratingQuestion, "rating")}
              rephraseBusy={rephrasingKey === ratingQuestionKey}
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
              <FeedbackButton style={styles.primaryButton} onPress={runModuleAnalysis} disabled={busy} textStyle={styles.primaryButtonText}>
                TRAIN THIS SECTION
              </FeedbackButton>
            </View>
          ) : null}

          {session.phase === "validate" ? (
            <YesNoQuestion
              question={displayQuestionFor(yesNoQuestionKey, yesNoQuestion)}
              index={session.validateIndex + 1}
              total={yesNoQuestions.length}
              onAnswer={answerYesNo}
              onRephrase={() => handleRephrase(yesNoQuestionKey, yesNoQuestion, "yesno")}
              rephraseBusy={rephrasingKey === yesNoQuestionKey}
            />
          ) : null}

          {session.phase === "calibrate" ? (
            <OpenQuestion
              question={displayQuestionFor(calibrationQuestionKey, calibrationQuestion)}
              index={1}
              total={1}
              draft={draft}
              listening={listening}
              onDraft={setDraft}
              onStartVoice={startVoice}
              onStopVoice={stopVoice}
              onNext={saveCalibration}
              onRephrase={() => handleRephrase(calibrationQuestionKey, calibrationQuestion, "open")}
              rephraseBusy={rephrasingKey === calibrationQuestionKey}
              buttonText="SAVE AND CONTINUE"
            />
          ) : null}

          {currentAnalysis && session.phase !== "validate" ? (
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

function FeedbackButton({
  children,
  onPress,
  style,
  pressedStyle,
  textStyle,
  disabled = false,
  accessibilityLabel
}: {
  children: string;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel || children}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        style,
        pressed && !disabled ? pressedStyle ?? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null
      ]}
    >
      <Text style={textStyle}>{children}</Text>
    </Pressable>
  );
}

function Header({ onReset, onEditConfig }: { onReset: () => void; onEditConfig: () => void }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>Portrait Interview</Text>
        <Text style={styles.headerMeta}>Private prototype</Text>
      </View>
      <View style={styles.headerActions}>
        <FeedbackButton style={styles.resetButton} onPress={onEditConfig} textStyle={styles.resetButtonText}>
          API SETUP
        </FeedbackButton>
        <FeedbackButton style={styles.resetButton} onPress={onReset} textStyle={styles.resetButtonText}>
          RESET
        </FeedbackButton>
      </View>
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
  onRephrase,
  rephraseBusy,
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
  onRephrase: () => void;
  rephraseBusy: boolean;
  buttonText?: string;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.progressLabel}>
        Open question {index}/{total}
      </Text>
      <Text style={styles.question}>{question}</Text>
      <FeedbackButton style={styles.rephraseButton} onPress={onRephrase} disabled={rephraseBusy} textStyle={styles.rephraseButtonText}>
        {rephraseBusy ? "RE-PHRASING..." : "RE-PHRASE"}
      </FeedbackButton>
      <TextInput
        style={styles.textArea}
        value={draft}
        onChangeText={onDraft}
        placeholder="Type your answer, or use voice input."
        multiline
        textAlignVertical="top"
      />
      <View style={styles.voiceRow}>
        <FeedbackButton
          style={[styles.voiceButton, listening && styles.voiceButtonActive]}
          onPress={listening ? onStopVoice : onStartVoice}
          textStyle={styles.voiceButtonText}
        >
          {listening ? "STOP VOICE" : "VOICE INPUT"}
        </FeedbackButton>
        <FeedbackButton style={styles.primaryButtonSmall} onPress={onNext} textStyle={styles.primaryButtonText}>
          {buttonText}
        </FeedbackButton>
      </View>
    </View>
  );
}

function RatingQuestion({
  question,
  index,
  total,
  onAnswer,
  onRephrase,
  rephraseBusy
}: {
  question: string;
  index: number;
  total: number;
  onAnswer: (value: number) => void;
  onRephrase: () => void;
  rephraseBusy: boolean;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.progressLabel}>
        Scoring question {index}/{total}
      </Text>
      <Text style={styles.question}>{question}</Text>
      <FeedbackButton style={styles.rephraseButton} onPress={onRephrase} disabled={rephraseBusy} textStyle={styles.rephraseButtonText}>
        {rephraseBusy ? "RE-PHRASING..." : "RE-PHRASE"}
      </FeedbackButton>
      <View style={styles.signalRow}>
        {Array.from({ length: 10 }, (_, itemIndex) => {
          const value = itemIndex + 1;
          return (
            <Pressable
              key={value}
              accessibilityLabel={`Score ${value}`}
              style={({ pressed }) => [
                styles.signalButton,
                { height: 24 + value * 7 },
                pressed ? styles.signalButtonPressed : null
              ]}
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
  onAnswer,
  onRephrase,
  rephraseBusy
}: {
  question: string;
  index: number;
  total: number;
  onAnswer: (value: boolean) => void;
  onRephrase: () => void;
  rephraseBusy: boolean;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.progressLabel}>
        Calibration {index}/{total}
      </Text>
      <Text style={styles.question}>{question}</Text>
      <View style={styles.yesNoRow}>
        <FeedbackButton
          style={[styles.macroButton, styles.yesButton]}
          pressedStyle={styles.yesButtonPressed}
          onPress={() => onAnswer(true)}
          textStyle={styles.macroButtonText}
        >
          YES
        </FeedbackButton>
        <FeedbackButton
          style={[styles.macroButton, styles.noButton]}
          pressedStyle={styles.noButtonPressed}
          onPress={() => onAnswer(false)}
          textStyle={styles.macroButtonText}
        >
          NO
        </FeedbackButton>
      </View>
      <FeedbackButton style={styles.rephraseButton} onPress={onRephrase} disabled={rephraseBusy} textStyle={styles.rephraseButtonText}>
        {rephraseBusy ? "RE-PHRASING..." : "RE-PHRASE"}
      </FeedbackButton>
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
  headerActions: {
    flexDirection: "row",
    gap: 8
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
  buttonPressed: {
    backgroundColor: "#C9D8D3",
    borderColor: "#214F43",
    transform: [{ scale: 0.98 }]
  },
  buttonDisabled: {
    opacity: 0.55
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
  rephraseButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#9CA79D",
    backgroundColor: "#F3F6F2",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  rephraseButtonText: {
    color: "#33443A",
    fontSize: 13,
    fontWeight: "900"
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
  signalButtonPressed: {
    backgroundColor: "#AA6630",
    transform: [{ scaleY: 0.96 }]
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
  yesButtonPressed: {
    backgroundColor: "#0E493B",
    transform: [{ scale: 0.98 }]
  },
  noButton: {
    backgroundColor: "#8A3E36"
  },
  noButtonPressed: {
    backgroundColor: "#693029",
    transform: [{ scale: 0.98 }]
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
