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
import { analyzeModule, effectiveModel, generateFinalReport, generateMbtiAssessment, rephraseQuestion } from "./src/lib/ai";
import { Answer, AppConfig, MbtiAssessment, MbtiDimension, ModuleAnalysis, QuestionKind, SessionState } from "./src/types";

const CONFIG_KEY = "portrait-app-config";
const SESSION_KEY = "portrait-app-session";
const LANGUAGE_KEY = "portrait-app-language";
const REPORT_DISCLAIMER =
  "***Reference only. This result is for self-reflection and the app is not responsible for decisions, outcomes, or interpretations based on it.***";
const REPORT_DISCLAIMER_ZH = "***仅供参考。本结果只用于自我反思，应用不对基于本结果作出的决定、后果或解释负责。***";
const RADAR_SIZE = 250;

type AppLanguage = "en" | "zh";

const COPY = {
  en: {
    languageButton: "中文",
    safetyBoundary: SAFETY_BOUNDARY,
    apiCompany: "API company",
    model: "Model",
    customModel: "Custom model override",
    optionalModel: "Optional exact model id",
    apiKey: "API key",
    required: "Required",
    optional: "Optional",
    baseUrl: "Base URL",
    apiNotice: "API keys stay in local device storage for this prototype. For a public app, use a backend proxy instead.",
    costNotice: "Cost reference: if you use claude-sonnet-4-6 for a complete run, expect roughly $0.50 in API usage. Actual cost depends on answer length and provider pricing.",
    localModeNotice: "No API key? Choose Free Local. The full interview, local summary, MBTI page, and polygon charts work on-device with no cloud model. Add an API key only when you want richer AI wording.",
    apiOptionalNotice: "For paid providers, API key is optional. If left blank, MagicMirror automatically uses Free Local mode for summaries and results.",
    localProviderName: "Free Local",
    startInterview: "START INTERVIEW",
    complete: "Complete",
    finalResults: "Final Results",
    finalIntro: "The report is evidence-linked and intentionally non-diagnostic. You can copy it as Markdown.",
    generateReport: "GENERATE REPORT",
    summary: "SUMMARY",
    mbti: "MBTI",
    polygon: "POLYGON",
    copyMarkdown: "COPY MARKDOWN",
    regenerateResults: "REGENERATE RESULTS",
    portraitInterview: "Portrait Interview",
    privatePrototype: "Private prototype",
    apiSetup: "API SETUP",
    reset: "RESET",
    summarizeTitle: "Summarize and predict",
    summarizeBody: "The app will summarize this section, predict the YES/NO calibration answers, then check whether those predictions align with you at 80% or better.",
    trainSection: "TRAIN THIS SECTION",
    currentSummary: "Current section summary",
    predictionAgreement: "Prediction agreement",
    openQuestion: "Open question",
    scoringQuestion: "Scoring question",
    calibration: "Calibration",
    yes: "YES",
    no: "NO",
    section: "Section",
    of: "of",
    reportDisclaimer: REPORT_DISCLAIMER,
    lowConfidence: "low",
    mediumConfidence: "medium",
    highConfidence: "high",
    confidence: "Confidence",
    leans: "Leans",
    mbtiMissing: "MBTI assessment has not been generated yet.",
    polygonMissing: "Generate or regenerate the summary first to create polygon charts.",
    rephrase: "RE-PHRASE",
    rephrasing: "RE-PHRASING...",
    voiceInput: "VOICE INPUT",
    stopVoice: "STOP VOICE",
    next: "NEXT",
    saveContinue: "SAVE AND CONTINUE",
    answerPlaceholder: "Type your answer, or use voice input.",
    summaryPolygon: "Summary Polygon",
    polygonHelp: "The overview chart has one vertex per summary section. Each section chart uses bold sub-items first, then bullet items when bold sub-items are not present.",
    overallSections: "Overall sections",
    copiedTitle: "Copied",
    copiedBody: "Markdown report copied to clipboard.",
    resetTitle: "Reset interview?",
    resetBody: "This clears all answers and generated reports on this device.",
    cancel: "Cancel",
    answerNeededTitle: "Answer needed",
    answerNeededBody: "Please type or speak an answer before continuing.",
    correctionNeededTitle: "Correction needed",
    correctionNeededBody: "Please add what the app misunderstood before moving on.",
    permissionTitle: "Permission needed",
    permissionBody: "Microphone and speech-recognition permission are needed for voice input.",
    apiKeyRequiredTitle: "API key required",
    apiKeyRequiredBody: "needs an API key before the interview can use AI summaries.",
    modelAnalysisFallback: "Model analysis failed, so the app used local fallback predictions.",
    reportFallback: "Model report failed, so the app generated a local draft.",
    mbtiFallback: "MBTI assessment used a local fallback.",
    rephraseFallback: "Question re-phrase used a local fallback.",
    copyFailed: "Copy failed.",
    voiceFailed: "Could not start voice input.",
    detail: "Detail",
    appTitle: "MagicMirror"
  },
  zh: {
    languageButton: "EN",
    safetyBoundary: "本应用仅用于自我反思，不用于诊断、分类，也不能替代可信任的人、紧急服务或持证专业人士的支持。",
    apiCompany: "API 公司",
    model: "模型",
    customModel: "自定义模型覆盖",
    optionalModel: "可选，填写精确模型 ID",
    apiKey: "API key",
    required: "必填",
    optional: "可选",
    baseUrl: "Base URL",
    apiNotice: "此原型会把 API key 保存在本机设备存储中。正式公开发布时应使用后端代理。",
    costNotice: "费用参考：如果使用 claude-sonnet-4-6 跑完整流程，大约消耗 $0.50 API 费用。实际费用会随回答长度和供应商价格变化。",
    localModeNotice: "没有 API key 也可以使用：选择 Free Local，完整访谈、本地总结、MBTI 页面和多边形图都在本机规则模式下运行。只有想要更细腻的 AI 文案时才需要填写 API key。",
    apiOptionalNotice: "付费 provider 的 API key 也是可选的。如果留空，MagicMirror 会自动使用免费本地模式生成总结和结果。",
    localProviderName: "免费本地模式",
    startInterview: "开始访谈",
    complete: "完成",
    finalResults: "最终结果",
    finalIntro: "报告会尽量基于证据，并且不是诊断。你可以复制为 Markdown。",
    generateReport: "生成报告",
    summary: "总结",
    mbti: "MBTI",
    polygon: "多边形",
    copyMarkdown: "复制 Markdown",
    regenerateResults: "重新生成结果",
    portraitInterview: "画像访谈",
    privatePrototype: "本机原型",
    apiSetup: "API 设置",
    reset: "重置",
    summarizeTitle: "总结并预测",
    summarizeBody: "应用会总结本节，预测是/否校准答案，然后检查预测与你的回答是否达到 80% 或以上一致。",
    trainSection: "训练本节",
    currentSummary: "当前章节总结",
    predictionAgreement: "预测一致率",
    openQuestion: "开放题",
    scoringQuestion: "评分题",
    calibration: "校准",
    yes: "是",
    no: "否",
    section: "第",
    of: "节，共",
    reportDisclaimer: REPORT_DISCLAIMER_ZH,
    lowConfidence: "低",
    mediumConfidence: "中",
    highConfidence: "高",
    confidence: "置信度",
    leans: "倾向",
    mbtiMissing: "尚未生成 MBTI 评估。",
    polygonMissing: "请先生成或重新生成总结，以创建多边形图。",
    rephrase: "换个问法",
    rephrasing: "改写中...",
    voiceInput: "语音输入",
    stopVoice: "停止语音",
    next: "下一步",
    saveContinue: "保存并继续",
    answerPlaceholder: "输入你的回答，或使用语音输入。",
    summaryPolygon: "总结多边形",
    polygonHelp: "总图的顶点对应 summary 里的每个章节。每个章节图优先使用粗体 sub-item；如果没有粗体 sub-item，则使用 bullet 条目。",
    overallSections: "总览章节",
    copiedTitle: "已复制",
    copiedBody: "Markdown 报告已复制到剪贴板。",
    resetTitle: "重置访谈？",
    resetBody: "这会清除本设备上的所有回答和生成报告。",
    cancel: "取消",
    answerNeededTitle: "需要回答",
    answerNeededBody: "继续前请先输入或语音回答。",
    correctionNeededTitle: "需要校正",
    correctionNeededBody: "请补充应用误解了什么，再继续下一节。",
    permissionTitle: "需要权限",
    permissionBody: "语音输入需要麦克风和语音识别权限。",
    apiKeyRequiredTitle: "需要 API key",
    apiKeyRequiredBody: "需要 API key，访谈才能使用 AI 总结。",
    modelAnalysisFallback: "模型分析失败，应用已使用本地 fallback 预测。",
    reportFallback: "模型报告失败，应用已生成本地草稿。",
    mbtiFallback: "MBTI 评估已使用本地 fallback。",
    rephraseFallback: "问题改写已使用本地 fallback。",
    copyFailed: "复制失败。",
    voiceFailed: "无法启动语音输入。",
    detail: "详情",
    appTitle: "MagicMirror"
  }
};

type CopyText = { [K in keyof typeof COPY.en]: string };

type PolygonItem = {
  label: string;
  score: number;
  detail: string;
};

type PolygonSection = {
  title: string;
  score: number;
  items: PolygonItem[];
};

const defaultConfig: AppConfig = {
  providerId: "local",
  model: "local-rules",
  customModel: "",
  apiKey: "",
  baseUrl: ""
};

const defaultSession: SessionState = {
  moduleIndex: 0,
  phase: "open",
  openIndex: 0,
  ratingIndex: 0,
  validateIndex: 0,
  answers: [],
  analyses: [],
  finalReport: "",
  mbtiAssessment: null
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

const ZH_DISPLAY_TEXT: Record<string, string> = {
  "Life Narrative": "人生叙事",
  "Understand how the person tells the story of their life.": "理解这个人如何讲述自己的人生故事。",
  "If you had to divide your life so far into three chapters, what would those chapters be?": "如果把你到目前为止的人生分成三个章节，它们分别会是什么？",
  "What has been the most important turning point in your life?": "你人生中最重要的转折点是什么？",
  "What theme has repeated itself throughout your life?": "在你的人生里，反复出现的主题是什么？",
  "What do you feel you have been fighting against or trying to overcome?": "你觉得自己一直在对抗或试图克服什么？",
  "What part of you do you most wish other people could truly understand?": "你最希望别人真正理解你的哪一部分？",
  "Can you describe a specific moment that shows this?": "你能描述一个能体现这一点的具体时刻吗？",
  "What changed after that event?": "那件事之后发生了什么变化？",
  "What was the strongest emotion at the time?": "当时最强烈的情绪是什么？",
  "Looking back, do you think your interpretation was accurate?": "回头看，你觉得当时自己的理解准确吗？",
  "Do you often feel different from people around you?": "你是否经常觉得自己和周围的人不一样？",
  "Do you often feel you matured earlier than others?": "你是否经常觉得自己比别人更早成熟？",
  "Do you often feel you need to prove something?": "你是否经常觉得自己需要证明什么？",
  "From 1 to 10, how much of your life feels self-directed?": "从 1 到 10，你觉得自己的人生有多大程度是由自己主导的？",
  "From 1 to 10, how important is it for you to be deeply understood?": "从 1 到 10，被深度理解对你有多重要？",
  "Do you usually feel you developed at about the same pace as people around you?": "你通常觉得自己的成长节奏和周围人差不多吗？",

  "Core Motivation": "核心动机",
  "Identify what drives the person and what they most want to avoid.": "识别驱动这个人的因素，以及他们最想避免什么。",
  "When you work hard for something important, what are you usually trying to gain?": "当你为重要的事情努力时，你通常想获得什么？",
  "What are you usually trying to avoid?": "你通常想避免什么？",
  "What kind of success would feel truly meaningful to you?": "什么样的成功会让你觉得真正有意义？",
  "What kind of compliment matters most to you?": "哪种赞美对你最重要？",
  "What kind of criticism hurts most?": "哪种批评最容易伤到你？",
  "Can you give a recent example?": "你能举一个最近的例子吗？",
  "If nobody recognized the outcome, would you still want it?": "如果没有人认可结果，你还会想要它吗？",
  "What do you fear losing?": "你害怕失去什么？",
  "Does this motivation energize you or exhaust you?": "这种动机让你更有能量，还是让你感到消耗？",
  "Do you often fear wasting your potential?": "你是否经常害怕浪费自己的潜力？",
  "Do you find it difficult to accept being ordinary?": "你是否觉得接受平凡很困难？",
  "Do you often compare yourself with high-achieving people?": "你是否经常把自己和高成就者比较？",
  "Are you more motivated by challenge than comfort?": "相比舒适，你是否更容易被挑战激励？",
  "From 1 to 10, how strong is your need for achievement?": "从 1 到 10，你的成就需求有多强？",
  "From 1 to 10, how strong is your need for freedom?": "从 1 到 10，你的自由需求有多强？",
  "From 1 to 10, how strong is your need for recognition?": "从 1 到 10，你的被认可需求有多强？",
  "Is being ordinary something you can usually accept without much inner conflict?": "你通常能接受平凡而不产生太多内心冲突吗？",
  "Does comfort usually motivate you more than challenge?": "舒适通常比挑战更能激励你吗？",

  "Values": "价值观",
  "Understand what the person prioritizes when choices involve trade-offs.": "理解当选择涉及取舍时，这个人优先考虑什么。",
  "If you had to rank freedom, security, achievement, intimacy, and meaning, how would you rank them?": "如果要给自由、安全、成就、亲密和意义排序，你会怎么排？",
  "What kind of behavior do you most disrespect?": "你最不尊重哪类行为？",
  "What kind of person do you deeply respect?": "你深度尊重哪类人？",
  "When making a major decision, what usually makes the final decision clear?": "做重大决定时，通常是什么让最终选择变得清晰？",
  "What would you still do even if there were no external reward?": "即使没有外部奖励，你仍然会做什么？",
  "What is a recent decision that reflected this value?": "最近有什么决定体现了这个价值观？",
  "Did this value cost you anything?": "这个价值观让你付出过什么代价吗？",
  "Would you still choose it if it cost money, status, or a relationship?": "如果它会让你付出金钱、地位或关系代价，你还会选择它吗？",
  "Has this value changed over time?": "这个价值观随时间改变过吗？",
  "Are you willing to tolerate short-term discomfort for long-term goals?": "你是否愿意为了长期目标忍受短期不适？",
  "Is it hard for you to act against your principles?": "违背原则行事对你来说困难吗？",
  "Are you especially sensitive to inefficiency, hypocrisy, or low standards?": "你是否特别敏感于低效、虚伪或低标准？",
  "From 1 to 10, how much do you value security?": "从 1 到 10，你有多重视安全感？",
  "From 1 to 10, how much do you value influence?": "从 1 到 10，你有多重视影响力？",
  "From 1 to 10, how much do you value inner freedom?": "从 1 到 10，你有多重视内在自由？",
  "Is it usually easy for you to compromise your principles when the situation asks for it?": "当情境要求时，你通常容易妥协自己的原则吗？",

  "Cognitive Style": "认知风格",
  "Understand how the person thinks, learns, judges, and solves problems.": "理解这个人如何思考、学习、判断和解决问题。",
  "When you face a complex problem, what do you usually do first?": "面对复杂问题时，你通常第一步会做什么？",
  "Do you trust data, intuition, experience, or feedback most?": "你最信任数据、直觉、经验还是反馈？",
  "What kind of problem are you naturally good at solving?": "你天然擅长解决哪类问题？",
  "What kind of problem drains you?": "哪类问题会让你感到耗能？",
  "When do you feel that other people are thinking too shallowly?": "什么时候你会觉得别人想得太浅？",
  "Can you describe a recent problem you solved?": "你能描述一个最近解决的问题吗？",
  "What was your first hypothesis?": "你的第一个假设是什么？",
  "Did you revise your initial judgment?": "你后来修正过最初的判断吗？",
  "How did you know your solution was working?": "你如何知道自己的方案正在起作用？",
  "Do you often build mental models or systems?": "你是否经常建立心智模型或系统？",
  "Do you quickly notice hidden patterns?": "你是否很快注意到隐藏模式？",
  "Do you dislike repetitive, low-creativity tasks?": "你是否不喜欢重复、低创造性的任务？",
  "Do you become impatient with unclear logic?": "面对不清晰的逻辑，你是否会不耐烦？",
  "From 1 to 10, how much do you rely on intuition?": "从 1 到 10，你有多依赖直觉？",
  "From 1 to 10, how much do you rely on evidence?": "从 1 到 10，你有多依赖证据？",
  "Do hidden patterns usually take you a while to notice?": "隐藏模式通常需要你花一段时间才会注意到吗？",
  "Can you usually stay patient when the logic is unclear?": "当逻辑不清楚时，你通常能保持耐心吗？",

  "Emotional Pattern": "情绪模式",
  "Understand what triggers the person emotionally and how they regulate emotion.": "理解什么会触发这个人的情绪，以及他们如何调节情绪。",
  "When was the last time your emotions changed noticeably?": "最近一次你的情绪明显变化是什么时候？",
  "What most easily irritates you?": "什么最容易让你烦躁？",
  "What most easily hurts you?": "什么最容易伤到你？",
  "When you are angry, do you express it, suppress it, or redirect it?": "生气时，你会表达、压抑，还是转移它？",
  "How do you usually recover from a low point?": "你通常如何从低谷中恢复？",
  "What happened right before the emotion appeared?": "情绪出现前发生了什么？",
  "What did you feel in your body?": "你身体上有什么感受？",
  "Did you express it immediately?": "你当时立刻表达了吗？",
  "Does this emotional pattern repeat?": "这种情绪模式会重复出现吗？",
  "Can one sentence from someone affect your mood strongly?": "别人的一句话是否会强烈影响你的心情？",
  "Do you often look calm outside but feel intense inside?": "你是否经常外表平静，但内心强烈？",
  "Do you dislike showing vulnerability?": "你是否不喜欢展示脆弱？",
  "Do you recover quickly after anger?": "生气之后你是否恢复得很快？",
  "From 1 to 10, how intense are your emotional reactions?": "从 1 到 10，你的情绪反应有多强烈？",
  "From 1 to 10, how difficult is it for you to express emotion?": "从 1 到 10，表达情绪对你有多困难？",
  "Do your outward emotions usually match what you feel inside?": "你的外在情绪通常和内心感受一致吗？",
  "Does anger usually stay with you for a long time?": "愤怒通常会在你心里停留很久吗？",

  "Stress Response": "压力反应",
  "Understand how the person behaves when resources, time, certainty, or control are limited.": "理解当资源、时间、确定性或控制感有限时，这个人如何行动。",
  "What was the most stressful period of your life?": "你人生中压力最大的阶段是什么？",
  "When pressure arrives, what is your first reaction?": "压力来临时，你的第一反应是什么？",
  "Under pressure, do you become more efficient or more disorganized?": "在压力下，你会更高效还是更混乱？",
  "What do you do when plans fall apart?": "计划崩掉时，你会怎么做？",
  "Under what conditions do you avoid or procrastinate?": "在什么情况下你会逃避或拖延？",
  "Did you become more controlling, impatient, detached, or dependent?": "你会变得更控制、更不耐烦、更抽离，还是更依赖？",
  "Did others notice a change?": "别人注意到你的变化了吗？",
  "What support did you most need?": "你当时最需要什么支持？",
  "What eventually helped you recover?": "最终是什么帮助你恢复？",
  "Under stress, do you try to control details more?": "压力下，你是否会更想控制细节？",
  "Under stress, do you carry things alone rather than ask for help?": "压力下，你是否更倾向于独自扛着，而不是求助？",
  "Under stress, do you become more aggressive?": "压力下，你是否会更有攻击性？",
  "Under stress, do you avoid tasks or people?": "压力下，你是否会回避任务或人？",
  "From 1 to 10, how resilient are you under pressure?": "从 1 到 10，你在压力下有多有韧性？",
  "From 1 to 10, how easily do you lose patience under pressure?": "从 1 到 10，你在压力下有多容易失去耐心？",
  "Under stress, do you usually ask for help instead of carrying things alone?": "压力下，你通常会求助，而不是独自扛着吗？",
  "Under stress, do you usually stay engaged with tasks and people?": "压力下，你通常仍会投入任务和人际互动吗？",

  "Relationship Pattern": "关系模式",
  "Understand how the person forms trust, intimacy, boundaries, and connection.": "理解这个人如何建立信任、亲密、边界和连接。",
  "How do you decide whether someone is trustworthy?": "你如何判断一个人是否值得信任？",
  "What do you most need in relationships?": "你在关系中最需要什么？",
  "What are you most afraid someone might do to you emotionally?": "你最害怕别人对你造成什么情感上的影响？",
  "What kind of person do you easily become close to?": "你容易和哪类人亲近？",
  "Is there a relationship pattern that has repeated in your life?": "你的人生中是否有反复出现的关系模式？",
  "When was the last time a relationship became distant?": "最近一次关系变疏远是什么时候？",
  "What caused the distance?": "是什么导致了疏远？",
  "Did you try to repair it?": "你尝试修复过吗？",
  "Is it easy for you to express needs?": "表达需求对你来说容易吗？",
  "Is it hard for you to fully trust people?": "完全信任别人对你来说困难吗？",
  "Do you dislike owing others favors?": "你是否不喜欢欠别人人情？",
  "Is it easier for you to help others than ask for help?": "帮助别人是否比向别人求助更容易？",
  "Do you need a lot of personal space in close relationships?": "在亲密关系中，你是否需要大量个人空间？",
  "From 1 to 10, how strong is your need for closeness?": "从 1 到 10，你对亲近的需求有多强？",
  "From 1 to 10, how strong is your need for boundaries?": "从 1 到 10，你对边界的需求有多强？",
  "Are you generally comfortable owing others favors?": "你通常能坦然接受欠别人人情吗？",
  "In close relationships, are you usually comfortable with very little personal space?": "在亲密关系中，个人空间很少时你通常也舒服吗？",

  "Conflict, Authority, and Power": "冲突、权威与权力",
  "Understand how the person handles confrontation, hierarchy, competition, and control.": "理解这个人如何处理对抗、层级、竞争和控制。",
  "When someone is clearly better than you, what do you usually feel?": "当别人明显比你强时，你通常会有什么感受？",
  "When someone less competent tries to direct you, how do you react?": "当能力不如你的人试图指挥你时，你会怎么反应？",
  "How do you relate to authority?": "你如何看待和应对权威？",
  "When was the last time you had a conflict with someone?": "你最近一次和别人发生冲突是什么时候？",
  "In what areas do you have control needs?": "在哪些方面你有控制需求？",
  "Did you care more about truth, fairness, efficiency, status, or harmony?": "你当时更在意真相、公平、效率、地位还是和谐？",
  "Did you reflect on your own role afterward?": "事后你反思过自己在其中的角色吗？",
  "Did you suppress your real opinion?": "你压抑了真实意见吗？",
  "What would have made the conflict easier?": "什么会让那次冲突更容易处理？",
  "Do you dislike being managed by people you do not respect?": "你是否不喜欢被你不尊重的人管理？",
  "Is it hard for you to follow authority you consider low-quality?": "服从你认为低质量的权威对你来说困难吗？",
  "Does competition energize you?": "竞争会让你更有能量吗？",
  "Do you mentally rank people by competence?": "你是否会在心里按能力给人排序？",
  "From 1 to 10, how competitive are you?": "从 1 到 10，你有多好胜？",
  "From 1 to 10, how naturally obedient are you to authority?": "从 1 到 10，你对权威有多自然顺从？",
  "Can you usually follow authority even when you consider it low-quality?": "即使你认为权威质量不高，你通常也能服从吗？",
  "Do you usually avoid mentally comparing people by competence?": "你通常会避免在心里按能力比较别人吗？",

  "Self-Esteem and Vulnerability": "自尊与脆弱点",
  "Understand how the person protects self-worth and where they are most emotionally exposed.": "理解这个人如何保护自我价值，以及哪里最容易情感暴露。",
  "What most easily makes you feel not good enough?": "什么最容易让你觉得自己不够好？",
  "What part of yourself do you least want others to see?": "你最不想让别人看到自己的哪一部分？",
  "When do you feel underestimated?": "什么时候你会觉得自己被低估？",
  "What kind of judgment is hardest for you to accept?": "哪种评价最让你难以接受？",
  "Where does your confidence come from?": "你的自信来自哪里？",
  "When did this sensitivity begin?": "这种敏感是从什么时候开始的？",
  "Do you hide it or express it?": "你会隐藏它还是表达它？",
  "What happens when someone touches this vulnerable point?": "当别人触碰到这个脆弱点时，会发生什么？",
  "Does this vulnerability also motivate you?": "这个脆弱点也会激励你吗？",
  "Are you afraid of being ordinary?": "你害怕平凡吗？",
  "Are you afraid of being seen as incompetent?": "你害怕被别人看作无能吗？",
  "Are you afraid of being ignored?": "你害怕被忽视吗？",
  "Do you use achievement to prove your worth?": "你会用成就来证明自己的价值吗？",
  "From 1 to 10, how sensitive are you to criticism?": "从 1 到 10，你对批评有多敏感？",
  "From 1 to 10, how important is it to maintain a strong image?": "从 1 到 10，维持强大形象对你有多重要？",
  "Are you generally comfortable with others seeing your incompetence or inexperience?": "让别人看到你的不擅长或缺乏经验，你通常能接受吗？",
  "Is your sense of worth usually separate from achievement?": "你的价值感通常能和成就分开吗？",

  "Growth Direction and Blind Spots": "成长方向与盲点",
  "Understand maturity, self-awareness, recurring limitations, and development potential.": "理解成熟度、自我觉察、反复出现的限制和发展潜力。",
  "What is your greatest personality strength?": "你最大的性格优势是什么？",
  "What is the cost of that strength?": "这个优势的代价是什么？",
  "What do people close to you often remind you about?": "亲近的人经常提醒你什么？",
  "What pattern do you want to change but find difficult to change?": "你想改变但很难改变的模式是什么？",
  "If you became more mature in the next five years, what would change?": "如果未来五年你变得更成熟，会发生什么变化？",
  "Have you tried to change this before?": "你以前尝试改变过它吗？",
  "When is this problem most visible?": "这个问题在什么时候最明显？",
  "What does this pattern protect you from?": "这个模式在保护你免受什么？",
  "What would improvement look like in observable behavior?": "如果有进步，在可观察行为上会是什么样？",
  "Do you reflect on yourself often?": "你是否经常反思自己？",
  "Are you willing to admit blind spots?": "你是否愿意承认盲点？",
  "Is it hard for you to accept ordinary advice?": "接受普通建议对你来说困难吗？",
  "Do you prefer discovering things yourself rather than being told?": "相比别人直接告诉你，你是否更喜欢自己发现？",
  "From 1 to 10, how strong is your self-awareness?": "从 1 到 10，你的自我觉察有多强？",
  "From 1 to 10, how willing are you to change long-term patterns?": "从 1 到 10，你有多愿意改变长期模式？",
  "Is it usually hard for you to admit blind spots?": "承认盲点对你来说通常困难吗？",
  "Do you usually prefer being told directly rather than discovering things yourself?": "相比自己发现，你通常更喜欢别人直接告诉你吗？",

  "The app's predictions did not reach 80% agreement. What did it misunderstand? Add a correction, exception, or counterexample.": "应用预测没有达到 80% 一致率。它误解了什么？请补充一个修正、例外或反例。",
  "redemption narrative": "救赎叙事",
  "outsider narrative": "局外人叙事",
  "survival narrative": "生存叙事",
  "unresolved identity conflict": "未解决的身份冲突",
  "achievement motivation": "成就动机",
  "autonomy motivation": "自主动机",
  "recognition motivation": "认可动机",
  "fear of failure": "失败恐惧",
  "fear of dependence": "依赖恐惧",
  "freedom vs stability": "自由与稳定的取舍",
  "achievement vs peace": "成就与平静的取舍",
  "loyalty vs truth": "忠诚与真实的取舍",
  "efficiency vs empathy": "效率与共情的取舍",
  "analytical style": "分析型风格",
  "systems thinking": "系统思维",
  "divergent thinking": "发散思维",
  "tolerance for ambiguity": "对模糊性的容忍",
  "emotional suppression": "情绪压抑",
  "shame sensitivity": "羞耻敏感",
  "anger style": "愤怒风格",
  "need for solitude": "独处需求",
  "hidden vulnerability": "隐藏的脆弱",
  "fight response": "战斗反应",
  "withdrawal response": "退缩反应",
  "overwork response": "过度工作反应",
  "problem-solving response": "问题解决反应",
  "hidden cost of high performance": "高表现的隐性代价",
  "trust threshold": "信任阈值",
  "caretaker role": "照顾者角色",
  "distance-protection pattern": "距离保护模式",
  "relationship repair ability": "关系修复能力",
  "resistance to authority": "对权威的抵抗",
  "status sensitivity": "地位敏感",
  "competence sensitivity": "能力敏感",
  "conflict avoidance": "冲突回避",
  "need for control": "控制需求",
  "achievement-based self-worth": "基于成就的自我价值",
  "shame trigger": "羞耻触发点",
  "fear of exposure": "暴露恐惧",
  "fear of mediocrity": "平庸恐惧",
  "emotional armor": "情绪盔甲",
  "self-awareness": "自我觉察",
  "defensiveness": "防御性",
  "capacity for change": "改变能力",
  "rigidity": "僵化",
  "growth edge": "成长边界"
};

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

const localModuleAnalysis = (moduleIndex: number, moduleAnswers: Answer[], language: AppLanguage) => {
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
      language === "zh"
        ? textAnswers.length > 0
          ? `本节有 ${textAnswers.length} 条叙述性回答。由于模型访问不可用，本地总结只能作为暂定理解。`
          : "本节证据有限，因此解释应保持低置信度。"
        : textAnswers.length > 0
          ? `This section has ${textAnswers.length} narrative answer(s). The app needs model access for a richer interpretation, so this local summary treats patterns as tentative.`
          : "This section has limited evidence, so interpretations should remain low confidence.",
    observations: textAnswers.slice(0, 3),
    patterns:
      module?.detect.slice(0, 3).map((pattern) =>
        language === "zh" ? `可能存在：${displayForLanguage(pattern, language)}` : `Possible ${pattern}`
      ) ?? [],
    confidence: textAnswers.length >= 3 ? "medium" : "low",
    predictedAnswers: yesNoQuestions.map((question) => ({
      question,
      predictedAnswer: ORIGINAL_BY_REVERSED_YES_NO[question] ? avgRating < 6 : avgRating >= 6,
      rationale: language === "zh" ? "本地 fallback 主要基于评分强度。" : "Local fallback based mainly on scoring intensity."
    }))
  };
  return analysis;
};

const reportDisclaimerFor = (language: AppLanguage) => (language === "zh" ? REPORT_DISCLAIMER_ZH : REPORT_DISCLAIMER);

const localFinalReport = (session: SessionState, language: AppLanguage) => {
  const supported = session.analyses.flatMap((analysis) => analysis.patterns).slice(0, 8);
  const evidence = session.answers
    .filter((answer) => answer.kind === "open")
    .map((answer) => `- ${displayForLanguage(answer.question, language)}: ${String(answer.value).slice(0, 180)}`)
    .slice(0, 8)
    .join("\n");

  if (language === "zh") {
    return `${REPORT_DISCLAIMER_ZH}

# 人格画像

## 核心总结
这是本地草稿，因为模型报告生成不可用。最可靠的材料来自用户给出的具体例子，以及跨模块反复出现的模式。

## 主要驱动力
${supported.slice(0, 3).map((item) => `- ${displayForLanguage(item, language)}`).join("\n") || "- 证据不足"}

## 主要敏感点
${supported.slice(3, 6).map((item) => `- ${displayForLanguage(item, language)}`).join("\n") || "- 证据不足"}

## 思维风格
请结合“认知风格”模块，进行基于证据的谨慎理解。

## 情绪模式
请结合“情绪模式”模块，观察触发因素、表达方式和恢复方式。

## 关系模式
请结合“关系模式”模块，观察信任、亲密和边界。

## 压力模式
请结合“压力反应”模块，观察压力下的行为模式。

## 冲突与权威模式
请结合“冲突、权威与权力”模块，观察层级、尊重和控制相关模式。

## 优势
- 所有模式都应谨慎解释，并尽量连接到具体例子。

## 盲点
- 任何盲点都只是暂定判断，需要用户确认或修正。

## 核心内在冲突
需要模型综合或更多反思材料。

## 成长方向
可结合最后一个模块的回答，选择具体、可观察的下一步。

## 使用的证据
${evidence || "- 暂无开放题证据。"}

## 不确定性
本报告避免诊断和固定标签。更多反例和修正会提升准确性。
`;
  }

  return `${REPORT_DISCLAIMER}

# Personality Portrait

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

const ensureReportDisclaimer = (report: string, language: AppLanguage) => {
  const trimmed = report.trim();
  const disclaimer = reportDisclaimerFor(language);
  return trimmed.startsWith(disclaimer) ? trimmed : `${disclaimer}\n\n${trimmed}`;
};

const mbtiDimensionDefaults: MbtiDimension[] = [
  { key: "EI", leftLetter: "E", rightLetter: "I", leftScore: 50, chosenLetter: "E", rationale: [] },
  { key: "SN", leftLetter: "S", rightLetter: "N", leftScore: 50, chosenLetter: "S", rationale: [] },
  { key: "TF", leftLetter: "T", rightLetter: "F", leftScore: 50, chosenLetter: "T", rationale: [] },
  { key: "JP", leftLetter: "J", rightLetter: "P", leftScore: 50, chosenLetter: "J", rationale: [] }
];

const normalizeMbtiAssessment = (assessment: MbtiAssessment): MbtiAssessment => {
  const dimensions = mbtiDimensionDefaults.map((fallback) => {
    const found = assessment.dimensions.find((dimension) => dimension.key === fallback.key);
    const leftScore = Math.max(0, Math.min(100, Math.round(found?.leftScore ?? fallback.leftScore)));
    const chosenLetter = found?.chosenLetter || (leftScore >= 50 ? fallback.leftLetter : fallback.rightLetter);
    return {
      ...fallback,
      ...found,
      leftScore,
      chosenLetter,
      rationale: found?.rationale?.filter(Boolean).slice(0, 3) ?? fallback.rationale
    };
  });
  return {
    type: dimensions.map((dimension) => dimension.chosenLetter).join(""),
    confidence: assessment.confidence,
    summary: assessment.summary,
    dimensions
  };
};

const localMbtiAssessment = (session: SessionState, language: AppLanguage): MbtiAssessment => {
  const combined = [
    ...session.answers.map((answer) => `${answer.question} ${String(answer.value)}`),
    ...session.analyses.flatMap((analysis) => [analysis.summary, ...analysis.patterns, ...analysis.observations])
  ]
    .join(" ")
    .toLowerCase();
  const count = (words: string[]) => words.reduce((sum, word) => sum + (combined.includes(word) ? 1 : 0), 0);
  const score = (leftWords: string[], rightWords: string[]) => {
    const left = count(leftWords);
    const right = count(rightWords);
    if (left + right === 0) {
      return 50;
    }
    return Math.round((left / (left + right)) * 100);
  };
  const baseDimensions: MbtiDimension[] = [
    {
      key: "EI",
      leftLetter: "E",
      rightLetter: "I",
      leftScore: score(["people", "relationship", "express", "close", "feedback"], ["alone", "solitude", "private", "space", "inside"]),
      chosenLetter: "E",
      rationale: [
        language === "zh"
          ? "本地 fallback 根据回答中的社交能量、关系和私人空间相关语言进行估计。"
          : "Local fallback estimated this from social-energy and privacy language in the answers."
      ]
    },
    {
      key: "SN",
      leftLetter: "S",
      rightLetter: "N",
      leftScore: score(["specific", "concrete", "recent", "detail", "practical"], ["pattern", "meaning", "theme", "future", "abstract"]),
      chosenLetter: "S",
      rationale: [
        language === "zh"
          ? "本地 fallback 根据具体细节语言与模式、意义语言的比例进行估计。"
          : "Local fallback estimated this from concrete-detail language versus pattern and meaning language."
      ]
    },
    {
      key: "TF",
      leftLetter: "T",
      rightLetter: "F",
      leftScore: score(["logic", "efficient", "competence", "truth", "standards"], ["emotion", "hurt", "relationship", "empathy", "harmony"]),
      chosenLetter: "T",
      rationale: [
        language === "zh"
          ? "本地 fallback 根据逻辑、标准、情绪和关系线索进行估计。"
          : "Local fallback estimated this from logic, standards, emotion, and relationship cues."
      ]
    },
    {
      key: "JP",
      leftLetter: "J",
      rightLetter: "P",
      leftScore: score(["control", "plan", "decision", "goal", "discipline"], ["freedom", "flexible", "discover", "open", "change"]),
      chosenLetter: "J",
      rationale: [
        language === "zh"
          ? "本地 fallback 根据计划与控制语言，以及灵活性和开放性语言进行估计。"
          : "Local fallback estimated this from planning and control language versus flexibility and openness language."
      ]
    }
  ];
  const dimensions: MbtiDimension[] = baseDimensions.map((dimension): MbtiDimension => ({
    ...dimension,
    chosenLetter: dimension.leftScore >= 50 ? dimension.leftLetter : dimension.rightLetter
  }));

  return {
    type: dimensions.map((dimension) => dimension.chosenLetter).join(""),
    confidence: "low",
    summary:
      language === "zh"
        ? "这是本地 fallback 的 MBTI 风格估计。请把它当作粗略的自我反思视角，而不是稳定类型。"
        : "This is a local fallback MBTI-style estimate. Treat it as a rough self-reflection lens, not a stable type.",
    dimensions
  };
};

const mbtiMarkdown = (assessment: MbtiAssessment | null, language: AppLanguage) => {
  if (!assessment) {
    return "";
  }
  const lines = [
    language === "zh" ? "## MBTI 风格评估" : "## MBTI-style Assessment",
    `${language === "zh" ? "结果" : "Result"}: ${assessment.type}`,
    `${language === "zh" ? "置信度" : "Confidence"}: ${assessment.confidence}`,
    assessment.summary,
    "",
    ...assessment.dimensions.flatMap((dimension) => [
      `### ${dimension.leftLetter}/${dimension.rightLetter}`,
      `${dimension.leftLetter}: ${dimension.leftScore}% | ${dimension.rightLetter}: ${100 - dimension.leftScore}%`,
      `Selected: ${dimension.chosenLetter}`,
      ...dimension.rationale.map((item) => `- ${item}`),
      ""
    ])
  ];
  return lines.join("\n");
};

const cleanMarkdownLabel = (text: string) =>
  text
    .replace(/\*\*/g, "")
    .replace(/[`#>*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const displayForLanguage = (value: string, language: AppLanguage) =>
  language === "zh" ? ZH_DISPLAY_TEXT[value] ?? value : value;

const scoreForText = (text: string) => {
  const normalized = text.toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const positive = ["strong", "important", "central", "clear", "high", "repeated", "core", "main"].filter((word) =>
    normalized.includes(word)
  ).length;
  const uncertain = ["uncertain", "tentative", "possible", "may", "low", "limited", "missing"].filter((word) =>
    normalized.includes(word)
  ).length;
  const raw = 42 + Math.min(28, words.length / 3) + positive * 6 - uncertain * 5;
  return Math.max(18, Math.min(94, Math.round(raw)));
};

const extractSectionItems = (content: string): PolygonItem[] => {
  const boldMatches = Array.from(content.matchAll(/\*\*([^*]+)\*\*/g))
    .map((match) => cleanMarkdownLabel(match[1] ?? ""))
    .filter(Boolean);
  const bulletMatches = content
    .split("\n")
    .map((line) => line.match(/^\s*[-*]\s+(.+)$/)?.[1])
    .filter((line): line is string => Boolean(line))
    .map((line) => cleanMarkdownLabel(line.split(":")[0] ?? line))
    .filter(Boolean);
  const sentenceMatches = content
    .split(/(?<=[.!?])\s+/)
    .map(cleanMarkdownLabel)
    .filter((line) => line.length > 20)
    .slice(0, 4);
  const labels = (boldMatches.length ? boldMatches : bulletMatches.length ? bulletMatches : sentenceMatches).slice(0, 8);
  return labels.map((label) => {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const detail =
      content
        .split("\n")
        .find((line) => new RegExp(escapedLabel, "i").test(cleanMarkdownLabel(line))) ?? label;
    return {
      label: label.length > 34 ? `${label.slice(0, 31)}...` : label,
      score: scoreForText(detail),
      detail: cleanMarkdownLabel(detail)
    };
  });
};

const parsePolygonSections = (report: string): PolygonSection[] => {
  const sections: Array<{ title: string; content: string }> = [];
  let activeSection: { title: string; content: string[] } | null = null;
  const flushSection = () => {
    if (activeSection) {
      sections.push({ title: activeSection.title, content: activeSection.content.join("\n") });
    }
  };

  for (const line of report.split("\n")) {
    const title = line.match(/^##\s+(.+)$/)?.[1];
    if (title) {
      flushSection();
      activeSection = { title: cleanMarkdownLabel(title), content: [] };
      continue;
    }
    activeSection?.content.push(line);
  }
  flushSection();

  return sections
    .filter((section) => section.title && !/^mbti/i.test(section.title))
    .map((section) => {
      const items = extractSectionItems(section.content);
      return {
        title: section.title,
        score: items.length
          ? Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length)
          : scoreForText(section.content),
        items
      };
    });
};

const localRephraseQuestion = (question: string, kind: QuestionKind, language: AppLanguage) => {
  if (language === "zh") {
    const translated = displayForLanguage(question, language);
    if (kind === "rating") {
      return `仍然使用 1 到 10 的评分，其中 1 代表非常低、10 代表非常高：${translated.replace(/^从 1 到 10，?/, "")}`;
    }
    if (kind === "yesno") {
      return `从你通常的真实行为来看，请回答“是”或“否”：${translated}`;
    }
    return `换一种说法，如果能想到具体例子也可以补充：${translated}`;
  }
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
  const [resultPage, setResultPage] = useState<"portrait" | "mbti" | "polygon">("portrait");
  const [language, setLanguage] = useState<AppLanguage>("en");

  const currentModule = GUIDE_MODULES[session.moduleIndex];
  const provider = getProvider(config.providerId);
  const text: CopyText = COPY[language];
  const canUseRemoteModel = provider.kind !== "local" && (!provider.needsApiKey || Boolean(config.apiKey.trim()));
  const isFreeLocalMode = provider.kind === "local" || !canUseRemoteModel;
  const openQuestions = useMemo(() => openQuestionsFor(session.moduleIndex), [session.moduleIndex]);
  const ratingQuestions = useMemo(() => ratingQuestionsFor(session.moduleIndex), [session.moduleIndex]);
  const yesNoQuestions = useMemo(() => yesNoQuestionsFor(session.moduleIndex), [session.moduleIndex]);
  const currentAnalysis = session.analyses.find((analysis) => analysis.moduleId === currentModule?.id);

  useEffect(() => {
    const load = async () => {
      try {
        const [savedConfig, savedSession, savedLanguage] = await Promise.all([
          AsyncStorage.getItem(CONFIG_KEY),
          AsyncStorage.getItem(SESSION_KEY),
          AsyncStorage.getItem(LANGUAGE_KEY)
        ]);
        if (savedConfig) {
          setConfig({ ...defaultConfig, ...JSON.parse(savedConfig) });
          setIsConfigured(true);
        }
        if (savedSession) {
          setSession({ ...defaultSession, ...JSON.parse(savedSession) });
        }
        if (savedLanguage === "en" || savedLanguage === "zh") {
          setLanguage(savedLanguage);
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
    if (isReady) {
      AsyncStorage.setItem(LANGUAGE_KEY, language).catch(() => undefined);
    }
  }, [isReady, language]);

  useEffect(() => {
    setDraft("");
  }, [session.moduleIndex, session.phase, session.openIndex]);

  const saveConfig = () => {
    setIsConfigured(true);
  };

  const toggleLanguage = () => {
    setLanguage((previous) => (previous === "en" ? "zh" : "en"));
    setQuestionVariants({});
    setSession((previous) => ({ ...previous, finalReport: "", mbtiAssessment: null }));
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
      Alert.alert(text.answerNeededTitle, text.answerNeededBody);
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
    if (isFreeLocalMode) {
      const analysis = localModuleAnalysis(session.moduleIndex, moduleAnswers, language);
      setSession((previous) => ({
        ...previous,
        analyses: [...previous.analyses.filter((item) => item.moduleId !== currentModule.id), analysis],
        phase: yesNoQuestions.length ? "validate" : "open",
        validateIndex: 0
      }));
      setBusy(false);
      return;
    }
    try {
      const rawAnalysis = await analyzeModule(config, {
        title: currentModule.title,
        purpose: currentModule.purpose,
        answers: moduleAnswers,
        yesNoQuestions,
        detect: currentModule.detect,
        language
      });
      const analysis = coerceAnalysis(currentModule.id, currentModule.title, rawAnalysis, yesNoQuestions);
      setSession((previous) => ({
        ...previous,
        analyses: [...previous.analyses.filter((item) => item.moduleId !== currentModule.id), analysis],
        phase: yesNoQuestions.length ? "validate" : "open",
        validateIndex: 0
      }));
    } catch (analysisError) {
      const analysis = localModuleAnalysis(session.moduleIndex, moduleAnswers, language);
      const detail = analysisError instanceof Error ? analysisError.message : "unknown error";
      setError(`${text.modelAnalysisFallback} ${text.detail}: ${detail}`);
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
      Alert.alert(text.correctionNeededTitle, text.correctionNeededBody);
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
    const errors: string[] = [];
    let finalReport = "";
    let mbtiAssessment: MbtiAssessment | null = null;
    if (isFreeLocalMode) {
      finalReport = localFinalReport(session, language);
      mbtiAssessment = normalizeMbtiAssessment(localMbtiAssessment(session, language));
      setSession((previous) => ({ ...previous, finalReport, mbtiAssessment }));
      setResultPage("portrait");
      setBusy(false);
      return;
    }
    try {
      const report = await generateFinalReport(config, { answers: session.answers, analyses: session.analyses, language });
      finalReport = ensureReportDisclaimer(report, language);
    } catch (reportError) {
      const detail = reportError instanceof Error ? reportError.message : "unknown error";
      errors.push(`${text.reportFallback} ${text.detail}: ${detail}`);
      finalReport = localFinalReport(session, language);
    }

    try {
      const assessment = await generateMbtiAssessment(config, { answers: session.answers, analyses: session.analyses, language });
      mbtiAssessment = normalizeMbtiAssessment(assessment);
    } catch (mbtiError) {
      const detail = mbtiError instanceof Error ? mbtiError.message : "unknown error";
      errors.push(`${text.mbtiFallback} ${text.detail}: ${detail}`);
      mbtiAssessment = normalizeMbtiAssessment(localMbtiAssessment(session, language));
    } finally {
      setBusy(false);
    }

    setSession((previous) => ({ ...previous, finalReport, mbtiAssessment }));
    setResultPage("portrait");
    setError(errors.join("\n"));
  };

  const copyReport = async () => {
    if (!session.finalReport) {
      return;
    }
    setError("");
    try {
      await Clipboard.setStringAsync(`${session.finalReport}\n\n${mbtiMarkdown(session.mbtiAssessment, language)}`.trim());
      Alert.alert(text.copiedTitle, text.copiedBody);
    } catch (copyError) {
      const detail = copyError instanceof Error ? copyError.message : "unknown error";
      setError(`${text.copyFailed} ${text.detail}: ${detail}`);
    }
  };

  const resetInterview = () => {
    Alert.alert(text.resetTitle, text.resetBody, [
      { text: text.cancel, style: "cancel" },
      {
        text: text.reset,
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
        Alert.alert(text.permissionTitle, text.permissionBody);
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: false,
        continuous: false
      });
    } catch (voiceError) {
      setListening(false);
      setError(voiceError instanceof Error ? `${text.voiceFailed} ${text.detail}: ${voiceError.message}` : text.voiceFailed);
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

  const displayQuestionFor = (key: string, question: string) =>
    questionVariants[key] ?? displayForLanguage(question, language);

  const handleRephrase = async (key: string, question: string, kind: QuestionKind) => {
    if (!question || rephrasingKey) {
      return;
    }
    if (isFreeLocalMode) {
      setQuestionVariants((previous) => ({ ...previous, [key]: localRephraseQuestion(question, kind, language) }));
      return;
    }
    setRephrasingKey(key);
    setError("");
    const currentWording = displayQuestionFor(key, question);
    try {
      const nextWording = await rephraseQuestion(config, { question, previousWording: currentWording, kind, language });
      setQuestionVariants((previous) => ({ ...previous, [key]: nextWording || localRephraseQuestion(question, kind, language) }));
    } catch (rephraseError) {
      const detail = rephraseError instanceof Error ? rephraseError.message : "unknown error";
      setQuestionVariants((previous) => ({ ...previous, [key]: localRephraseQuestion(question, kind, language) }));
      setError(`${text.rephraseFallback} ${text.detail}: ${detail}`);
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
          <View style={styles.setupHeader}>
            <Text style={styles.appTitle}>{text.appTitle}</Text>
            <FeedbackButton style={styles.languageButton} textStyle={styles.languageButtonText} onPress={toggleLanguage}>
              {text.languageButton}
            </FeedbackButton>
          </View>
          <Text style={styles.bodyText}>{text.safetyBoundary}</Text>
          <Text style={styles.label}>{text.apiCompany}</Text>
          <View style={styles.pickerFrame}>
            <Picker selectedValue={config.providerId} onValueChange={changeProvider}>
              {PROVIDERS.map((item) => (
                <Picker.Item key={item.id} label={item.id === "local" ? text.localProviderName : item.name} value={item.id} />
              ))}
            </Picker>
          </View>

          <View style={styles.costNotice}>
            <Text style={styles.costNoticeText}>{provider.kind === "local" ? text.localModeNotice : text.apiOptionalNotice}</Text>
          </View>

          {provider.kind !== "local" ? (
            <>
              <Text style={styles.label}>{text.model}</Text>
              <View style={styles.pickerFrame}>
                <Picker selectedValue={config.model} onValueChange={(model) => setConfig((previous) => ({ ...previous, model }))}>
                  {provider.models.map((model) => (
                    <Picker.Item key={model} label={model} value={model} />
                  ))}
                </Picker>
              </View>

              <Text style={styles.label}>{text.customModel}</Text>
              <TextInput
                style={styles.input}
                value={config.customModel}
                onChangeText={(customModel) => setConfig((previous) => ({ ...previous, customModel }))}
                placeholder={text.optionalModel}
                autoCapitalize="none"
              />

              <Text style={styles.label}>{text.apiKey}</Text>
              <TextInput
                style={styles.input}
                value={config.apiKey}
                onChangeText={(apiKey) => setConfig((previous) => ({ ...previous, apiKey }))}
                placeholder={text.optional}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.label}>{text.baseUrl}</Text>
              <TextInput
                style={styles.input}
                value={config.baseUrl}
                onChangeText={(baseUrl) => setConfig((previous) => ({ ...previous, baseUrl }))}
                autoCapitalize="none"
              />
            </>
          ) : null}

          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              {text.apiNotice}
            </Text>
          </View>

          {provider.id === "anthropic" ? (
            <View style={styles.costNotice}>
              <Text style={styles.costNoticeText}>{text.costNotice}</Text>
            </View>
          ) : null}

          <FeedbackButton style={styles.primaryButton} onPress={saveConfig} textStyle={styles.primaryButtonText}>
            {text.startInterview}
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
          <Header onReset={resetInterview} onEditConfig={editApiSettings} onToggleLanguage={toggleLanguage} text={text} />
          <Text style={styles.sectionEyebrow}>{text.complete}</Text>
          <Text style={styles.title}>{text.finalResults}</Text>
          <Text style={styles.bodyText}>
            {text.finalIntro}
          </Text>
          {busy ? <ActivityIndicator size="large" /> : null}
          {!session.finalReport ? (
            <FeedbackButton style={styles.primaryButton} onPress={generateReport} disabled={busy} textStyle={styles.primaryButtonText}>
              {text.generateReport}
            </FeedbackButton>
          ) : (
            <>
              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerText}>{text.reportDisclaimer}</Text>
              </View>
              <View style={styles.tabRow}>
                <FeedbackButton
                  style={[styles.tabButton, resultPage === "portrait" && styles.tabButtonActive]}
                  textStyle={[styles.tabButtonText, resultPage === "portrait" && styles.tabButtonTextActive]}
                  onPress={() => setResultPage("portrait")}
                >
                  {text.summary}
                </FeedbackButton>
                <FeedbackButton
                  style={[styles.tabButton, resultPage === "mbti" && styles.tabButtonActive]}
                  textStyle={[styles.tabButtonText, resultPage === "mbti" && styles.tabButtonTextActive]}
                  onPress={() => setResultPage("mbti")}
                >
                  {text.mbti}
                </FeedbackButton>
                <FeedbackButton
                  style={[styles.tabButton, resultPage === "polygon" && styles.tabButtonActive]}
                  textStyle={[styles.tabButtonText, resultPage === "polygon" && styles.tabButtonTextActive]}
                  onPress={() => setResultPage("polygon")}
                >
                  {text.polygon}
                </FeedbackButton>
              </View>
              {resultPage === "portrait" ? (
                <View style={styles.reportBox}>
                  <Text style={styles.reportText}>{session.finalReport}</Text>
                </View>
              ) : resultPage === "mbti" ? (
                <MbtiResult assessment={session.mbtiAssessment} text={text} />
              ) : (
                <PolygonResult sections={parsePolygonSections(session.finalReport)} text={text} />
              )}
              <FeedbackButton
                style={styles.secondaryButton}
                textStyle={styles.secondaryButtonText}
                onPress={copyReport}
              >
                {text.copyMarkdown}
              </FeedbackButton>
              <FeedbackButton style={styles.secondaryButton} textStyle={styles.secondaryButtonText} onPress={generateReport} disabled={busy}>
                {text.regenerateResults}
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
          <Header onReset={resetInterview} onEditConfig={editApiSettings} onToggleLanguage={toggleLanguage} text={text} />
          <Text style={styles.sectionEyebrow}>
            {language === "zh"
              ? `${text.section} ${session.moduleIndex + 1} ${text.of} ${GUIDE_MODULES.length}`
              : `${text.section} ${session.moduleIndex + 1} ${text.of} ${GUIDE_MODULES.length}`}
          </Text>
          <Text style={styles.title}>{displayForLanguage(currentModule.title, language)}</Text>
          <Text style={styles.bodyText}>{displayForLanguage(currentModule.purpose, language)}</Text>

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
              text={text}
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
              text={text}
            />
          ) : null}

          {session.phase === "analyzing" ? (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>{text.summarizeTitle}</Text>
              <Text style={styles.bodyText}>
                {text.summarizeBody}
              </Text>
              {busy ? <ActivityIndicator size="large" /> : null}
              <FeedbackButton style={styles.primaryButton} onPress={runModuleAnalysis} disabled={busy} textStyle={styles.primaryButtonText}>
                {text.trainSection}
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
              text={text}
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
              text={text}
              buttonText={text.saveContinue}
            />
          ) : null}

          {currentAnalysis && session.phase !== "validate" ? (
            <View style={styles.analysisBox}>
              <Text style={styles.panelTitle}>{text.currentSummary}</Text>
              <Text style={styles.bodyText}>{currentAnalysis.summary}</Text>
              {typeof currentAnalysis.agreement === "number" ? (
                <Text style={styles.bodyText}>{text.predictionAgreement}: {Math.round(currentAnalysis.agreement * 100)}%</Text>
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

function Header({
  onReset,
  onEditConfig,
  onToggleLanguage,
  text
}: {
  onReset: () => void;
  onEditConfig: () => void;
  onToggleLanguage: () => void;
  text: CopyText;
}) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>{text.portraitInterview}</Text>
        <Text style={styles.headerMeta}>{text.privatePrototype}</Text>
      </View>
      <View style={styles.headerActions}>
        <FeedbackButton style={styles.resetButton} onPress={onToggleLanguage} textStyle={styles.resetButtonText}>
          {text.languageButton}
        </FeedbackButton>
        <FeedbackButton style={styles.resetButton} onPress={onEditConfig} textStyle={styles.resetButtonText}>
          {text.apiSetup}
        </FeedbackButton>
        <FeedbackButton style={styles.resetButton} onPress={onReset} textStyle={styles.resetButtonText}>
          {text.reset}
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
  text,
  buttonText
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
  text: CopyText;
  buttonText?: string;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.progressLabel}>
        {text.openQuestion} {index}/{total}
      </Text>
      <Text style={styles.question}>{question}</Text>
      <FeedbackButton style={styles.rephraseButton} onPress={onRephrase} disabled={rephraseBusy} textStyle={styles.rephraseButtonText}>
        {rephraseBusy ? text.rephrasing : text.rephrase}
      </FeedbackButton>
      <TextInput
        style={styles.textArea}
        value={draft}
        onChangeText={onDraft}
        placeholder={text.answerPlaceholder}
        multiline
        textAlignVertical="top"
      />
      <View style={styles.voiceRow}>
        <FeedbackButton
          style={[styles.voiceButton, listening && styles.voiceButtonActive]}
          onPress={listening ? onStopVoice : onStartVoice}
          textStyle={styles.voiceButtonText}
        >
          {listening ? text.stopVoice : text.voiceInput}
        </FeedbackButton>
        <FeedbackButton style={styles.primaryButtonSmall} onPress={onNext} textStyle={styles.primaryButtonText}>
          {buttonText ?? text.next}
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
  rephraseBusy,
  text
}: {
  question: string;
  index: number;
  total: number;
  onAnswer: (value: number) => void;
  onRephrase: () => void;
  rephraseBusy: boolean;
  text: CopyText;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.progressLabel}>
        {text.scoringQuestion} {index}/{total}
      </Text>
      <Text style={styles.question}>{question}</Text>
      <FeedbackButton style={styles.rephraseButton} onPress={onRephrase} disabled={rephraseBusy} textStyle={styles.rephraseButtonText}>
        {rephraseBusy ? text.rephrasing : text.rephrase}
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
  rephraseBusy,
  text
}: {
  question: string;
  index: number;
  total: number;
  onAnswer: (value: boolean) => void;
  onRephrase: () => void;
  rephraseBusy: boolean;
  text: CopyText;
}) {
  return (
    <View style={styles.panel}>
      <Text style={styles.progressLabel}>
        {text.calibration} {index}/{total}
      </Text>
      <Text style={styles.question}>{question}</Text>
      <View style={styles.yesNoRow}>
        <FeedbackButton
          style={[styles.macroButton, styles.yesButton]}
          pressedStyle={styles.yesButtonPressed}
          onPress={() => onAnswer(true)}
          textStyle={styles.macroButtonText}
        >
          {text.yes}
        </FeedbackButton>
        <FeedbackButton
          style={[styles.macroButton, styles.noButton]}
          pressedStyle={styles.noButtonPressed}
          onPress={() => onAnswer(false)}
          textStyle={styles.macroButtonText}
        >
          {text.no}
        </FeedbackButton>
      </View>
      <FeedbackButton style={styles.rephraseButton} onPress={onRephrase} disabled={rephraseBusy} textStyle={styles.rephraseButtonText}>
        {rephraseBusy ? text.rephrasing : text.rephrase}
      </FeedbackButton>
    </View>
  );
}

function confidenceLabel(value: MbtiAssessment["confidence"], text: CopyText) {
  if (value === "low") {
    return text.lowConfidence;
  }
  if (value === "medium") {
    return text.mediumConfidence;
  }
  return text.highConfidence;
}

function MbtiResult({ assessment, text }: { assessment: MbtiAssessment | null; text: CopyText }) {
  if (!assessment) {
    return (
      <View style={styles.reportBox}>
        <Text style={styles.reportText}>{text.mbtiMissing}</Text>
      </View>
    );
  }
  return (
    <View style={styles.mbtiBox}>
      <Text style={styles.mbtiType}>{assessment.type}</Text>
      <Text style={styles.bodyText}>{text.confidence}: {confidenceLabel(assessment.confidence, text)}</Text>
      <Text style={styles.bodyText}>{assessment.summary}</Text>
      {assessment.dimensions.map((dimension) => (
        <View key={dimension.key} style={styles.dimensionBox}>
          <View style={styles.dimensionHeader}>
            <Text style={styles.dimensionTitle}>
              {dimension.leftLetter}/{dimension.rightLetter}
            </Text>
            <Text style={styles.dimensionChoice}>{text.leans} {dimension.chosenLetter}</Text>
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabel}>
              {dimension.leftLetter} {dimension.leftScore}%
            </Text>
            <Text style={styles.barLabel}>
              {dimension.rightLetter} {100 - dimension.leftScore}%
            </Text>
          </View>
          <View style={styles.mbtiBar}>
            <View style={[styles.mbtiBarLeftFill, { width: `${dimension.leftScore}%` }]} />
            <View style={[styles.mbtiBarMarker, { left: `${dimension.leftScore}%` }]} />
          </View>
          {dimension.rationale.map((reason, index) => (
            <Text key={`${dimension.key}-${index}`} style={styles.reasonText}>
              * {reason}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function RadarChart({ title, items }: { title: string; items: PolygonItem[] }) {
  const size = RADAR_SIZE;
  const center = size / 2;
  const maxRadius = size * 0.34;
  const safeItems = items.length >= 3 ? items : [...items, ...items, ...items].slice(0, 3);
  const points = safeItems.map((item, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / safeItems.length;
    const radius = maxRadius * (Math.max(10, Math.min(100, item.score)) / 100);
    const outerRadius = maxRadius + 24;
    return {
      item,
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      labelX: center + Math.cos(angle) * outerRadius,
      labelY: center + Math.sin(angle) * outerRadius
    };
  });
  const edges = points.map((point, index) => {
    const next = points[(index + 1) % points.length] ?? point;
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    return {
      left: (point.x + next.x) / 2 - Math.sqrt(dx * dx + dy * dy) / 2,
      top: (point.y + next.y) / 2 - 1,
      width: Math.sqrt(dx * dx + dy * dy),
      rotate: `${Math.atan2(dy, dx)}rad`
    };
  });

  return (
    <View style={styles.radarCard}>
      <Text style={styles.radarTitle}>{title}</Text>
      <View style={[styles.radarCanvas, { width: size, height: size }]}>
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <View
            key={scale}
            style={[
              styles.radarRing,
              {
                width: maxRadius * 2 * scale,
                height: maxRadius * 2 * scale,
                borderRadius: maxRadius * scale,
                left: center - maxRadius * scale,
                top: center - maxRadius * scale
              }
            ]}
          />
        ))}
        {edges.map((edge, index) => (
          <View
            key={`edge-${index}`}
            style={[
              styles.radarEdge,
              {
                left: edge.left,
                top: edge.top,
                width: edge.width,
                transform: [{ rotate: edge.rotate }]
              }
            ]}
          />
        ))}
        {points.map((point, index) => (
          <View key={`point-${index}`} style={[styles.radarPoint, { left: point.x - 5, top: point.y - 5 }]} />
        ))}
        {points.map((point, index) => (
          <Text
            key={`label-${index}`}
            numberOfLines={2}
            style={[
              styles.radarLabel,
              {
                left: Math.max(0, Math.min(size - 70, point.labelX - 35)),
                top: Math.max(0, Math.min(size - 32, point.labelY - 12))
              }
            ]}
          >
            {point.item.label}
          </Text>
        ))}
      </View>
      <View style={styles.radarLegend}>
        {items.map((item, index) => (
          <Text key={`${item.label}-${index}`} style={styles.reasonText}>
            * {item.label}: {item.score}
          </Text>
        ))}
      </View>
    </View>
  );
}

function PolygonResult({ sections, text }: { sections: PolygonSection[]; text: CopyText }) {
  if (!sections.length) {
    return (
      <View style={styles.reportBox}>
        <Text style={styles.reportText}>{text.polygonMissing}</Text>
      </View>
    );
  }
  const overviewItems = sections.map((section) => ({
    label: section.title,
    score: section.score,
    detail: section.title
  }));
  return (
    <View style={styles.polygonBox}>
      <Text style={styles.panelTitle}>{text.summaryPolygon}</Text>
      <Text style={styles.bodyText}>{text.polygonHelp}</Text>
      <RadarChart title={text.overallSections} items={overviewItems} />
      {sections.map((section) => (
        <RadarChart
          key={section.title}
          title={section.title}
          items={
            section.items.length
              ? section.items
              : [{ label: section.title, score: section.score, detail: section.title }]
          }
        />
      ))}
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
  setupHeader: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
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
  languageButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#1D4F43",
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  languageButtonText: {
    color: "#1D4F43",
    fontSize: 13,
    fontWeight: "900"
  },
  header: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 6,
    flexShrink: 1
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
  costNotice: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#B9D0C7",
    backgroundColor: "#EDF6F2",
    padding: 12
  },
  costNoticeText: {
    color: "#244A3F",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800"
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
  disclaimerBox: {
    borderWidth: 1,
    borderColor: "#A64038",
    borderRadius: 8,
    backgroundColor: "#FFF2F0",
    padding: 12
  },
  disclaimerText: {
    color: "#8A2F28",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "900"
  },
  tabRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#C9CEC4",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#FFFFFF"
  },
  tabButton: {
    minHeight: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  tabButtonActive: {
    backgroundColor: "#1D4F43"
  },
  tabButtonText: {
    color: "#3C473F",
    fontSize: 13,
    fontWeight: "900"
  },
  tabButtonTextActive: {
    color: "#FFFFFF"
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
  mbtiBox: {
    borderWidth: 1,
    borderColor: "#D9DDD4",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 14
  },
  polygonBox: {
    borderWidth: 1,
    borderColor: "#D9DDD4",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 14
  },
  mbtiType: {
    color: "#17201B",
    fontSize: 46,
    lineHeight: 52,
    fontWeight: "900"
  },
  dimensionBox: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E5DE"
  },
  dimensionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  dimensionTitle: {
    color: "#17201B",
    fontSize: 18,
    fontWeight: "900"
  },
  dimensionChoice: {
    color: "#866A28",
    fontSize: 13,
    fontWeight: "900"
  },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  barLabel: {
    color: "#4D5851",
    fontSize: 13,
    fontWeight: "800"
  },
  mbtiBar: {
    height: 18,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#DCE9EE",
    borderWidth: 1,
    borderColor: "#C8D7DC"
  },
  mbtiBarLeftFill: {
    height: "100%",
    backgroundColor: "#D88C4B"
  },
  mbtiBarMarker: {
    position: "absolute",
    top: -2,
    bottom: -2,
    width: 4,
    marginLeft: -2,
    backgroundColor: "#17201B"
  },
  reasonText: {
    color: "#3B443E",
    fontSize: 14,
    lineHeight: 20
  },
  radarCard: {
    borderTopWidth: 1,
    borderTopColor: "#E2E5DE",
    paddingTop: 12,
    gap: 10,
    alignItems: "center"
  },
  radarTitle: {
    alignSelf: "stretch",
    color: "#17201B",
    fontSize: 17,
    fontWeight: "900"
  },
  radarCanvas: {
    position: "relative",
    alignSelf: "center"
  },
  radarRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "#D8DED5",
    backgroundColor: "transparent"
  },
  radarEdge: {
    position: "absolute",
    height: 3,
    borderRadius: 2,
    backgroundColor: "#D88C4B"
  },
  radarPoint: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1D4F43",
    borderWidth: 1,
    borderColor: "#FFFFFF"
  },
  radarLabel: {
    position: "absolute",
    width: 70,
    color: "#33443A",
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    fontWeight: "800"
  },
  radarLegend: {
    alignSelf: "stretch",
    gap: 4
  },
  errorText: {
    color: "#9B2C22",
    fontSize: 14,
    lineHeight: 20
  }
});
