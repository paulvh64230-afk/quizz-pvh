import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  ListChecks,
  Cloud,
  MessageSquareText,
  ArrowUpDown,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  PartyPopper,
  MonitorPlay,
  Copy,
  Download,
  Upload,
} from "lucide-react";

import { createEvent } from "@/lib/quizz.functions";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/quizz.types";
import { downloadTemplate, parseQuestionsFile } from "@/lib/quizz.xlsx";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Créer un événement — Quizz-App" },
      {
        name: "description",
        content:
          "Composez votre événement interactif : quiz, nuages de mots, questions ouvertes et classements. Obtenez un code à partager avec vos participants.",
      },
      { property: "og:title", content: "Créer un événement — Quizz-App" },
      {
        property: "og:description",
        content:
          "Composez vos questions interactives et obtenez un code à partager. Résultats en temps réel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatePage,
});

interface QuestionDraft {
  localId: string;
  type: QuestionType;
  title: string;
  options: string[];
  correctOption: number | null;
}

let draftCounter = 0;

function newDraft(type: QuestionType): QuestionDraft {
  return {
    localId: `draft-${Date.now()}-${draftCounter++}`,
    type,
    title: "",
    options: type === "quiz" || type === "ranking" ? ["", ""] : [],
    correctOption: null,
  };
}

function CreatePage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);

  const [created, setCreated] = useState<{
    code: string;
    adminToken: string;
  } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const addDraft = (type: QuestionType) => {
    setDrafts((d) => [...d, newDraft(type)]);
  };

  const handleTemplate = async () => {
    try {
      await downloadTemplate();
      toast.success("Modèle Excel téléchargé !");
    } catch {
      toast.error("Le téléchargement du modèle a échoué. Réessayez.");
    }
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;

    setImporting(true);

    try {
      const { questions, errors } = await parseQuestionsFile(file);

      if (questions.length > 0) {
        setDrafts((d) => [
          ...d,
          ...questions.map((q) => ({
            ...newDraft(q.type),
            ...q,
          })),
        ]);

        const n = questions.length;

        toast.success(
          `${n} question${n > 1 ? "s" : ""} importée${n > 1 ? "s" : ""} !`,
        );
      }

      for (const message of errors.slice(0, 5)) {
        toast.error(message);
      }

      if (questions.length === 0 && errors.length === 0) {
        toast.error("Aucune question trouvée dans ce fichier.");
      }
    } catch {
      toast.error(
        "Fichier illisible. Utilisez le modèle Excel proposé.",
      );
    } finally {
      setImporting(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const updateDraft = (
    localId: string,
    patch: Partial<QuestionDraft>,
  ) => {
    setDrafts((d) =>
      d.map((q) =>
        q.localId === localId
          ? { ...q, ...patch }
          : q,
      ),
    );
  };

  const removeDraft = (localId: string) => {
    setDrafts((d) =>
      d.filter((q) => q.localId !== localId),
    );
  };

  const moveDraft = (
    index: number,
    direction: -1 | 1,
  ) => {
    setDrafts((d) => {
      const next = [...d];
      const target = index + direction;

      if (target < 0 || target >= next.length) {
        return d;
      }

      const tmp = next[index]!;

      next[index] = next[target]!;
      next[target] = tmp;

      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!title.trim()) {
      toast.error("Donnez un titre à votre événement.");
      return;
    }

    if (drafts.length === 0) {
      toast.error("Ajoutez au moins une question.");
      return;
    }

    for (const q of drafts) {
      if (!q.title.trim()) {
        toast.error(
          "Chaque question doit avoir un intitulé.",
        );
        return;
      }

      if (
        q.type === "quiz" ||
        q.type === "ranking"
      ) {
        const filled = q.options.filter(
          (o) => o.trim(),
        );

        if (filled.length < 2) {
          toast.error(
            "Chaque question à choix ou classement doit proposer au moins 2 options.",
          );
          return;
        }
      }
    }

    setSubmitting(true);

    const result = await createEvent({
      data: {
        title: title.trim(),

        questions: drafts.map((q) => ({
          type: q.type,
          title: q.title.trim(),

          options:
            q.type === "quiz" ||
            q.type === "ranking"
              ? q.options
                  .map((o) => o.trim())
                  .filter(Boolean)
              : [],

          correctOption:
            q.type === "quiz" &&
            q.correctOption != null
              ? q.correctOption
              : null,
        })),
      },
    });

    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Événement créé !");
    setCreated(result);
  };

  /*
   * Écran affiché après la création de l'événement.
   * Le QR Code contient directement l'adresse :
   * /e/CODE
   */
  if (created) {
    const presenterUrl = `${window.location.origin}/presenter/${created.adminToken}`;

    const participantUrl = `${window.location.origin}/e/${created.code}`;

    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">

        <span className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent text-white">
          <PartyPopper className="size-8" />
        </span>

        <h1 className="mt-6 text-3xl font-bold">
          Votre événement est prêt !
        </h1>

        <p className="mt-3 text-muted-foreground">
          Partagez ce code ou scannez le QR Code pour rejoindre
          directement l'événement.
        </p>

        {/* Code événement */}
        <div className="mt-8 rounded-4xl border-2 border-dashed border-primary/40 bg-card px-12 py-8">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Code d'événement
          </p>

          <p className="mt-2 font-display text-6xl font-bold tracking-[0.2em] text-primary">
            {created.code}
          </p>
        </div>

        {/* QR CODE */}
        <div className="mt-8 flex flex-col items-center">

          <p className="mb-4 text-sm font-semibold">
            📱 Scanner pour rejoindre
          </p>

          <div className="rounded-3xl bg-white p-5 shadow-lg">
            <QRCodeSVG
              value={participantUrl}
              size={220}
              level="H"
              includeMargin
            />
          </div>

          <p className="mt-4 max-w-sm text-xs text-muted-foreground">
            Les participants peuvent scanner ce QR Code
            avec l'appareil photo de leur téléphone.
          </p>

        </div>

        {/* Lien animateur */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(
              presenterUrl,
            );

            toast.success(
              "Lien animateur copié ! Conservez-le précieusement.",
            );
          }}
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          <Copy className="size-4" />

          Copier mon lien animateur
        </button>

        {/* Ouvrir écran animateur */}
        <button
          onClick={() =>
            navigate({
              to: "/presenter/$token",
              params: {
                token: created.adminToken,
              },
            })
          }
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
        >
          <MonitorPlay className="size-5" />

          Ouvrir l'écran animateur
        </button>

      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">

      <button
        onClick={() =>
          navigate({ to: "/" })
        }
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />

        Accueil
      </button>

      <h1 className="mt-6 text-3xl font-bold md:text-4xl">
        Créer un événement
      </h1>

      <p className="mt-2 text-muted-foreground">
        Donnez un titre, ajoutez vos questions,
        puis partagez le code généré.
      </p>

      {/* Titre */}
      <div className="mt-8">

        <label
          htmlFor="event-title"
          className="text-sm font-semibold"
        >
          Titre de l'événement
        </label>

        <input
          id="event-title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          placeholder="Ex : Quiz de rentrée, réunion d'équipe…"
          maxLength={120}
          className="mt-2 w-full rounded-2xl border border-input bg-card px-4 py-3 text-base outline-none ring-ring transition-shadow focus:ring-2"
        />

      </div>

      {/* Import Excel */}
      <div className="mt-8 rounded-3xl border border-dashed border-secondary/50 bg-secondary/5 p-5">

        <p className="text-sm font-semibold">
          Importer vos questions depuis Excel
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Téléchargez le modèle, remplissez une ligne
          par question, puis importez le fichier.
        </p>

        <div className="mt-4 flex flex-wrap gap-2.5">

          <button
            onClick={handleTemplate}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-secondary/60 hover:bg-secondary/10"
          >
            <Download className="size-4" />

            Télécharger le modèle Excel
          </button>

          <button
            onClick={() =>
              fileRef.current?.click()
            }
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-50"
          >
            <Upload className="size-4" />

            {importing
              ? "Import en cours…"
              : "Importer un fichier"}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            aria-label="Fichier Excel de questions"
            onChange={(e) =>
              handleFile(
                e.target.files?.[0],
              )
            }
            className="hidden"
          />

        </div>
      </div>

      {/* Ajout question */}
      <div className="mt-8">

        <p className="text-sm font-semibold">
          Ajouter une question manuellement
        </p>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">

          {(
            [
              {
                type: "quiz",
                icon: ListChecks,
                hint: "Choix multiples, avec ou sans bonne réponse",
              },
              {
                type: "wordcloud",
                icon: Cloud,
                hint: "Un mot par participant",
              },
              {
                type: "open",
                icon: MessageSquareText,
                hint: "Réponse libre",
              },
              {
                type: "ranking",
                icon: ArrowUpDown,
                hint: "Ordonner des propositions",
              },
            ] as const
          ).map(
            ({
              type,
              icon: Icon,
              hint,
            }) => (
              <button
                key={type}
                onClick={() =>
                  addDraft(type)
                }
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >

                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                  <Icon className="size-4.5" />
                </span>

                <span>
                  <span className="block text-sm font-semibold">
                    {QUESTION_TYPE_LABELS[type]}
                  </span>

                  <span className="block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>

                <Plus className="ml-auto size-4 text-muted-foreground" />

              </button>
            ),
          )}

        </div>
      </div>

      {/* Questions */}
      <div className="mt-8 space-y-5">

        {drafts.map((q, i) => (

          <div
            key={q.localId}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm"
          >

            <div className="flex items-center gap-2">

              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                Question {i + 1} ·{" "}
                {QUESTION_TYPE_LABELS[q.type]}
              </span>

              <div className="ml-auto flex items-center gap-1">

                <button
                  onClick={() =>
                    moveDraft(i, -1)
                  }
                  disabled={i === 0}
                  aria-label="Monter"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowRight className="size-4 -rotate-90" />
                </button>

                <button
                  onClick={() =>
                    moveDraft(i, 1)
                  }
                  disabled={
                    i === drafts.length - 1
                  }
                  aria-label="Descendre"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowRight className="size-4 rotate-90" />
                </button>

                <button
                  onClick={() =>
                    removeDraft(q.localId)
                  }
                  aria-label="Supprimer la question"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>

              </div>

            </div>

            <input
              value={q.title}
              onChange={(e) =>
                updateDraft(
                  q.localId,
                  {
                    title: e.target.value,
                  },
                )
              }
              placeholder="Intitulé de la question"
              className="mt-3 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm font-medium outline-none ring-ring transition-shadow focus:ring-2"
            />

            {(q.type === "quiz" ||
              q.type === "ranking") && (

              <div className="mt-3 space-y-2">

                {q.options.map(
                  (opt, oi) => (

                    <div
                      key={oi}
                      className="flex items-center gap-2"
                    >

                      {q.type ===
                      "quiz" ? (

                        <button
                          onClick={() =>
                            updateDraft(
                              q.localId,
                              {
                                correctOption:
                                  q.correctOption ===
                                  oi
                                    ? null
                                    : oi,
                              },
                            )
                          }
                          title="Définir comme bonne réponse"
                          aria-label="Bonne réponse"
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                            q.correctOption === oi
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {oi + 1}
                        </button>

                      ) : (

                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-input bg-background text-xs font-bold text-muted-foreground">
                          {oi + 1}
                        </span>

                      )}

                      <input
                        value={opt}
                        onChange={(e) =>
                          updateDraft(
                            q.localId,
                            {
                              options:
                                q.options.map(
                                  (o, x) =>
                                    x === oi
                                      ? e
                                          .target
                                          .value
                                      : o,
                                ),
                            },
                          )
                        }
                        placeholder={`Proposition ${
                          oi + 1
                        }`}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                      />

                      <button
                        onClick={() =>
                          updateDraft(
                            q.localId,
                            {
                              options:
                                q.options.filter(
                                  (_, x) =>
                                    x !== oi,
                                ),
                            },
                          )
                        }
                        aria-label="Retirer l'option"
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>

                    </div>

                  ),
                )}

                {q.options.length <
                  10 && (

                  <button
                    onClick={() =>
                      updateDraft(
                        q.localId,
                        {
                          options: [
                            ...q.options,
                            "",
                          ],
                        },
                      )
                    }
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    + Ajouter une proposition
                  </button>

                )}

                {q.type ===
                  "quiz" && (

                  <p className="text-xs text-muted-foreground">
                    Cliquez sur un numéro pour
                    définir la bonne réponse.
                    Sans bonne réponse, la question
                    devient un sondage.
                  </p>

                )}

              </div>

            )}

            {q.type ===
              "wordcloud" && (

              <p className="mt-3 text-xs text-muted-foreground">
                Les participants envoient chacun
                un mot ; les plus fréquents
                s'affichent en grand.
              </p>

            )}

            {q.type ===
              "open" && (

              <p className="mt-3 text-xs text-muted-foreground">
                Les participants écrivent une
                réponse libre qui s'affiche en direct.
              </p>

            )}

          </div>

        ))}

      </div>

      {/* Création */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-10 w-full rounded-full bg-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting
          ? "Création en cours…"
          : "Créer l'événement"}
      </button>

    </div>
  );
}  const addDraft = (type: QuestionType) => {
    setDrafts((d) => [...d, newDraft(type)]);
  };

  const handleTemplate = async () => {
    try {
      await downloadTemplate();
      toast.success("Modèle Excel téléchargé !");
    } catch {
      toast.error("Le téléchargement du modèle a échoué. Réessayez.");
    }
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;

    setImporting(true);

    try {
      const { questions, errors } = await parseQuestionsFile(file);

      if (questions.length > 0) {
        setDrafts((d) => [
          ...d,
          ...questions.map((q) => ({
            ...newDraft(q.type),
            ...q,
          })),
        ]);

        const n = questions.length;

        toast.success(
          `${n} question${n > 1 ? "s" : ""} importée${n > 1 ? "s" : ""} !`,
        );
      }

      for (const message of errors.slice(0, 5)) {
        toast.error(message);
      }

      if (questions.length === 0 && errors.length === 0) {
        toast.error("Aucune question trouvée dans ce fichier.");
      }
    } catch {
      toast.error(
        "Fichier illisible. Utilisez le modèle Excel proposé.",
      );
    } finally {
      setImporting(false);

      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const updateDraft = (
    localId: string,
    patch: Partial<QuestionDraft>,
  ) => {
    setDrafts((d) =>
      d.map((q) =>
        q.localId === localId
          ? { ...q, ...patch }
          : q,
      ),
    );
  };

  const removeDraft = (localId: string) => {
    setDrafts((d) =>
      d.filter((q) => q.localId !== localId),
    );
  };

  const moveDraft = (
    index: number,
    direction: -1 | 1,
  ) => {
    setDrafts((d) => {
      const next = [...d];
      const target = index + direction;

      if (target < 0 || target >= next.length) {
        return d;
      }

      const tmp = next[index]!;

      next[index] = next[target]!;
      next[target] = tmp;

      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!title.trim()) {
      toast.error("Donnez un titre à votre événement.");
      return;
    }

    if (drafts.length === 0) {
      toast.error("Ajoutez au moins une question.");
      return;
    }

    for (const q of drafts) {
      if (!q.title.trim()) {
        toast.error(
          "Chaque question doit avoir un intitulé.",
        );
        return;
      }

      if (
        q.type === "quiz" ||
        q.type === "ranking"
      ) {
        const filled = q.options.filter(
          (o) => o.trim(),
        );

        if (filled.length < 2) {
          toast.error(
            "Chaque question à choix ou classement doit proposer au moins 2 options.",
          );
          return;
        }
      }
    }

    setSubmitting(true);

    const result = await createEvent({
      data: {
        title: title.trim(),

        questions: drafts.map((q) => ({
          type: q.type,
          title: q.title.trim(),

          options:
            q.type === "quiz" ||
            q.type === "ranking"
              ? q.options
                  .map((o) => o.trim())
                  .filter(Boolean)
              : [],

          correctOption:
            q.type === "quiz" &&
            q.correctOption != null
              ? q.correctOption
              : null,
        })),
      },
    });

    setSubmitting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Événement créé !");
    setCreated(result);
  };

  /*
   * Écran affiché après la création de l'événement.
   * Le QR Code contient directement l'adresse :
   * /e/CODE
   */
  if (created) {
    const presenterUrl = `${window.location.origin}/presenter/${created.adminToken}`;

    const participantUrl = `${window.location.origin}/e/${created.code}`;

    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">

        <span className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent text-white">
          <PartyPopper className="size-8" />
        </span>

        <h1 className="mt-6 text-3xl font-bold">
          Votre événement est prêt !
        </h1>

        <p className="mt-3 text-muted-foreground">
          Partagez ce code ou scannez le QR Code pour rejoindre
          directement l'événement.
        </p>

        {/* Code événement */}
        <div className="mt-8 rounded-4xl border-2 border-dashed border-primary/40 bg-card px-12 py-8">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Code d'événement
          </p>

          <p className="mt-2 font-display text-6xl font-bold tracking-[0.2em] text-primary">
            {created.code}
          </p>
        </div>

        {/* QR CODE */}
        <div className="mt-8 flex flex-col items-center">

          <p className="mb-4 text-sm font-semibold">
            📱 Scanner pour rejoindre
          </p>

          <div className="rounded-3xl bg-white p-5 shadow-lg">
            <QRCodeSVG
              value={participantUrl}
              size={220}
              level="H"
              includeMargin
            />
          </div>

          <p className="mt-4 max-w-sm text-xs text-muted-foreground">
            Les participants peuvent scanner ce QR Code
            avec l'appareil photo de leur téléphone.
          </p>

        </div>

        {/* Lien animateur */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(
              presenterUrl,
            );

            toast.success(
              "Lien animateur copié ! Conservez-le précieusement.",
            );
          }}
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          <Copy className="size-4" />

          Copier mon lien animateur
        </button>

        {/* Ouvrir écran animateur */}
        <button
          onClick={() =>
            navigate({
              to: "/presenter/$token",
              params: {
                token: created.adminToken,
              },
            })
          }
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
        >
          <MonitorPlay className="size-5" />

          Ouvrir l'écran animateur
        </button>

      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">

      <button
        onClick={() =>
          navigate({ to: "/" })
        }
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />

        Accueil
      </button>

      <h1 className="mt-6 text-3xl font-bold md:text-4xl">
        Créer un événement
      </h1>

      <p className="mt-2 text-muted-foreground">
        Donnez un titre, ajoutez vos questions,
        puis partagez le code généré.
      </p>

      {/* Titre */}
      <div className="mt-8">

        <label
          htmlFor="event-title"
          className="text-sm font-semibold"
        >
          Titre de l'événement
        </label>

        <input
          id="event-title"
          value={title}
          onChange={(e) =>
            setTitle(e.target.value)
          }
          placeholder="Ex : Quiz de rentrée, réunion d'équipe…"
          maxLength={120}
          className="mt-2 w-full rounded-2xl border border-input bg-card px-4 py-3 text-base outline-none ring-ring transition-shadow focus:ring-2"
        />

      </div>

      {/* Import Excel */}
      <div className="mt-8 rounded-3xl border border-dashed border-secondary/50 bg-secondary/5 p-5">

        <p className="text-sm font-semibold">
          Importer vos questions depuis Excel
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          Téléchargez le modèle, remplissez une ligne
          par question, puis importez le fichier.
        </p>

        <div className="mt-4 flex flex-wrap gap-2.5">

          <button
            onClick={handleTemplate}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-secondary/60 hover:bg-secondary/10"
          >
            <Download className="size-4" />

            Télécharger le modèle Excel
          </button>

          <button
            onClick={() =>
              fileRef.current?.click()
            }
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-50"
          >
            <Upload className="size-4" />

            {importing
              ? "Import en cours…"
              : "Importer un fichier"}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            aria-label="Fichier Excel de questions"
            onChange={(e) =>
              handleFile(
                e.target.files?.[0],
              )
            }
            className="hidden"
          />

        </div>
      </div>

      {/* Ajout question */}
      <div className="mt-8">

        <p className="text-sm font-semibold">
          Ajouter une question manuellement
        </p>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">

          {(
            [
              {
                type: "quiz",
                icon: ListChecks,
                hint: "Choix multiples, avec ou sans bonne réponse",
              },
              {
                type: "wordcloud",
                icon: Cloud,
                hint: "Un mot par participant",
              },
              {
                type: "open",
                icon: MessageSquareText,
                hint: "Réponse libre",
              },
              {
                type: "ranking",
                icon: ArrowUpDown,
                hint: "Ordonner des propositions",
              },
            ] as const
          ).map(
            ({
              type,
              icon: Icon,
              hint,
            }) => (
              <button
                key={type}
                onClick={() =>
                  addDraft(type)
                }
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
              >

                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                  <Icon className="size-4.5" />
                </span>

                <span>
                  <span className="block text-sm font-semibold">
                    {QUESTION_TYPE_LABELS[type]}
                  </span>

                  <span className="block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>

                <Plus className="ml-auto size-4 text-muted-foreground" />

              </button>
            ),
          )}

        </div>
      </div>

      {/* Questions */}
      <div className="mt-8 space-y-5">

        {drafts.map((q, i) => (

          <div
            key={q.localId}
            className="rounded-3xl border border-border bg-card p-5 shadow-sm"
          >

            <div className="flex items-center gap-2">

              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                Question {i + 1} ·{" "}
                {QUESTION_TYPE_LABELS[q.type]}
              </span>

              <div className="ml-auto flex items-center gap-1">

                <button
                  onClick={() =>
                    moveDraft(i, -1)
                  }
                  disabled={i === 0}
                  aria-label="Monter"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowRight className="size-4 -rotate-90" />
                </button>

                <button
                  onClick={() =>
                    moveDraft(i, 1)
                  }
                  disabled={
                    i === drafts.length - 1
                  }
                  aria-label="Descendre"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowRight className="size-4 rotate-90" />
                </button>

                <button
                  onClick={() =>
                    removeDraft(q.localId)
                  }
                  aria-label="Supprimer la question"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>

              </div>

            </div>

            <input
              value={q.title}
              onChange={(e) =>
                updateDraft(
                  q.localId,
                  {
                    title: e.target.value,
                  },
                )
              }
              placeholder="Intitulé de la question"
              className="mt-3 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm font-medium outline-none ring-ring transition-shadow focus:ring-2"
            />

            {(q.type === "quiz" ||
              q.type === "ranking") && (

              <div className="mt-3 space-y-2">

                {q.options.map(
                  (opt, oi) => (

                    <div
                      key={oi}
                      className="flex items-center gap-2"
                    >

                      {q.type ===
                      "quiz" ? (

                        <button
                          onClick={() =>
                            updateDraft(
                              q.localId,
                              {
                                correctOption:
                                  q.correctOption ===
                                  oi
                                    ? null
                                    : oi,
                              },
                            )
                          }
                          title="Définir comme bonne réponse"
                          aria-label="Bonne réponse"
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                            q.correctOption === oi
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input bg-background text-muted-foreground hover:border-primary/50"
                          }`}
                        >
                          {oi + 1}
                        </button>

                      ) : (

                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-input bg-background text-xs font-bold text-muted-foreground">
                          {oi + 1}
                        </span>

                      )}

                      <input
                        value={opt}
                        onChange={(e) =>
                          updateDraft(
                            q.localId,
                            {
                              options:
                                q.options.map(
                                  (o, x) =>
                                    x === oi
                                      ? e
                                          .target
                                          .value
                                      : o,
                                ),
                            },
                          )
                        }
                        placeholder={`Proposition ${
                          oi + 1
                        }`}
                        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                      />

                      <button
                        onClick={() =>
                          updateDraft(
                            q.localId,
                            {
                              options:
                                q.options.filter(
                                  (_, x) =>
                                    x !== oi,
                                ),
                            },
                          )
                        }
                        aria-label="Retirer l'option"
                        className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>

                    </div>

                  ),
                )}

                {q.options.length <
                  10 && (

                  <button
                    onClick={() =>
                      updateDraft(
                        q.localId,
                        {
                          options: [
                            ...q.options,
                            "",
                          ],
                        },
                      )
                    }
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    + Ajouter une proposition
                  </button>

                )}

                {q.type ===
                  "quiz" && (

                  <p className="text-xs text-muted-foreground">
                    Cliquez sur un numéro pour
                    définir la bonne réponse.
                    Sans bonne réponse, la question
                    devient un sondage.
                  </p>

                )}

              </div>

            )}

            {q.type ===
              "wordcloud" && (

              <p className="mt-3 text-xs text-muted-foreground">
                Les participants envoient chacun
                un mot ; les plus fréquents
                s'affichent en grand.
              </p>

            )}

            {q.type ===
              "open" && (

              <p className="mt-3 text-xs text-muted-foreground">
                Les participants écrivent une
                réponse libre qui s'affiche en direct.
              </p>

            )}

          </div>

        ))}

      </div>

      {/* Création */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-10 w-full rounded-full bg-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting
          ? "Création en cours…"
          : "Créer l'événement"}
      </button>

    </div>
  );
}    } catch {
      toast.error("Le téléchargement du modèle a échoué. Réessayez.");
    }
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const { questions, errors } = await parseQuestionsFile(file);
      if (questions.length > 0) {
        setDrafts((d) => [...d, ...questions.map((q) => ({ ...newDraft(q.type), ...q }))]);
        const n = questions.length;
        toast.success(`${n} question${n > 1 ? "s" : ""} importée${n > 1 ? "s" : ""} !`);
      }
      for (const message of errors.slice(0, 5)) toast.error(message);
      if (questions.length === 0 && errors.length === 0) {
        toast.error("Aucune question trouvée dans ce fichier.");
      }
    } catch {
      toast.error("Fichier illisible. Utilisez le modèle Excel proposé.");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updateDraft = (localId: string, patch: Partial<QuestionDraft>) => {
    setDrafts((d) => d.map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
  };

  const removeDraft = (localId: string) => {
    setDrafts((d) => d.filter((q) => q.localId !== localId));
  };

  const moveDraft = (index: number, direction: -1 | 1) => {
    setDrafts((d) => {
      const next = [...d];
      const target = index + direction;
      if (target < 0 || target >= next.length) return d;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!title.trim()) {
      toast.error("Donnez un titre à votre événement.");
      return;
    }
    if (drafts.length === 0) {
      toast.error("Ajoutez au moins une question.");
      return;
    }
    for (const q of drafts) {
      if (!q.title.trim()) {
        toast.error("Chaque question doit avoir un intitulé.");
        return;
      }
      if (q.type === "quiz" || q.type === "ranking") {
        const filled = q.options.filter((o) => o.trim());
        if (filled.length < 2) {
          toast.error("Chaque question à choix ou classement doit proposer au moins 2 options.");
          return;
        }
      }
    }
    setSubmitting(true);
    const result = await createEvent({
      data: {
        title: title.trim(),
        questions: drafts.map((q) => ({
          type: q.type,
          title: q.title.trim(),
          options:
            q.type === "quiz" || q.type === "ranking"
              ? q.options.map((o) => o.trim()).filter(Boolean)
              : [],
          correctOption:
            q.type === "quiz" && q.correctOption != null ? q.correctOption : null,
        })),
      },
    });
    setSubmitting(false);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Événement créé !");
    setCreated(result);
  };

  if (created) {
    const presenterUrl = `${window.location.origin}/presenter/${created.adminToken}`;
    return (
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent text-white">
          <PartyPopper className="size-8" />
        </span>
        <h1 className="mt-6 text-3xl font-bold">Votre événement est prêt !</h1>
        <p className="mt-3 text-muted-foreground">
          Partagez ce code avec vos participants — ils le saisissent sur{" "}
          <span className="font-semibold text-foreground">la page d'accueil</span>.
        </p>
        <div className="mt-8 rounded-4xl border-2 border-dashed border-primary/40 bg-card px-12 py-8">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Code d'événement
          </p>
          <p className="mt-2 font-display text-6xl font-bold tracking-[0.2em] text-primary">
            {created.code}
          </p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(presenterUrl);
            toast.success("Lien animateur copié ! Conservez-le précieusement.");
          }}
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          <Copy className="size-4" /> Copier mon lien animateur (à conserver)
        </button>
        <button
          onClick={() => navigate({ to: "/presenter/$token", params: { token: created.adminToken } })}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
        >
          <MonitorPlay className="size-5" /> Ouvrir l'écran animateur
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <button
        onClick={() => navigate({ to: "/" })}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Accueil
      </button>

      <h1 className="mt-6 text-3xl font-bold md:text-4xl">Créer un événement</h1>
      <p className="mt-2 text-muted-foreground">
        Donnez un titre, ajoutez vos questions, puis partagez le code généré.
      </p>

      <div className="mt-8">
        <label htmlFor="event-title" className="text-sm font-semibold">
          Titre de l'événement
        </label>
        <input
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex : Quiz de rentrée, réunion d'équipe…"
          maxLength={120}
          className="mt-2 w-full rounded-2xl border border-input bg-card px-4 py-3 text-base outline-none ring-ring transition-shadow focus:ring-2"
        />
      </div>

      {/* Add question */}
      {/* Import Excel */}
      <div className="mt-8 rounded-3xl border border-dashed border-secondary/50 bg-secondary/5 p-5">
        <p className="text-sm font-semibold">Importer vos questions depuis Excel</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Téléchargez le modèle, remplissez une ligne par question, puis importez le fichier. Les
          questions importées s'ajoutent à votre liste et restent modifiables.
        </p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <button
            onClick={handleTemplate}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold transition-colors hover:border-secondary/60 hover:bg-secondary/10"
          >
            <Download className="size-4" /> Télécharger le modèle Excel
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-50"
          >
            <Upload className="size-4" />
            {importing ? "Import en cours…" : "Importer un fichier"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            aria-label="Fichier Excel de questions"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="hidden"
          />
        </div>
      </div>

      {/* Add question */}
      <div className="mt-8">
        <p className="text-sm font-semibold">Ajouter une question manuellement</p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {(
            [
              { type: "quiz", icon: ListChecks, hint: "Choix multiples, avec ou sans bonne réponse" },
              { type: "wordcloud", icon: Cloud, hint: "Un mot par participant" },
              { type: "open", icon: MessageSquareText, hint: "Réponse libre" },
              { type: "ranking", icon: ArrowUpDown, hint: "Ordonner des propositions" },
            ] as const
          ).map(({ type, icon: Icon, hint }) => (
            <button
              key={type}
              onClick={() => addDraft(type)}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                <Icon className="size-4.5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{QUESTION_TYPE_LABELS[type]}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
              <Plus className="ml-auto size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* Drafts */}
      <div className="mt-8 space-y-5">
        {drafts.map((q, i) => (
          <div key={q.localId} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                Question {i + 1} · {QUESTION_TYPE_LABELS[q.type]}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  onClick={() => moveDraft(i, -1)}
                  disabled={i === 0}
                  aria-label="Monter"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowRight className="size-4 -rotate-90" />
                </button>
                <button
                  onClick={() => moveDraft(i, 1)}
                  disabled={i === drafts.length - 1}
                  aria-label="Descendre"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ArrowRight className="size-4 rotate-90" />
                </button>
                <button
                  onClick={() => removeDraft(q.localId)}
                  aria-label="Supprimer la question"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            <input
              value={q.title}
              onChange={(e) => updateDraft(q.localId, { title: e.target.value })}
              placeholder="Intitulé de la question"
              className="mt-3 w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm font-medium outline-none ring-ring transition-shadow focus:ring-2"
            />

            {(q.type === "quiz" || q.type === "ranking") && (
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    {q.type === "quiz" ? (
                      <button
                        onClick={() =>
                          updateDraft(q.localId, {
                            correctOption: q.correctOption === oi ? null : oi,
                          })
                        }
                        title="Définir comme bonne réponse (re-cliquez pour annuler)"
                        aria-label="Bonne réponse"
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                          q.correctOption === oi
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {oi + 1}
                      </button>
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-input bg-background text-xs font-bold text-muted-foreground">
                        {oi + 1}
                      </span>
                    )}
                    <input
                      value={opt}
                      onChange={(e) =>
                        updateDraft(q.localId, {
                          options: q.options.map((o, x) => (x === oi ? e.target.value : o)),
                        })
                      }
                      placeholder={`Proposition ${oi + 1}`}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-ring transition-shadow focus:ring-2"
                    />
                    <button
                      onClick={() =>
                        updateDraft(q.localId, { options: q.options.filter((_, x) => x !== oi) })
                      }
                      aria-label="Retirer l'option"
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                {q.options.length < 10 && (
                  <button
                    onClick={() => updateDraft(q.localId, { options: [...q.options, ""] })}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    + Ajouter une proposition
                  </button>
                )}
                {q.type === "quiz" && (
                  <p className="text-xs text-muted-foreground">
                    Cliquez sur un numéro pour définir la bonne réponse. Sans bonne réponse, la
                    question devient un sondage.
                  </p>
                )}
              </div>
            )}

            {q.type === "wordcloud" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Les participants envoient chacun un mot ; les plus fréquents s'affichent en grand.
              </p>
            )}
            {q.type === "open" && (
              <p className="mt-3 text-xs text-muted-foreground">
                Les participants écrivent une réponse libre qui s'affiche en direct.
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-10 w-full rounded-full bg-primary px-7 py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {submitting ? "Création en cours…" : "Créer l'événement"}
      </button>
    </div>
  );
}
