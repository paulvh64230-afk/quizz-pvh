import type { QuestionType } from "./quizz.types";

export const MAX_TEMPLATE_OPTIONS = 6;

const HEADERS = [
  "Type",
  "Intitulé de la question",
  ...Array.from({ length: MAX_TEMPLATE_OPTIONS }, (_, i) => `Option ${i + 1}`),
  "Bonne réponse (numéro)",
];

const TYPE_ALIASES: Record<string, QuestionType> = {
  quiz: "quiz",
  "quiz / sondage": "quiz",
  sondage: "quiz",
  "choix multiples": "quiz",
  wordcloud: "wordcloud",
  "nuage de mots": "wordcloud",
  "nuage de mot": "wordcloud",
  open: "open",
  ouverte: "open",
  "question ouverte": "open",
  libre: "open",
  ranking: "ranking",
  classement: "ranking",
  vote: "ranking",
};

const EXAMPLE_ROWS: (string | number)[][] = [
  ["Quiz", "Quelle est la capitale de la Belgique ?", "Bruxelles", "Liège", "Anvers", "", "", "", 1],
  ["Nuage de mots", "En un mot, votre ressenti sur cette réunion ?", "", "", "", "", "", "", ""],
  ["Question ouverte", "Quelle idée souhaitez-vous partager ?", "", "", "", "", "", "", ""],
  [
    "Classement",
    "Classez ces priorités de la plus importante à la moins importante",
    "Qualité",
    "Rapidité",
    "Prix",
    "",
    "",
    "",
    "",
  ],
];

export interface ParsedQuestion {
  type: QuestionType;
  title: string;
  options: string[];
  correctOption: number | null;
}

export interface ParseResult {
  questions: ParsedQuestion[];
  errors: string[];
}

function cellText(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/** Génère et télécharge le modèle Excel à remplir par l'animateur. */
export async function downloadTemplate(): Promise<void> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...EXAMPLE_ROWS]);
  sheet["!cols"] = [
    { wch: 18 },
    { wch: 52 },
    ...Array.from({ length: MAX_TEMPLATE_OPTIONS }, () => ({ wch: 18 })),
    { wch: 22 },
  ];

  const notes = XLSX.utils.aoa_to_sheet([
    ["Comment remplir ce modèle"],
    [""],
    ["1. Une ligne = une question. Ne modifiez pas la ligne d'en-têtes de l'onglet Questions."],
    ["2. Colonne Type : Quiz, Nuage de mots, Question ouverte ou Classement."],
    ["3. Options : obligatoires (au moins 2) pour Quiz et Classement, à laisser vides sinon."],
    [
      "4. Bonne réponse (numéro) : uniquement pour Quiz. Indiquez 1 pour la première option, 2 pour la deuxième, etc. Laissez vide pour un simple sondage.",
    ],
    ["5. Supprimez les exemples fournis avant d'importer votre fichier."],
  ]);
  notes["!cols"] = [{ wch: 120 }];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Questions");
  XLSX.utils.book_append_sheet(book, notes, "Mode d'emploi");
  XLSX.writeFile(book, "modele-questions-quizz-app.xlsx");
}

/** Lit un fichier Excel/CSV rempli par l'animateur et en extrait les questions. */
export async function parseQuestionsFile(file: File): Promise<ParseResult> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array" });
  const sheetName =
    book.SheetNames.find((n) => n.toLowerCase().includes("question")) ?? book.SheetNames[0];
  const sheet = sheetName ? book.Sheets[sheetName] : undefined;
  if (!sheet) return { questions: [], errors: ["Ce fichier ne contient aucune feuille de calcul."] };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false });
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const cells = (row ?? []).map(cellText);
    if (cells.every((c) => !c)) return;

    const rawType = (cells[0] ?? "").toLowerCase();
    const titleCell = cells[1] ?? "";

    // Ligne d'en-têtes
    if (rawType === "type" || titleCell.toLowerCase().startsWith("intitulé")) return;

    const lineNo = index + 1;
    const type = TYPE_ALIASES[rawType];
    if (!type) {
      errors.push(
        `Ligne ${lineNo} : type « ${cells[0] || "(vide)"} » inconnu (Quiz, Nuage de mots, Question ouverte ou Classement).`,
      );
      return;
    }
    if (!titleCell) {
      errors.push(`Ligne ${lineNo} : l'intitulé de la question est manquant.`);
      return;
    }

    const options =
      type === "quiz" || type === "ranking"
        ? cells.slice(2, 2 + MAX_TEMPLATE_OPTIONS).filter(Boolean)
        : [];
    if ((type === "quiz" || type === "ranking") && options.length < 2) {
      errors.push(`Ligne ${lineNo} : indiquez au moins 2 options.`);
      return;
    }

    let correctOption: number | null = null;
    const rawCorrect = cells[2 + MAX_TEMPLATE_OPTIONS] ?? "";
    if (type === "quiz" && rawCorrect) {
      const parsed = Number(rawCorrect.replace(",", "."));
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > options.length) {
        errors.push(
          `Ligne ${lineNo} : la bonne réponse doit être un numéro d'option entre 1 et ${options.length}.`,
        );
        return;
      }
      correctOption = parsed - 1;
    }

    questions.push({
      type,
      title: titleCell.slice(0, 300),
      options: options.map((o) => o.slice(0, 120)),
      correctOption,
    });
  });

  return { questions, errors };
}
