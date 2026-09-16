# Quizz-App — application interactive inspirée de Wooclap

## Vue d'ensemble

Application web d'interactivité pour groupes : un animateur crée un événement, obtient un code à 6 caractères, et les participants rejoignent depuis leur téléphone **sans compte ni inscription**. Les réponses s'affichent en direct sur l'écran de l'animateur.

**Décisions confirmées :** 4 types d'interactions (quiz/sondages, nuage de mots, questions ouvertes, classements/votes), accès par code d'événement sans inscription, tous publics, nom « Quizz-App ».

## Design

- Palette dynamique : orange #ff6b35, ambre #f7931e, rose #e84393, violet #6c5ce7 — définis comme tokens sémantiques oklch dans src/styles.css (mode clair + sombre).
- Typographie : Space Grotesk (titres) + DM Sans (texte), chargées via `<link>` dans __root.tsx.
- Page d'accueil : hero-grid marketing (bannière + cartes de fonctionnalités), puis entrée dans l'app.
- Ton visuel : énergique et ludique, adapté à l'animation de groupe.

## Parcours utilisateurs

### Animateur (aucun compte requis)
1. `/create` — saisit un titre d'événement, ajoute ses questions (les 4 types), obtient un **code d'événement** et un **lien animateur** privé (token aléatoire) à conserver.
2. `/presenter/$token` — écran de présentation : affiche la question en cours, lance les réponses, montre les résultats en temps réel, passe à la question suivante.

### Participant
1. `/join` — saisit le code d'événement.
2. `/e/$code` — répond à la question affichée par l'animateur, un type d'interface par type de question (boutons de choix, champ de mot, zone de texte, étoiles/classement).

## Backend — Lovable Cloud

Tables (RLS activé, grants conformes) :
- `events` — id, code (unique, 6 car.), title, admin_token, current_question_id, created_at
- `questions` — id, event_id, type (quiz | wordcloud | open | rating), title, options (jsonb), correct_option, position
- `responses` — id, question_id, event_id, participant_id (uuid local), content (jsonb), created_at

Temps réel : les écrans animateur et participant s'abonnent aux changements via Supabase Realtime (canal Postgres Changes) pour les mises à jour en direct — résultats qui montent, question en cours qui change.

Logique serveur : fonctions serveur TanStack (`src/lib/*.functions.ts`) pour créer l'événement, générer codes/tokens uniques, enregistrer une réponse, piloter la question en cours. Pas d'authentification utilisateur.

## Pages (routes)

- `/` — accueil marketing : hero, cartes des 4 types d'interactions, double CTA « Créer un événement » / « Rejoindre avec un code ». head() SEO propre.
- `/create` — assistant de création (titre + ajout de questions par type).
- `/presenter/$token` — écran animateur avec résultats live.
- `/join` puis `/e/$code` — parcours participant.
- Chaque route a son head() unique (title, description, og).

## Hors périmètre (pour une v1)

Comptes utilisateurs, export de résultats, présentation plein écran avancée, modération des questions ouvertes.
