export const QUESTION_TYPES = ["quiz", "wordcloud", "open", "ranking"] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface QuestionData {
  id: string;
  type: QuestionType;
  title: string;
  options: string[];
  correctOption: number | null;
  position: number;
}

export interface EventData {
  id: string;
  code: string;
  title: string;
  currentQuestionId: string | null;
}

export interface PresenterState {
  event: EventData;
  questions: QuestionData[];
}

export interface ParticipantState {
  event: EventData;
  currentQuestion: QuestionData | null;
}

export type FunctionError = { error: string };

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  quiz: "Quiz / Sondage",
  wordcloud: "Nuage de mots",
  open: "Question ouverte",
  ranking: "Classement",
};
