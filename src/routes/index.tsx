import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ListChecks,
  Cloud,
  MessageSquareText,
  ArrowUpDown,
  PencilRuler,
  Share2,
  Presentation,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quizz-App — Quiz, sondages et interactions en temps réel" },
      {
        name: "description",
        content:
          "Animez votre cours, réunion ou soirée : quiz, nuages de mots, questions ouvertes et classements en direct. Un code suffit pour participer, sans inscription.",
      },
      { property: "og:title", content: "Quizz-App — Faites participer votre salle en un code" },
      {
        property: "og:description",
        content:
          "Créez un événement interactif en 30 secondes. Les participants répondent depuis leur téléphone, les résultats s'affichent en direct.",
      },
      { property: "og:type", content: "website" },
ec      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: ListChecks,
    title: "Quiz & sondages",
    text: "Questions à choix multiples avec ou sans bonne réponse. Les barres de résultats montent en direct.",
    color: "bg-primary",
  },
  {
    icon: Cloud,
    title: "Nuage de mots",
    text: "Chacun envoie un mot : les plus populaires s'affichent en grand pour résumer l'avis du groupe.",
    color: "bg-secondary",
  },
  {
    icon: MessageSquareText,
    title: "Questions ouvertes",
    text: "Réponses libres qui apparaissent une à une — parfait pour recueillir des idées ou des ressentis.",
    color: "bg-accent",
  },
  {
    icon: ArrowUpDown,
    title: "Classements",
    text: "Les participants ordonnent les propositions ; le classement moyen se révèle au fur et à mesure.",
    color: "bg-sun",
  },
];

const steps = [
  {
    icon: PencilRuler,
    title: "1. Créez votre événement",
    text: "Ajoutez vos questions en quelques clics — les quatre types d'interactions sont disponibles.",
  },
  {
    icon: Share2,
    title: "2. Partagez le code",
    text: "Un code à 6 caractères suffit. Vos participants rejoignent depuis leur téléphone, sans compte.",
  },
  {
    icon: Presentation,
    title: "3. Animez en direct",
    text: "Lancez les questions une par une et regardez les réponses et résultats s'afficher en temps réel.",
  },
];

function Index() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length === 6) {
      navigate({ to: "/e/$code", params: { code } });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Zap className="size-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">Quizz-App</span>
        </div>
        <Link
          to="/create"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-85"
        >
          Créer un événement
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-12 text-center md:pt-20">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-muted-foreground">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          Interaction en temps réel, sans inscription
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          Faites participer votre salle{" "}
          <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            en un simple code
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
          Quiz, nuages de mots, questions ouvertes et classements. Vos participants répondent
          depuis leur téléphone, les résultats s'affichent en direct.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/create"
            className="w-full rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 sm:w-auto"
          >
            Créer un événement
          </Link>
          <div className="flex w-full max-w-sm items-center gap-2 rounded-full border border-border bg-card p-1.5 pl-5 shadow-sm sm:w-auto">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="CODE"
              aria-label="Code de l'événement"
              className="w-full min-w-0 bg-transparent font-display text-lg font-bold uppercase tracking-[0.3em] outline-none placeholder:text-muted-foreground/50"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.trim().length !== 6}
              className="shrink-0 rounded-full bg-secondary px-5 py-2.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/90 disabled:opacity-40"
            >
              Rejoindre
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-center text-2xl font-bold md:text-3xl">
          Quatre façons de faire parler votre groupe
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-3xl border border-border bg-card p-6 shadow-sm transition-transform hover:-translate-y-1"
            >
              <span
                className={`flex size-11 items-center justify-center rounded-2xl ${f.color} text-white`}
              >
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="border-y border-border bg-card/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold md:text-3xl">Comment ça marche ?</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title} className="text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-border bg-background text-primary">
                  <s.icon className="size-5" />
                </span>
                <h3 className="mt-4 font-bold">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground">
            <Zap className="size-3.5" />
          </span>
          <span className="font-display font-bold text-foreground">Quizz-App</span>
        </div>
        <p>Interactivité en temps réel pour vos cours, réunions et événements.</p>
      </footer>
    </div>
  );
}
