import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

function normalizeWord(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)[0]
    .replace(/[^\p{L}\p{N}'-]/gu, "")
    .slice(0, 40)
    .toLowerCase();
}

/** Validates raw participant content for a question type; returns normalized JSON content. */
function normalizeContent(
  type: string,
  optionsCount: number,
  content: unknown,
): { ok: true; content: Record<string, unknown> } | { ok: false; error: string } {
  switch (type) {
    case "quiz": {
      const option = content;
      if (typeof option !== "number" || !Number.isInteger(option) || option < 0 || option >= optionsCount) {
        return { ok: false, error: "Réponse invalide." };
      }
      return { ok: true, content: { option } };
    }
    case "wordcloud": {
      if (typeof content !== "string") return { ok: false, error: "Réponse invalide." };
      const word = normalizeWord(content);
      if (!word) return { ok: false, error: "Envoyez un mot." };
      return { ok: true, content: { word } };
    }
    case "open": {
      if (typeof content !== "string") return { ok: false, error: "Réponse invalide." };
      const text = content.trim().slice(0, 500);
      if (!text) return { ok: false, error: "Votre réponse est vide." };
      return { ok: true, content: { text } };
    }
    case "ranking": {
      if (!Array.isArray(content) || content.length !== optionsCount) {
        return { ok: false, error: "Classement incomplet." };
      }
      const order = content as unknown[];
      const seen = new Set<number>();
      for (const o of order) {
        if (typeof o !== "number" || !Number.isInteger(o) || o < 0 || o >= optionsCount || seen.has(o)) {
          return { ok: false, error: "Classement invalide." };
        }
        seen.add(o);
      }
      return { ok: true, content: { order } };
    }
    default:
      return { ok: false, error: "Type de question inconnu." };
  }
}

const questionInput = z
  .object({
    type: z.enum(["quiz", "wordcloud", "open", "ranking"]),
    title: z.string().trim().min(1, "Intitulé requis").max(300),
    options: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
    correctOption: z.number().int().min(0).max(9).nullable().default(null),
  })
  .refine(
    (q) => q.type === "quiz" || q.type === "ranking" || q.options.length === 0,
    { message: "Ce type de question n'utilise pas d'options." },
  );

export const createEvent = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        title: z.string().trim().min(1, "Titre requis").max(120),
        questions: z.array(questionInput).min(1, "Ajoutez au moins une question").max(50),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ code: string; adminToken: string } | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (table: string) => any };

    for (const q of data.questions) {
      if (q.type === "quiz" || q.type === "ranking") {
        if (q.options.length < 2) {
          return { error: "Chaque question à choix ou classement doit proposer au moins 2 options." };
        }
        if (q.type === "quiz" && q.correctOption != null && q.correctOption >= q.options.length) {
          return { error: "La bonne réponse choisie n'existe pas dans les options." };
        }
      }
et    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateCode();
      const adminToken = crypto.randomUUID();
      const { data: ev, error } = await db
        .from("events")
        .insert({ code, title: data.title })
        .select("id, code")
        .single();
      if (error) {
        lastError = error;
        continue; // code collision, retry
      }
      const { error: adminErr } = await db
        .from("event_admins")
        .insert({ event_id: ev.id, admin_token: adminToken });
      if (adminErr) return { error: "Impossible de créer l'événement. Réessayez." };
      const { error: qErr } = await db.from("questions").insert(
        data.questions.map((q, i) => ({
          event_id: ev.id,
          type: q.type,
          title: q.title,
          options: q.options,
          correct_option: q.correctOption,
          position: i,
        })),
      );
      if (qErr) return { error: "Impossible d'enregistrer les questions. Réessayez." };
      return { code: ev.code as string, adminToken };
    }
    console.error("createEvent failed", lastError);
    return { error: "Impossible de générer un code d'événement. Réessayez." };
  });

export const getPresenterState = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<PresenterStateOrError> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (table: string) => any };

    const { data: admin } = await db
      .from("event_admins")
      .select("event_id")
      .eq("admin_token", data.token)
      .maybeSingle();
    if (!admin) return { error: "Lien animateur invalide ou expiré." };

    const { data: ev, error } = await db
      .from("events")
      .select("id, code, title, current_question_id")
      .eq("id", admin.event_id)
      .single();
    if (error || !ev) return { error: "Événement introuvable." };

    const { data: questions } = await db
      .from("questions")
      .select("id, type, title, options, correct_option, position")
      .eq("event_id", ev.id)
      .order("position", { ascending: true });

    return {
      event: { id: ev.id, code: ev.code, title: ev.title, currentQuestionId: ev.current_question_id },
      questions: (questions ?? []).map((q: any) => ({
        id: q.id,
        type: q.type,
        title: q.title,
        options: (q.options ?? []) as string[],
        correctOption: q.correct_option ?? null,
        position: q.position,
      })),
    };
  });

export const setCurrentQuestion = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ token: z.string().uuid(), questionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (table: string) => any };

    const { data: admin } = await db
      .from("event_admins")
      .select("event_id")
      .eq("admin_token", data.token)
      .maybeSingle();
    if (!admin) return { error: "Lien animateur invalide." };

    const { data: question } = await db
      .from("questions")
      .select("id, event_id")
      .eq("id", data.questionId)
      .maybeSingle();
    if (!question || question.event_id !== admin.event_id) {
      return { error: "Question introuvable dans cet événement." };
    }

    const { error } = await db
      .from("events")
      .update({ current_question_id: data.questionId })
      .eq("id", admin.event_id);
    if (error) return { error: "Impossible de changer de question. Réessayez." };
    return { ok: true };
  });

export const submitResponse = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        code: z.string().trim().length(6),
        questionId: z.string().uuid(),
        participantId: z.string().uuid(),
        content: z.unknown(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true } | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (table: string) => any };

    const { data: ev } = await db
      .from("events")
      .select("id, current_question_id")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!ev) return { error: "Événement introuvable." };
    if (ev.current_question_id !== data.questionId) {
      return { error: "Cette question n'est plus ouverte." };
    }

    const { data: question } = await db
      .from("questions")
      .select("type, options")
      .eq("id", data.questionId)
      .single();
    if (!question) return { error: "Question introuvable." };

    const normalized = normalizeContent(
      question.type,
      ((question.options ?? []) as unknown[]).length,
      data.content,
    );
    if (!normalized.ok) return { error: normalized.error };

    const { error } = await db.from("responses").insert({
      event_id: ev.id,
      question_id: data.questionId,
      participant_id: data.participantId,
      content: normalized.content,
    });
    if (error) return { error: "Impossible d'enregistrer la réponse. Réessayez." };
    return { ok: true };
  });

export const getParticipantEvent = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ code: z.string().trim().length(6) }).parse(data))
  .handler(async ({ data }): Promise<ParticipantState | { error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (table: string) => any };

    const { data: ev } = await db
      .from("events")
      .select("id, code, title, current_question_id")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();
    if (!ev) return { error: "Aucun événement avec ce code." };

    let currentQuestion: QuestionData | null = null;
    if (ev.current_question_id) {
      const { data: q } = await db
        .from("questions")
        .select("id, type, title, options, correct_option, position")
        .eq("id", ev.current_question_id)
        .maybeSingle();
      if (q) {
        currentQuestion = {
          id: q.id,
          type: q.type,
          title: q.title,
          options: (q.options ?? []) as string[],
          correctOption: q.correct_option ?? null,
          position: q.position,
        };
      }
    }

    return {
      event: { id: ev.id, code: ev.code, title: ev.title, currentQuestionId: ev.current_question_id },
      currentQuestion,
    };
  });

type PresenterStateOrError =
  | import("./quizz.types").PresenterState
  | import("./quizz.types").FunctionError;
