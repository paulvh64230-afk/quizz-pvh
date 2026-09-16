import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, LogIn } from "lucide-react";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Rejoindre un événement — Quizz-App" },
      {
        name: "description",
        content: "Saisissez le code à 6 caractères de votre événement pour participer en direct.",
      },
      { property: "og:title", content: "Rejoindre un événement — Quizz-App" },
      { property: "og:description", content: "Entrez le code de l'événement et participez en direct." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinPage,
});

function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const handleJoin = () => {
    const normalized = code.trim().toUpperCase();
    if (normalized.length === 6) {
      navigate({ to: "/e/$code", params: { code: normalized } });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-3xl font-bold">Rejoindre un événement</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Saisissez le code à 6 caractères affiché par votre animateur.
        </p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          placeholder="ABC123"
          aria-label="Code de l'événement"
          autoFocus
          className="mt-8 w-full rounded-3xl border-2 border-input bg-card px-6 py-5 text-center font-display text-4xl font-bold uppercase tracking-[0.3em] outline-none ring-ring transition-shadow placeholder:text-muted-foreground/30 focus:border-primary focus:ring-2 focus:ring-ring"
        />

        <button
          onClick={handleJoin}
          disabled={code.length !== 6}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90 disabled:opacity-40"
        >
          <LogIn className="size-5" /> Rejoindre
        </button>

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
