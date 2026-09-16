import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useServerFn, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, PencilLine, Send, ChevronUp, ChevronDown } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getParticipantEvent, submitResponse } from "@/lib/quizz.functions";
import type { QuestionData } from "@/lib/quizz.types";

export const Route = createFileRoute("/e/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Événement ${params.code.toUpperCase()} — Quizz-App` },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params, context }) => {
    const code = params.code.toUpperCase();
    const state = await context.queryClient.ensureQueryData({
      queryKey: ["participant", code],
      queryFn: () => getParticipantEvent({ data: { code } }),
    });
    if ("error" in state) throw notFound();
  },
  component: ParticipantPage,
});

function ParticipantPage() {
  const { code } = Route.useParams();
  const codeUpper = code.toUpperCase();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getParticipantEvent);
  const submit = useServerFn(submitResponse);

  const { data: state } = useSuspenseQuery({
    queryKey: ["participant", codeUpper],
    queryFn: () => fetchState({ data: { code: codeUpper } }),
  });
  const { event, currentQuestion } = state;

  // Realtime: refresh when the presenter switches question
  useEffect(() => {
    const channel = supabase
      .channel(`event-${event.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: `id=eq.${event.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["participant", codeUpper] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, codeUpper, queryClient]);

  // Stable anonymous participant id (no account needed)
  const [participantId, setParticipantId] = useState<string | null>(null);
  useEffect(() => {
    let id = localStorage.getItem("quizz_participant_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("quizz_participant_id", id);
    }
    setParticipantId(id);
  }, []);

  const mutation = useMutation({
    mutationFn: async ({
      questionId,
      content,
    }: {
      questionId: string;
      content: unknown;
    }) => {
      if (!participantId) throw new Error("Préparation…");
      return submit({ data: { code: codeUpper, questionId, participantId, content } });
    },
    onError: (e) => toast.error(e.message),
    onSuccess: (result) => {
      if (result && "error" in result) toast.error(result.error);
    },
  });

  if ("error" in state) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <p>{state.error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card/70 px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{event.title}</p>
            <p className="text-xs text-muted-foreground">Événement {event.code}</p>
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-bold tracking-widest text-secondary-foreground">
            {event.code}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        {currentQuestion && participantId ? (
          <AnswerForm
            key={currentQuestion.id}
            question={currentQuestion}
            onSubmit={(content) => mutation.mutateAsync({ questionId: currentQuestion.id, content })}
            submitting={mutation.isPending}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="relative flex size-5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-5 rounded-full bg-primary" />
            </span>
            <h2 className="mt-6 text-2xl font-bold">En attente de l'animateur…</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              La question va s'afficher ici dès que l'animateur la lance. Gardez cette page ouverte
              !
            </p>
          </div>
        )}
      </main>

      <footer className="px-6 pb-8">
        <button
          onClick={() => navigate({ to: "/join" })}
          className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Rejoindre un autre événement
        </button>
      </footer>
    </div>
  );
}

function AnswerForm({
  question,
  onSubmit,
  submitting,
}: {
  question: QuestionData;
  onSubmit: (content: unknown) => Promise<unknown>;
  submitting: boolean;
}) {
  const [submitted, setSubmitted] = useState<unknown>(null);

  const handleSend = async (content: unknown) => {
    const result = await onSubmit(content);
    if (result && typeof result === "object" && "ok" in result) {
      setSubmitted(content);
      toast.success("Réponse envoyée !");
    }
  };

  if (submitted !== null) {
    const isQuiz = question.type === "quiz";
    const chosen = isQuiz && typeof submitted === "object" && submitted !== null && "option" in submitted
      ? (submitted as { option: number }).option
      : null;
    const correct = chosen != null && question.correctOption === chosen;
    return (
      <div className="rounded-4xl border border-border bg-card p-10 text-center shadow-sm">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="size-7" />
        </span>
        <h2 className="mt-4 text-2xl font-bold">
          {isQuiz && question.correctOption != null
            ? correct
              ? "Bonne réponse !"
              : "Réponse envoyée"
            : "Réponse envoyée !"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Suivez les résultats sur l'écran de l'animateur.
        </p>
        <button
          onClick={() => setSubmitted(null)}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
        >
          <PencilLine className="size-4" /> Modifier ma réponse
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Question en cours
      </p>
      <h2 className="mt-2 text-2xl font-bold md:text-3xl">{question.title}</h2>

      <div className="mt-8">
        {question.type === "quiz" && <QuizForm question={question} onSend={handleSend} submitting={submitting} />}
        {question.type === "wordcloud" && <WordcloudForm onSend={handleSend} submitting={submitting} />}
        {question.type === "open" && <OpenForm onSend={handleSend} submitting={submitting} />}
        {question.type === "ranking" && <RankingForm question={question} onSend={handleSend} submitting={submitting} />}
      </div>
    </div>
  );
}

function QuizForm({
  question,
  onSend,
  submitting,
}: {
  question: QuestionData;
  onSend: (content: number) => Promise<unknown>;
  submitting: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {question.options.map((opt, i) => (
        <button
          key={i}
          onClick={() => setSelected(i)}
          className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left font-medium transition-all ${
            selected === i
              ? "border-primary bg-primary/10"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <span
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              selected === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            {i + 1}
          </span>
          {opt}
        </button>
      ))}
      <button
        onClick={() => selected != null && onSend(selected)}
        disabled={selected == null || submitting}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        <Send className="size-4" /> {submitting ? "Envoi…" : "Envoyer ma réponse"}
      </button>
    </div>
  );
}

function WordcloudForm({
  onSend,
  submitting,
}: {
  onSend: (content: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [word, setWord] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (word.trim()) onSend(word);
      }}
      className="space-y-3"
    >
      <input
        value={word}
        onChange={(e) => setWord(e.target.value)}
        placeholder="Votre mot (un seul)"
        maxLength={40}
        className="w-full rounded-2xl border-2 border-input bg-card px-5 py-4 text-lg outline-none ring-ring transition-shadow placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={!word.trim() || submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        <Send className="size-4" /> {submitting ? "Envoi…" : "Envoyer mon mot"}
      </button>
    </form>
  );
}

function OpenForm({
  onSend,
  submitting,
}: {
  onSend: (content: string) => Promise<unknown>;
  submitting: boolean;
}) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) onSend(text);
      }}
      className="space-y-3"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Écrivez votre réponse…"
        rows={4}
        maxLength={500}
        className="w-full resize-none rounded-2xl border-2 border-input bg-card px-5 py-4 text-base outline-none ring-ring transition-shadow placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={!text.trim() || submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        <Send className="size-4" /> {submitting ? "Envoi…" : "Envoyer ma réponse"}
      </button>
    </form>
  );
}

function RankingForm({
  question,
  onSend,
  submitting,
}: {
  question: QuestionData;
  onSend: (content: number[]) => Promise<unknown>;
  submitting: boolean;
}) {
  const [order, setOrder] = useState<number[]>(question.options.map((_, i) => i));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Classez les propositions de la meilleure (1) à la moins bonne.
      </p>
      {order.map((optionIndex, rank) => (
        <div
          key={optionIndex}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
            {rank + 1}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">{question.options[optionIndex]}</span>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={() => move(rank, -1)}
              disabled={rank === 0}
              aria-label="Monter"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronUp className="size-4" />
            </button>
            <button
              onClick={() => move(rank, 1)}
              disabled={rank === order.length - 1}
              aria-label="Descendre"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
            >
              <ChevronDown className="size-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        onClick={() => onSend(order)}
        disabled={submitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-40"
      >
        <Send className="size-4" /> {submitting ? "Envoi…" : "Envoyer mon classement"}
      </button>
    </div>
  );
}
