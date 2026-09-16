import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { Copy, Play, SkipForward, Users } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getPresenterState, setCurrentQuestion } from "@/lib/quizz.functions";
import { QUESTION_TYPE_LABELS, type QuestionData } from "@/lib/quizz.types";

export const Route = createFileRoute("/presenter/$token")({
  head: () => ({
    meta: [
      { title: "Écran animateur — Quizz-App" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params, context }) => {
    const state = await context.queryClient.ensureQueryData({
      queryKey: ["presenter", params.token],
      queryFn: () => getPresenterState({ data: { token: params.token } }),
    });
    if ("error" in state) throw notFound();
  },
  component: PresenterPage,
});

interface ResponseRow {
  participant_id: string;
  content: { option?: number; word?: string; text?: string; order?: number[] };
  created_at: string;
}

function PresenterPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getPresenterState);
  const switchQuestion = useServerFn(setCurrentQuestion);

  const { data: state } = useSuspenseQuery({
    queryKey: ["presenter", token],
    queryFn: () => fetchState({ data: { token } }),
  });
  const event = "event" in state ? state.event : null;
  const questions = "questions" in state ? state.questions : [];
  const currentQuestion =
    questions.find((q) => q.id === event?.currentQuestionId) ?? null;

  // Realtime: incoming responses refresh the results
  useEffect(() => {
    if (!event) return;
    const channel = supabase
      .channel(`presenter-${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "responses", filter: `event_id=eq.${event.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["responses"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `id=eq.${event.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["responses"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [event, queryClient]);

  const { data: responses = [] } = useQuery({
    queryKey: ["responses", currentQuestion?.id ?? "none"],
    queryFn: async (): Promise<ResponseRow[]> => {
      if (!currentQuestion) return [];
      const { data, error } = await supabase
        .from("responses")
        .select("participant_id, content, created_at")
        .eq("question_id", currentQuestion.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ResponseRow[];
    },
    enabled: !!currentQuestion,
  });

  const switchMutation = useMutation({
    mutationFn: (questionId: string) => switchQuestion({ data: { token, questionId } }),
    onError: (e) => toast.error(e.message),
    onSuccess: (result) => {
      if (result && "error" in result) toast.error(result.error);
      else queryClient.invalidateQueries({ queryKey: ["presenter", token] });
    },
  });

  const launchNext = () => {
    const next = currentQuestion
      ? questions.find((q) => q.position === currentQuestion.position + 1)
      : questions[0];
    if (next) switchMutation.mutate(next.id);
  };

  const joinUrl = `${window.location.origin}/join`;

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Lien animateur invalide.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/70 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">{event.title}</p>
            <p className="text-xs text-muted-foreground">Écran animateur</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="rounded-2xl bg-secondary px-5 py-2 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-secondary-foreground/80">
                Code à partager
              </p>
              <p className="font-display text-2xl font-bold tracking-[0.15em] text-secondary-foreground">
                {event.code}
              </p>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(joinUrl);
                toast.success("Lien de participation copié !");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Copy className="size-4" /> Copier le lien
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[280px_1fr]">
        {/* Question list */}
        <aside className="order-2 lg:order-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Questions ({questions.length})
          </p>
          <div className="mt-3 space-y-2">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => switchMutation.mutate(q.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                  q.id === event.currentQuestionId
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  {i + 1} · {QUESTION_TYPE_LABELS[q.type]}
                </span>
                <span className="mt-0.5 block truncate text-sm font-medium">{q.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Stage */}
        <section className="order-1 lg:order-2">
          {currentQuestion ? (
            <div className="rounded-4xl border border-border bg-card p-8 shadow-sm md:p-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {QUESTION_TYPE_LABELS[currentQuestion.type]}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  {new Set(responses.map((r) => r.participant_id)).size} réponse(s)
                </span>
                <div className="ml-auto flex gap-2">
                  <button
                    onClick={launchNext}
                    disabled={!questions.some((q) => q.position === currentQuestion.position + 1)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-40"
                  >
                    <SkipForward className="size-4" /> Question suivante
                  </button>
                </div>
              </div>

              <h2 className="mt-4 text-2xl font-bold md:text-4xl">{currentQuestion.title}</h2>

              <div className="mt-10">
                <ResultsPanel question={currentQuestion} responses={responses} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-4xl border border-border bg-card p-12 text-center shadow-sm">
              <span className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary to-accent text-white">
                <Play className="size-7" />
              </span>
              <h2 className="mt-6 text-2xl font-bold">Prêt à lancer ?</h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Partagez le code <span className="font-bold text-foreground">{event.code}</span>{" "}
                avec vos participants, puis lancez la première question.
              </p>
              <button
                onClick={launchNext}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
              >
                <Play className="size-5" /> Lancer la première question
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="px-6 pb-8 text-center">
        <Link to="/" className="text-xs text-muted-foreground transition-colors hover:text-foreground">
          Quizz-App — les participants rejoignent depuis la page d'accueil avec le code
        </Link>
      </footer>
    </div>
  );
}

/** Keeps only the latest response of each participant. */
function latestContents(responses: ResponseRow[]) {
  const map = new Map<string, ResponseRow["content"]>();
  for (const r of responses) map.set(r.participant_id, r.content);
  return [...map.values()];
}

function ResultsPanel({ question, responses }: { question: QuestionData; responses: ResponseRow[] }) {
  const contents = latestContents(responses);

  if (contents.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Les réponses des participants apparaîtront ici en temps réel.
      </p>
    );
  }

  if (question.type === "quiz") {
    const counts = question.options.map(
      (_, i) => contents.filter((c) => c.option === i).length,
    );
    const total = Math.max(1, contents.length);
    return (
      <div className="space-y-3">
        {question.options.map((opt, i) => {
          const pct = Math.round((counts[i] / total) * 100);
          const isCorrect = question.correctOption === i;
          return (
            <div key={i}>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium">
                <span>
                  {opt}
                  {isCorrect && <span className="ml-2 font-bold text-secondary">✓ bonne réponse</span>}
                </span>
                <span className="ml-auto text-muted-foreground">
                  {counts[i]} · {pct}%
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${isCorrect ? "bg-secondary" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (question.type === "wordcloud") {
    const counts = new Map<string, number>();
    for (const c of contents) {
      const w = (c.word ?? "").toLowerCase();
      if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = entries[0]?.[1] ?? 1;
    const colors = ["text-primary", "text-secondary", "text-accent", "text-sun"];
    return (
      <div className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-2 p-4">
        {entries.map(([word, count], i) => (
          <span
            key={word}
            className={`font-display font-bold ${colors[i % colors.length]}`}
            style={{ fontSize: `${1 + (count / max) * 1.9}rem` }}
          >
            {word}
            <span className="ml-1 align-super text-xs font-semibold text-muted-foreground">
              {count}
            </span>
          </span>
        ))}
      </div>
    );
  }

  if (question.type === "open") {
    return (
      <div className="grid max-h-[420px] gap-2.5 overflow-y-auto sm:grid-cols-2">
        {[...contents].reverse().map((c, i) => (
          <div key={i} className="rounded-2xl bg-muted px-4 py-3 text-sm">
            {c.text}
          </div>
        ))}
      </div>
    );
  }

  // ranking
  const sums = question.options.map(() => 0);
  let voters = 0;
  for (const c of contents) {
    if (Array.isArray(c.order) && c.order.length === question.options.length) {
      c.order.forEach((optionIndex, rank) => {
        sums[optionIndex] = (sums[optionIndex] ?? 0) + rank + 1;
      });
      voters++;
    }
  }
  const averages = sums.map((s) => s / Math.max(1, voters));
  const ranking = question.options
    .map((opt, i) => ({ opt, avg: averages[i] ?? 0 }))
    .sort((a, b) => a.avg - b.avg);
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-muted-foreground">Classement moyen ({voters} vote(s))</p>
      {ranking.map((r, i) => (
        <div
          key={r.opt}
          className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3"
        >
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{r.opt}</span>
          <span className="text-sm text-muted-foreground">moy. {r.avg.toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}
