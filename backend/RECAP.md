# 📋 Récap backend — session du 31 août

> Salut ! Pendant que tu étais dehors, voici tout ce qui a été fait, expliqué simplement.
> **TL;DR : ton backend est codé, sécurisé et testé. 27 tests automatiques passent. ✅**

---

## 1. Ce qui marche maintenant

| Morceau | État |
|---|---|
| Base de données Supabase (gratuite) | ✅ En ligne, 11 tables créées |
| Données de démo | ✅ Les 6 restaurants du front + menus + programmes fidélité |
| API complète (15 routes) | ✅ Codée et testée une par une |
| Connexion par lien magique (sans mot de passe) | ✅ Fonctionne en mode dev |
| Sécurité renforcée | ✅ Voir section 4 |
| Mise en ligne (Render/Vercel) | ⏳ Pas encore — on le fait ensemble, jamais sans toi |

---

## 2. Comment démarrer l'API (à faire toi-même, 20 secondes)

1. Ouvre un terminal (dans VS Code : `Terminal → Nouveau terminal`)
2. Va dans le dossier backend :
   ```
   cd C:\Users\jebza\Documents\Kimi\Workspaces\OnMangeQuoi\backend
   ```
3. Lance :
   ```
   npm run dev
   ```
4. L'API tourne sur **http://localhost:3001** — vérifie en ouvrant http://localhost:3001/health dans ton navigateur (tu dois voir `{"status":"ok"}`)
5. Pour l'arrêter : `Ctrl+C` dans le terminal

### Relancer les tests automatiques

```
node scripts/test-api.mjs
```
(l'API doit tourner). Tu dois voir `27 tests OK, 0 échecs`.

---

## 3. Les routes de l'API (le contrat pour brancher le front)

Toutes les routes sont sur `http://localhost:3001`. Les routes 🔒 demandent un en-tête `Authorization: Bearer <token>` (le token est donné par la connexion, voir plus bas).

### Publiques (aucune connexion requise)

| Route | Ce qu'elle fait |
|---|---|
| `GET /health` | Vérifie que l'API est en vie |
| `GET /restaurants` | Liste des restos. Filtres possibles : `?diet=Halal`, `?district=Paris 11e`, `?q=ramen` |
| `GET /restaurants/:slug` | Page complète d'un resto : profil, menu, programme fidélité, avis. Ex: `/restaurants/chez-amina` |

### Connexion (mode dev)

| Étape | Route | Explication |
|---|---|---|
| 1 | `POST /auth/magic-link` avec `{"email": "..."}` | Renvoie un `devLink` dans la réponse (en prod ce sera un vrai e-mail) |
| 2 | `GET /auth/verify?token=...` (le token est dans le devLink) | Renvoie `{"token": "...", "user": {...}}` → **garde ce token**, c'est la session (valide 7 jours) |
| 3 | `GET /auth/me` 🔒 | Renvoie le profil de la personne connectée |

### Côté client (membre) 🔒

| Route | Ce qu'elle fait |
|---|---|
| `POST /memberships` avec `{"slug": "chez-amina"}` | Rejoindre un resto (crée la carte + son QR privé `publicCode`) |
| `GET /memberships/mine` | « Mes cartes » : restos + programme + **solde de points** |
| `GET /memberships/:id/history` | Historique des mouvements de points de la carte |

### Côté commerçant (il faut être le propriétaire du resto) 🔒

| Route | Ce qu'elle fait |
|---|---|
| `GET /scan/:code` | Le commerçant scanne le QR du client (`publicCode`) → affiche nom, solde, programme. **Écran de confirmation avant de créditer.** |
| `POST /ledger/earn` | Crédite des points/coches. Body : `{"code": "...", "delta": 1, "idempotencyKey": "scan-xyz", "note": "..."}` |
| `POST /ledger/redeem` | Le client consomme sa récompense (débite l'objectif du programme, ex: 10 coches) |
| `POST /ledger/adjust` | Correction manuelle (erreur de caisse, geste commercial) — **motif obligatoire** |
| `PUT /restaurants/:id` | Le restaurateur modifie sa fiche (horaires, description, régimes...) |
| `PUT /restaurants/:id/program` | Le restaurateur publie/modifie son programme fidélité |

### ⚠️ Règle anti-doublon (important pour le front)

Pour `earn` / `redeem` / `adjust`, le front doit générer un **`idempotencyKey` unique par opération** (ex: `crypto.randomUUID()`). Si la requête est renvoyée deux fois (bug réseau, double tap), le serveur renvoie le résultat initial avec `idempotentReplay: true` — **jamais de points en double**.

### Comptes de démo pour tester

- **Cliente** : `camille@fidelity.local` (a déjà 6 cartes)
- **Restauratrice** : `demo-restaurateur@fidelity.local` (possède les 6 restos)

---

## 4. Sécurité — ce qui est en place (tu l'avais demandé 🔐)

| Menace classique | Protection |
|---|---|
| Injection SQL (voler/vider la base) | ✅ Prisma envoie des requêtes paramétrées, jamais de SQL concaténé + validation Zod de TOUTES les entrées (testé : `'DROP TABLE'` → rejeté en 400) |
| Quelqu'un se crédite des points tout seul | ✅ Impossible : seul le **propriétaire du restaurant** peut créditer/débiter (testé : un membre qui scanne sa propre carte → 403) |
| Faux tokens de session | ✅ Tokens signés en HMAC-SHA256 avec une clé secrète serveur, expiration 7 jours, comparaison anti-timing (testé : token forgé → 401) |
| Spam / force brute (bot qui bombarde l'API) | ✅ Limiteur de débit : 300 requêtes/min/IP globalement, 10/min sur la connexion, 60/min sur les scans |
| Doublons de points (double tap, bug réseau) | ✅ Clé d'idempotence unique — un rejeu ne crée jamais de doublon (testé) |
| Fuite de données privées | ✅ La page publique resto ne contient jamais SIRET ni propriétaire ; l'historique d'une carte n'est visible que par le membre et son restaurateur (testé) |
| Erreurs qui révèlent l'intérieur du serveur | ✅ Jamais de stack trace côté client, message générique « Erreur interne » |
| Clickjacking / sniffing / XSS basique | ✅ En-têtes de sécurité HTTP sur toutes les réponses |
| N'importe quel site appelle l'API | ✅ CORS restreint aux fronts autorisés (variable `ALLOWED_ORIGINS` dans `.env`) |
| Solde trafiqué | ✅ Le solde n'est jamais envoyé par le client : il est **recalculé par le serveur** à chaque écriture, dans la même transaction |
| Suppression de mouvements | ✅ Impossible par design : une erreur se corrige par une écriture inverse avec motif |

### Ce qui restera à faire côté sécurité (plus tard, pas urgent)

- Envoi du lien magique par **vrai e-mail** (Supabase Auth) — pour l'instant le lien est renvoyé dans la réponse, pratique en dev mais pas en prod
- HTTPS (automatique quand on déploiera sur Render/Vercel)
- Rate-limit distribué (l'actuel est en mémoire, suffisant pour 1 serveur)

---

## 5. Structure du code (si tu veux regarder)

```
backend/
├── prisma/
│   ├── schema.prisma   → le plan de la base (11 tables)
│   ├── seed.ts         → les 6 restos de démo
│   └── migrations/     → historique des changements de la base
├── src/
│   ├── server.ts       → le point d'entrée (branche tout)
│   ├── lib/
│   │   ├── tokens.ts   → signatures HMAC (sessions, QR)
│   │   ├── auth.ts     → "qui es-tu ?" sur chaque route protégée
│   │   └── security.ts → headers, rate-limit, erreurs propres
│   └── routes/
│       ├── auth.ts        → lien magique, session
│       ├── restaurants.ts → liste, page publique, édition restaurateur
│       ├── memberships.ts → adhésion, mes cartes, historique
│       └── ledger.ts      → les points (earn/redeem/adjust) — le plus sensible
└── scripts/
    └── test-api.mjs    → 27 tests automatiques de toute l'API
```

---

## 6. Prochaines étapes (dans l'ordre)

1. **Brancher le front** sur ces routes (remplacer les fausses données de `data.ts` par des appels à `http://localhost:3001`) — je peux préparer un petit fichier `api.ts` tout prêt pour l'autre conversation
2. Mettre l'API en ligne sur **Render** (gratuit) + le front sur **Vercel** (gratuit) — à faire ensemble
3. Brancher **Supabase Auth** pour les vrais e-mails de connexion
4. Upload d'images (Supabase Storage) pour les photos des restos
5. Phase 2 : cartes Apple Wallet (99 $/an, seul coût du projet)

*Généré le 31/08/2026 — API testée et fonctionnelle.*
