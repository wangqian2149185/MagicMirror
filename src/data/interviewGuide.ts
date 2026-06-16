import { InterviewModule } from "../types";

export const GUIDE_MODULES: InterviewModule[] = [
  {
    id: "life-narrative",
    title: "Life Narrative",
    purpose: "Understand how the person tells the story of their life.",
    mainQuestions: [
      "If you had to divide your life so far into three chapters, what would those chapters be?",
      "What has been the most important turning point in your life?",
      "What theme has repeated itself throughout your life?",
      "What do you feel you have been fighting against or trying to overcome?",
      "What part of you do you most wish other people could truly understand?"
    ],
    followUps: [
      "Can you describe a specific moment that shows this?",
      "What changed after that event?",
      "What was the strongest emotion at the time?",
      "Looking back, do you think your interpretation was accurate?"
    ],
    calibrationQuestions: [
      "Do you often feel different from people around you?",
      "Do you often feel you matured earlier than others?",
      "Do you often feel you need to prove something?",
      "From 1 to 10, how much of your life feels self-directed?",
      "From 1 to 10, how important is it for you to be deeply understood?"
    ],
    detect: ["redemption narrative", "outsider narrative", "survival narrative", "unresolved identity conflict"]
  },
  {
    id: "core-motivation",
    title: "Core Motivation",
    purpose: "Identify what drives the person and what they most want to avoid.",
    mainQuestions: [
      "When you work hard for something important, what are you usually trying to gain?",
      "What are you usually trying to avoid?",
      "What kind of success would feel truly meaningful to you?",
      "What kind of compliment matters most to you?",
      "What kind of criticism hurts most?"
    ],
    followUps: [
      "Can you give a recent example?",
      "If nobody recognized the outcome, would you still want it?",
      "What do you fear losing?",
      "Does this motivation energize you or exhaust you?"
    ],
    calibrationQuestions: [
      "Do you often fear wasting your potential?",
      "Do you find it difficult to accept being ordinary?",
      "Do you often compare yourself with high-achieving people?",
      "Are you more motivated by challenge than comfort?",
      "From 1 to 10, how strong is your need for achievement?",
      "From 1 to 10, how strong is your need for freedom?",
      "From 1 to 10, how strong is your need for recognition?"
    ],
    detect: ["achievement motivation", "autonomy motivation", "recognition motivation", "fear of failure", "fear of dependence"]
  },
  {
    id: "values",
    title: "Values",
    purpose: "Understand what the person prioritizes when choices involve trade-offs.",
    mainQuestions: [
      "If you had to rank freedom, security, achievement, intimacy, and meaning, how would you rank them?",
      "What kind of behavior do you most disrespect?",
      "What kind of person do you deeply respect?",
      "When making a major decision, what usually makes the final decision clear?",
      "What would you still do even if there were no external reward?"
    ],
    followUps: [
      "What is a recent decision that reflected this value?",
      "Did this value cost you anything?",
      "Would you still choose it if it cost money, status, or a relationship?",
      "Has this value changed over time?"
    ],
    calibrationQuestions: [
      "Are you willing to tolerate short-term discomfort for long-term goals?",
      "Is it hard for you to act against your principles?",
      "Are you especially sensitive to inefficiency, hypocrisy, or low standards?",
      "From 1 to 10, how much do you value security?",
      "From 1 to 10, how much do you value influence?",
      "From 1 to 10, how much do you value inner freedom?"
    ],
    detect: ["freedom vs stability", "achievement vs peace", "loyalty vs truth", "efficiency vs empathy"]
  },
  {
    id: "cognitive-style",
    title: "Cognitive Style",
    purpose: "Understand how the person thinks, learns, judges, and solves problems.",
    mainQuestions: [
      "When you face a complex problem, what do you usually do first?",
      "Do you trust data, intuition, experience, or feedback most?",
      "What kind of problem are you naturally good at solving?",
      "What kind of problem drains you?",
      "When do you feel that other people are thinking too shallowly?"
    ],
    followUps: [
      "Can you describe a recent problem you solved?",
      "What was your first hypothesis?",
      "Did you revise your initial judgment?",
      "How did you know your solution was working?"
    ],
    calibrationQuestions: [
      "Do you often build mental models or systems?",
      "Do you quickly notice hidden patterns?",
      "Do you dislike repetitive, low-creativity tasks?",
      "Do you become impatient with unclear logic?",
      "From 1 to 10, how much do you rely on intuition?",
      "From 1 to 10, how much do you rely on evidence?"
    ],
    detect: ["analytical style", "systems thinking", "divergent thinking", "tolerance for ambiguity"]
  },
  {
    id: "emotional-pattern",
    title: "Emotional Pattern",
    purpose: "Understand what triggers the person emotionally and how they regulate emotion.",
    mainQuestions: [
      "When was the last time your emotions changed noticeably?",
      "What most easily irritates you?",
      "What most easily hurts you?",
      "When you are angry, do you express it, suppress it, or redirect it?",
      "How do you usually recover from a low point?"
    ],
    followUps: [
      "What happened right before the emotion appeared?",
      "What did you feel in your body?",
      "Did you express it immediately?",
      "Does this emotional pattern repeat?"
    ],
    calibrationQuestions: [
      "Can one sentence from someone affect your mood strongly?",
      "Do you often look calm outside but feel intense inside?",
      "Do you dislike showing vulnerability?",
      "Do you recover quickly after anger?",
      "From 1 to 10, how intense are your emotional reactions?",
      "From 1 to 10, how difficult is it for you to express emotion?"
    ],
    detect: ["emotional suppression", "shame sensitivity", "anger style", "need for solitude", "hidden vulnerability"]
  },
  {
    id: "stress-response",
    title: "Stress Response",
    purpose: "Understand how the person behaves when resources, time, certainty, or control are limited.",
    mainQuestions: [
      "What was the most stressful period of your life?",
      "When pressure arrives, what is your first reaction?",
      "Under pressure, do you become more efficient or more disorganized?",
      "What do you do when plans fall apart?",
      "Under what conditions do you avoid or procrastinate?"
    ],
    followUps: [
      "Did you become more controlling, impatient, detached, or dependent?",
      "Did others notice a change?",
      "What support did you most need?",
      "What eventually helped you recover?"
    ],
    calibrationQuestions: [
      "Under stress, do you try to control details more?",
      "Under stress, do you carry things alone rather than ask for help?",
      "Under stress, do you become more aggressive?",
      "Under stress, do you avoid tasks or people?",
      "From 1 to 10, how resilient are you under pressure?",
      "From 1 to 10, how easily do you lose patience under pressure?"
    ],
    detect: ["fight response", "withdrawal response", "overwork response", "problem-solving response", "hidden cost of high performance"]
  },
  {
    id: "relationship-pattern",
    title: "Relationship Pattern",
    purpose: "Understand how the person forms trust, intimacy, boundaries, and connection.",
    mainQuestions: [
      "How do you decide whether someone is trustworthy?",
      "What do you most need in relationships?",
      "What are you most afraid someone might do to you emotionally?",
      "What kind of person do you easily become close to?",
      "Is there a relationship pattern that has repeated in your life?"
    ],
    followUps: [
      "When was the last time a relationship became distant?",
      "What caused the distance?",
      "Did you try to repair it?",
      "Is it easy for you to express needs?"
    ],
    calibrationQuestions: [
      "Is it hard for you to fully trust people?",
      "Do you dislike owing others favors?",
      "Is it easier for you to help others than ask for help?",
      "Do you need a lot of personal space in close relationships?",
      "From 1 to 10, how strong is your need for closeness?",
      "From 1 to 10, how strong is your need for boundaries?"
    ],
    detect: ["trust threshold", "caretaker role", "distance-protection pattern", "fear of dependence", "relationship repair ability"]
  },
  {
    id: "conflict-authority-power",
    title: "Conflict, Authority, and Power",
    purpose: "Understand how the person handles confrontation, hierarchy, competition, and control.",
    mainQuestions: [
      "When someone is clearly better than you, what do you usually feel?",
      "When someone less competent tries to direct you, how do you react?",
      "How do you relate to authority?",
      "When was the last time you had a conflict with someone?",
      "In what areas do you have control needs?"
    ],
    followUps: [
      "Did you care more about truth, fairness, efficiency, status, or harmony?",
      "Did you reflect on your own role afterward?",
      "Did you suppress your real opinion?",
      "What would have made the conflict easier?"
    ],
    calibrationQuestions: [
      "Do you dislike being managed by people you do not respect?",
      "Is it hard for you to follow authority you consider low-quality?",
      "Does competition energize you?",
      "Do you mentally rank people by competence?",
      "From 1 to 10, how competitive are you?",
      "From 1 to 10, how naturally obedient are you to authority?"
    ],
    detect: ["resistance to authority", "status sensitivity", "competence sensitivity", "conflict avoidance", "need for control"]
  },
  {
    id: "self-esteem-vulnerability",
    title: "Self-Esteem and Vulnerability",
    purpose: "Understand how the person protects self-worth and where they are most emotionally exposed.",
    mainQuestions: [
      "What most easily makes you feel not good enough?",
      "What part of yourself do you least want others to see?",
      "When do you feel underestimated?",
      "What kind of judgment is hardest for you to accept?",
      "Where does your confidence come from?"
    ],
    followUps: [
      "When did this sensitivity begin?",
      "Do you hide it or express it?",
      "What happens when someone touches this vulnerable point?",
      "Does this vulnerability also motivate you?"
    ],
    calibrationQuestions: [
      "Are you afraid of being ordinary?",
      "Are you afraid of being seen as incompetent?",
      "Are you afraid of being ignored?",
      "Do you use achievement to prove your worth?",
      "From 1 to 10, how sensitive are you to criticism?",
      "From 1 to 10, how important is it to maintain a strong image?"
    ],
    detect: ["achievement-based self-worth", "shame trigger", "fear of exposure", "fear of mediocrity", "emotional armor"]
  },
  {
    id: "growth-direction-blind-spots",
    title: "Growth Direction and Blind Spots",
    purpose: "Understand maturity, self-awareness, recurring limitations, and development potential.",
    mainQuestions: [
      "What is your greatest personality strength?",
      "What is the cost of that strength?",
      "What do people close to you often remind you about?",
      "What pattern do you want to change but find difficult to change?",
      "If you became more mature in the next five years, what would change?"
    ],
    followUps: [
      "Have you tried to change this before?",
      "When is this problem most visible?",
      "What does this pattern protect you from?",
      "What would improvement look like in observable behavior?"
    ],
    calibrationQuestions: [
      "Do you reflect on yourself often?",
      "Are you willing to admit blind spots?",
      "Is it hard for you to accept ordinary advice?",
      "Do you prefer discovering things yourself rather than being told?",
      "From 1 to 10, how strong is your self-awareness?",
      "From 1 to 10, how willing are you to change long-term patterns?"
    ],
    detect: ["self-awareness", "defensiveness", "capacity for change", "rigidity", "growth edge"]
  }
];

export const SAFETY_BOUNDARY =
  "This app is for self-reflection only. It does not diagnose, classify, or replace support from trusted people, emergency services, or licensed professionals.";
