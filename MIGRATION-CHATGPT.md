# 🚀 Migration ChatGPT — Fidelity (« On mange quoi »)

> **Mise à jour du 8 septembre 2026 :** export Apple Wallet signé, protocole de mise à jour APNs et scan des cartes Wallet ajoutés. Le certificat Pass Type ID a été créé et vérifié ; il doit être installé dans les secrets du serveur public. Lire [CARTES-WALLET.md](CARTES-WALLET.md) pour les variables `APPLE_WALLET_*`, les migrations, le modèle de sécurité et les essais iPhone. Les offres sont désormais persistées en JSON dans `Restaurant.offers`. Likes et abonnements des vrais comptes passent par `/social/…`. Lire [PREPARATION-APPLE.md](PREPARATION-APPLE.md) : le projet reste un site web, plusieurs prérequis de soumission iOS sont encore absents. Aucune garantie d'acceptation Apple.

> **Profils — compteurs du 6 septembre 2026 :** grille commune à trois colonnes, nombres au-dessus des libellés. Publications, abonnés et abonnements sur la première ligne ; restaurants, visites et avis dans la démo sur la seconde. Les vrais profils reçoivent les totaux `Follow` depuis l’API publique, sans exposer de liste privée. Les nombres des profils démo sont illustratifs et leur bouton Suivre reste une simulation locale.

> **Correction Discovery du 6 septembre 2026 :** pseudo, avatar et nom dans le texte ouvrent le profil de l’auteur. Les FoodShare transportent son identifiant serveur ; le restaurant identifié reste accessible par son lien dédié. Un profil public est chargé directement, même sans passage par la recherche. Aucun e-mail n’est exposé. Vérification : `cd app && node scripts/test-discovery.mjs` (7 scénarios), FoodShare (20), sécurité (26).

> **Mise à jour sécurité et caisse du 6 septembre 2026 :** lire [SECURITE-ET-SCAN.md](SECURITE-ET-SCAN.md). Le scan caméra/code temporaire est branché au registre serveur ; les QR sont valables deux minutes et à usage unique. Les sections historiques ci-dessous décrivent aussi des éléments de démonstration.

> **À lire en premier.** Ce fichier explique comment transférer le projet dans ChatGPT.
> Date de préparation : 5 septembre 2026.

---

## 1. Comment utiliser ce package dans ChatGPT

Tu as **3 fichiers** à disposition :

| Fichier | À quoi il sert | Comment l'utiliser dans ChatGPT |
|---|---|---|
| `FIDELITY-CODE-COMPLET.md` | **Tout le code source** du projet dans un seul fichier texte | Uploade-le en début de conversation (ou colle-le si l'upload échoue). ChatGPT aura ainsi tout le code sous les yeux. |
| `fidelity-projet.zip` | Le projet complet prêt à décompresser (code + config + assets) | Pour récupérer le projet sur une autre machine. ChatGPT peut aussi l'ouvrir avec son interpréteur de code. |
| `MIGRATION-CHATGPT.md` (ce fichier) | La passation : vision, architecture, état, roadmap | Lis-le toi, et uploade-le aussi dans ChatGPT : il sert de briefing. |

**Message de démarrage conseillé à coller dans ChatGPT** (après upload des fichiers) :

```
Voici mon projet "Fidelity" : un réseau social de restauration dont le cœur est
la carte de fidélité digitale. Le fichier MIGRATION-CHATGPT.md contient la
passation complète, FIDELITY-CODE-COMPLET.md contient tout le code source
(frontend React + backend Fastify/Prisma). Lis-les, confirme-moi que tu as
compris l'architecture, et attends mes instructions.
```

---

## 2. La vision

Un **réseau social pour les restaurants** dont le cœur de métier est la **carte de fidélité digitale**
(coches ou points, paliers de récompenses). La couche sociale (fil Discovery, stories, FoodShare)
crée l'engagement et l'acquisition gratuite. Deux interfaces distinctes : **membre** (client) et
**restaurateur** (dashboard, façade, FoodShare, établissements).

Contrainte n°1 : **budget quasi nul** — tout repose sur des free tiers (Supabase, Render, Vercel).

---

## 3. Architecture

```
OnMangeQuoi/
├── app/                    → FRONTEND : React 18 + TypeScript + Vite
│   ├── src/App.tsx         → routeur maison (état React, pas de react-router)
│   ├── src/nav.ts          → types de routes + props partagées (CommonProps)
│   ├── src/data.ts         → données de démo (6 restos, membres, visites, avis)
│   ├── src/lib/api.ts      → PONT front ↔ backend (repli démo si API éteinte)
│   ├── src/pages/          → Home, Search, Discovery, Restaurant, Loyalty,
│   │                         Settings, Member, Dashboard (resto), Studio, Share
│   ├── src/components/kit.tsx → composants maison (LoyaltyCard, Tabs, etc.)
│   └── src/components/ui/  → boilerplate shadcn INUTILISÉ (ignorer)
│
├── backend/                → BACKEND : Node + Fastify + Prisma + PostgreSQL (Supabase)
│   ├── prisma/schema.prisma → 12 tables (le modèle de données complet)
│   ├── prisma/seed.ts      → données de démo (6 restos + comptes)
│   ├── src/server.ts       → entrée : CORS, sécurité, routes, front statique
│   ├── src/lib/            → auth (Bearer), tokens, security (headers, rate limit)
│   ├── src/routes/         → auth, restaurants, memberships, ledger, shares
│   └── scripts/            → test-api.mjs (27 tests), test-shares.mjs (18 tests)
│
└── render.yaml             → déploiement Render (build front + backend, API sert le front)
```

**Principe clé du front** : l'app fonctionne TOUJOURS. Si l'API ne répond pas, elle bascule sur
les données de démonstration (`data.ts`) sans rien casser. `api.ts` fusionne les vraies données
backend avec la démo (correspondance slug backend ↔ id front dans `SLUG_TO_ID`).

---

## 4. État du projet (au 5 septembre 2026)

### ✅ Terminé et testé

- **Frontend complet** : accueil, recherche (filtres régimes/horaires/personnes/prix/distance),
  Discovery (fil + stories + recherche d'utilisateurs), pages restaurant, cartes de fidélité
  avec paliers, profil membre (visites, avis, restaurants likés), espace restaurateur
  (Résumé/dashboard, Façade, FoodShare, Établissements avec franchises et suppression en 2 temps).
- **Offres & promotions** : chaque restaurant a des offres (happy hour, 1 acheté = 1 offert,
  promo, offre du moment) affichées dans l'onglet **« Infos & promos »** de sa page — section
  « Promotions » en tête, **visuellement distincte du programme fidélité**, avec badge
  « En ce moment » calculé selon jours/horaires. Éditeur complet côté restaurateur
  (Façade → « Offres & promotions » : ajouter/modifier/retirer, enregistré en brouillon local).
  ⚠️ Front/démo uniquement : pas encore de table `Offer` ni de routes backend.
- **Backend complet** : auth par lien magique (mode dev), CRUD restaurants/menu/programme,
  adhésions, ledger de points (scan commerçant, redeem, adjust), FoodShare de bout en bout.
- **FoodShare connecté** : le membre publie photo + note + commentaire **uniquement s'il a déjà
  commandé** (≥ 1 crédit EARN) → la note compte tout de suite (avis), la photo part en attente →
  le restaurateur republie (crédit ledger FOODSHARE idempotent) ou refuse (visible uniquement
  sur le profil du membre).
- **45 tests automatisés** qui passent : `test-api.mjs` (27) + `test-shares.mjs` (18).
- **Déploiement** : repo GitHub `abssilian-bot/fidelity`, Render build via `render.yaml`,
  l'API sert le front compilé (app/dist puis backend/public en secours).

### ⏳ Reste à faire (roadmap)

1. Vérifier le déploiement Render en ligne (URL exacte à confirmer — `fidelity-api.onrender.com` répondait 404).
2. **Brancher les offres au backend** : table `Offer` (restaurantId, kind, title, detail, schedule,
   days, startHour, endHour) + routes CRUD propriétaire + publication depuis Façade, pour que les
   offres soient réelles et synchronisées entre appareils (aujourd'hui : `data.ts` + brouillons locaux).
3. Auth réelle : intégration Resend codée le 6 septembre (voir section 10), à activer avec une clé et un expéditeur autorisé.
4. Upload de vraies photos (Supabase Storage) au lieu des 3 images de démo.
5. Passes Wallet Apple/Google (phase 2 — compte Apple Developer 99 $/an).
6. Scan QR commerçant avec caméra (jsQR) dans la PWA.
7. Vérification SIRET via API Sirene (INSEE) à l'inscription restaurateur.
8. Posts sponsorisés + abonnement restaurateur (monétisation, Stripe).
9. PWA : manifest, service worker, push web.

---

## 5. Modèle de données (Prisma/PostgreSQL)

12 tables : `User`, `Restaurant`, `MenuItem`, `LoyaltyProgram`, `Membership` (carte d'un membre
chez un resto, `publicCode` = QR privé), `LedgerEntry` (**solde jamais stocké**, dérivé du ledger ;
`balanceAfter` = cache transactionnel ; `idempotencyKey` unique anti-doublon), `RestaurantFavorite`,
`Review` (1 avis par membre/resto), `Post` (posts restaurant + FoodShare avec `status`
PENDING/PUBLISHED/REJECTED et `rating`), `Like`, `Comment`, `Follow`.

Enums : `Role` (MEMBER/RESTAURANT/ADMIN), `RestaurantStatus`, `ProgramType` (STAMPS/POINTS),
`CardStyle` (BRAISE/CREME/ENCRE), `EntryKind` (EARN/REDEEM/REFUND/ADJUST/FOODSHARE),
`EntryStatus`, `PostStatus`.

**Modèle front uniquement** (`app/src/data.ts`) : `Offer` { id, kind (`happyhour` | `duo` |
`discount` | `special`), title, detail, schedule, days?, startHour?, endHour? } — offres et
promotions du restaurant, distinctes du programme fidélité. Champ `offers: Offer[]` sur
`Restaurant`. À migrer en table Prisma (voir roadmap n°2).

**Règles d'or du ledger** : aucun point sans scan commerçant ; idempotence par clé unique
(un rejeu renvoie l'écriture initiale) ; jamais de suppression (corrections par ADJUST/REFUND) ;
`balanceAfter` calculé dans la même transaction SQL.

---

## 6. Routes API (port 3001 en local)

### Publiques
- `GET /health` — état de l'API
- `GET /restaurants` — liste (filtres `?diet=`, `?district=`, `?q=`)
- `GET /restaurants/:slug` — page complète (profil, menu, programme, avis)
- `GET /restaurants/:slug/shares/public` — FoodShare republiés (fil public)

### Auth (Resend ou mode dev sans clé)
- `POST /auth/magic-link` `{email}` → envoie un e-mail avec Resend ; sans clé, conserve la réponse `devLink`
- `GET /auth/verify?token=...` → token de session Bearer
- `GET /auth/me` 🔒
- `GET /auth/config` → `{emailEnabled}` (aucun secret), pour éviter les envois aux comptes démo au démarrage

### Membre 🔒
- `POST /memberships` `{slug}` — adhérer à un restaurant
- `GET /memberships/mine` — mes cartes + soldes (dérivés du ledger)
- `GET /memberships/:id/history` — mouvements d'une carte (membre OU restaurateur)
- `POST /shares` `{slug, imageUrl, caption, rating}` — publier un FoodShare
  (**403 si aucune commande** ; crée aussi l'avis qui compte tout de suite)
- `GET /shares/mine` — mes partages (tous statuts)

### Restaurateur 🔒 (propriétaire uniquement)
- `PUT /restaurants/:id` — façade (profil)
- `PUT /restaurants/:id/menu` — menu
- `PUT /restaurants/:id/program` — programme fidélité
- `GET /restaurants/:id/members` — clients + activité récente
- `GET /scan/:code` — résoudre le QR privé d'un membre
- `POST /ledger/earn` `{code, delta, idempotencyKey}` — créditer des coches/points
- `POST /ledger/redeem` `{code, idempotencyKey}` — consommer la récompense
- `POST /ledger/adjust` `{code, delta, idempotencyKey, note}` — correction (motif obligatoire)
- `GET /restaurants/:id/shares?status=PENDING` — file FoodShare à valider
- `POST /shares/:id/decide` `{publish, rewardDelta}` — republier (crédit FOODSHARE
  idempotent `foodshare:<postId>`) ou refuser

---

## 7. Comptes et accès

| Quoi | Valeur |
|---|---|
| Compte membre démo | `camille@fidelity.local` (6 cartes) |
| Compte restaurateur démo | `demo-restaurateur@fidelity.local` (possède les 6 restos) |
| Repo GitHub | `github.com/abssilian-bot/fidelity` (branche `main`) |
| Base de données | Supabase PostgreSQL (free tier) |
| Config backend | `backend/.env` : `DATABASE_URL`, `APP_SECRET`, `PORT`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` |

⚠️ **SECRETS** : le `.env` est inclus dans le zip et dans le dump code (section finale) pour que
tu puisses travailler sans reconfigurer. Il contient le mot de passe de la base. Ne le partage
que dans ta conversation ChatGPT privée, jamais dans un repo public.

---

## 8. Lancer le projet en local

```bash
# Terminal 1 — API (http://localhost:3001)
cd backend
npm install
npm run dev

# Terminal 2 — Front (http://localhost:5173 par défaut, 7100 chez nous)
cd app
npm install
npm run dev
```

Tests (API démarrée) : `node backend/scripts/test-api.mjs` puis `node backend/scripts/test-shares.mjs`
→ `27 tests OK` et `18 tests OK` attendus.

Migration BDD après changement du schéma : `cd backend && npx prisma migrate dev --name <nom>`.

---

## 9. Conventions à faire respecter (à rappeler à ChatGPT)

1. **Tout en français** dans l'UI et les commentaires.
2. Le solde de points n'est **jamais stocké**, toujours dérivé du ledger.
3. Toute écriture de points a une `idempotencyKey` unique.
4. Le front doit **toujours fonctionner sans le backend** (repli démo, try/catch → null).
5. Design : pas de gras partout, cartes de fidélité style validé (type B / V1 sans paquet cadeau),
   boutons `outline-button full` pour les actions secondaires, `primary-button` pour l'action principale.
6. Pas de dépendance payante sans validation explicite du propriétaire.

---

## 10. Connexion par e-mail avec Resend — 6 septembre 2026

La section **Compte**, en haut des Réglages, permet de créer son compte ou de se reconnecter avec son e-mail. Aucun mot de passe. L'utilisateur est créé à la première validation du lien ; les reconnexions retrouvent le même utilisateur.

### Variables privées du backend

```dotenv
RESEND_API_KEY=
EMAIL_FROM="Fidelity <onboarding@resend.dev>"
APP_URL="http://localhost:7100"
```

- `RESEND_API_KEY` : clé Resend, uniquement dans `backend/.env` ou dans les variables privées de l'hébergeur. Avec une clé, le SDK envoie un e-mail HTML et texte en français. Sans clé, le contrat dev reste disponible : `devLink` dans la réponse et journal de développement.
- `EMAIL_FROM` : expéditeur autorisé, défaut `Fidelity <onboarding@resend.dev>`.
- `APP_URL` : adresse publique du frontend. Le lien pointe vers `${APP_URL}/?token=...`. Pour un test sur téléphone, il faut une adresse HTTPS accessible depuis ce téléphone ; `localhost` convient uniquement à la machine de développement.
- **Sans domaine vérifié, Resend n'envoie qu'à l'adresse du compte Resend (`onboarding@resend.dev`).** Vérifier ensuite un domaine et remplacer `EMAIL_FROM` pour autoriser les inscriptions d'autres membres. [Restriction officielle Resend](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Une clé a été renseignée dans le `.env` privé local après la première série de vérifications. Aucun secret n'est écrit dans la documentation, le frontend ou Git. Le compte Resend a été consulté : aucun domaine d'envoi n'est encore configuré.

L'instance courante utilise `APP_URL=http://127.0.0.1:7100` pour cibler l'aperçu de ce dossier. Un autre serveur Vite du dossier Kimi écoute aussi sur `localhost:7100` via IPv6 ; ne pas confondre les deux versions.

### Contrats et sessions

- `POST /auth/magic-link` conserve le corps `{email}`, le rate limiting et la durée de 15 minutes. En mode Resend, ni la réponse ni les logs ne contiennent le lien. Un refus ou une panne d'envoi produit un **502 générique**.
- `GET /auth/verify?token=...` conserve la réponse `{token, user}` et la session de 7 jours. Chaque lien est à usage unique grâce à la table `UsedMagicLink` (empreinte SHA-256, expiration), consommée dans la même transaction que la création/recherche du compte. Un rejeu, y compris simultané, est refusé. Les empreintes expirées sont nettoyées.
- Appliquer **`npx prisma migrate deploy` avant de déployer l'API** : migration `20260906020000_single_use_magic_links`. Elle est appliquée uniquement à la base locale de vérification à ce stade, pas à Supabase.
- `GET /auth/config` expose seulement `{emailEnabled}`. Quand Resend est actif, le frontend ne demande plus automatiquement de liens pour les comptes démo.
- `getAccount`, `requestLoginLink`, `completeLogin`, `logoutAccount` sont exportés par `app/src/lib/api.ts`. Session personnelle : `localStorage['fidelity.account'] = {token, user}` ; token membre actif : `fidelity.token.member`. La session réelle a priorité. Une session expirée est nettoyée ; une panne réseau seule ne déconnecte pas le compte.
- Le token de l'URL est retiré immédiatement, la validation résiste au double montage de React StrictMode, puis l'application se recharge proprement. Un lien refusé renvoie aux Réglages avec le message demandé.
- Sans API, la démo reste navigable et le formulaire affiche une erreur compréhensible. Sans clé Resend, le bouton « Mode démo : me connecter sans e-mail » permet de terminer le parcours localement.

### Vérifications

Les deux suites historiques ont été exécutées sur une **instance PostgreSQL locale isolée**, API démarrée et clé Resend absente : **27 tests API et 18 tests FoodShare réussis**. Le jeu Supabase n'a pas été utilisé pour ces écritures de test.

`npx tsc --noEmit` côté backend et `npm run build` côté frontend passent. Tests complémentaires : `npm run test:auth` côté backend (SDK Resend avec transport simulé, erreurs d'envoi, confidentialité, usage unique, expiration, rate limiting) et `npm run test:account` côté frontend (stockage, priorité au compte réel, expiration, déconnexion, backend éteint).

L'API locale charge maintenant `.env` avec `npm run dev` et `npm start` (Node 20.12+). Aucun déploiement Render n'a été effectué dans cette tâche.


## Déploiement Render vérifié le 6 septembre 2026

- Adresse réelle : https://fidelity-api-mcld.onrender.com (l'adresse fidelity-api.onrender.com est incorrecte).
- Service Render : srv-dabi6qcs728c73a0gmkg ; dépôt abssilian-bot/fidelity, branche main.
- Build depuis backend : npm ci --include=dev && npm run build:render (compile également le frontend).
- Démarrage : npm run start:render (applique les migrations Prisma avant le serveur).
- Configuration privée Render : RESEND_API_KEY, EMAIL_FROM et APP_URL en plus des variables existantes.
- Sans domaine Resend vérifié, envoi limité à l'adresse du compte Resend.

- Base Supabase : utiliser le Session pooler IPv4 sur le port 5432 ; l'adresse directe IPv6 est inaccessible depuis ce service Render. Les migrations recherche et liens à usage unique ont été appliquées avec succès.
