# Feuille de route — Fidelity (« On mange quoi »)

> Document de travail rédigé le 30 août 2026.
> Sources : cahier des charges (PDF), vidéo de démonstration du front, blueprint Wallet (Codex).
> Contrainte n°1 : **budget quasi nul**. Chaque choix technique ci-dessous est gratuit ou presque.

***

## 1. La vision en une phrase

Un réseau social de la restauration dont le **cœur de métier est la carte de fidélité digitale** (Wallet Apple/Google), la couche sociale (feed, stories, FOODSHARE) venant créer l'engagement et l'acquisition gratuite.

**Ordre stratégique validé par le prototype lui-même** : la fidélité d'abord, le social ensuite (« La création de posts et stories arrivera après le lancement fidélité »).

***

## 2. Stack technique retenue (et pourquoi)

| Brique                        | Choix                                                           | Coût                                                                               | Alternative écartée                                                 |
| ----------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Frontend                      | **React + TypeScript + Vite** (existant, reconstruit)           | 0 €                                                                                | React Native (trop tôt)                                             |
| App mobile                    | **PWA** (installable, caméra, push web)                         | 0 €                                                                                | App Store/Play natif (compte Apple obligatoire viendra avec Wallet) |
| Backend                       | **Node.js + TypeScript + Fastify**                              | 0 €                                                                                | NestJS (trop lourd pour démarrer)                                   |
| Base de données               | **PostgreSQL via Supabase free tier**                           | 0 € (500 Mo)                                                                       | VPS dédié (5 €/mois, plus tard)                                     |
| ORM                           | **Prisma**                                                      | 0 €                                                                                | —                                                                   |
| Auth                          | **Supabase Auth** (e-mail + OTP, Google)                        | 0 €                                                                                | SMS OTP (payant) en phase 1                                         |
| Stockage images               | **Supabase Storage** (1 Go) puis Cloudflare R2                  | 0 €                                                                                | AWS S3 (facturation au Mo)                                          |
| Carte interactive             | **MapLibre + tuiles OpenStreetMap/MapTiler free**               | 0 €                                                                                | Google Maps (payant dès le 1er chargement au-delà du crédit)        |
| Wallet Apple                  | **Passes .pkpass auto-émis** (node-passkit / passkit-generator) | 99 \$/an (compte Apple Developer — seul coût incompressible, à prendre en phase 2) | PassKit/SaaS de passes (30-100 €/mois)                              |
| Wallet Google/Samsung         | **Google Wallet API**                                           | 0 €                                                                                | —                                                                   |
| Scan QR commerçant            | **Caméra du téléphone + jsQR dans la PWA**                      | 0 €                                                                                | Douchette matérielle                                                |
| Vérification SIRET            | **API Sirene (INSEE, api.gouv.fr)**                             | 0 €                                                                                | Vérification manuelle à 100 %                                       |
| Hébergement front             | **Vercel ou Cloudflare Pages**                                  | 0 €                                                                                | —                                                                   |
| Hébergement API               | **Render free** / Railway (au choix ce soir)                    | 0 €                                                                                | —                                                                   |
| Paiement (phase monétisation) | **Stripe**                                                      | 0 € fixe, commission au usage                                                      | —                                                                   |
| Push notifications            | **Web Push (PWA)**                                              | 0 €                                                                                | Firebase/APNs direct au début                                       |

**Principe** : tout ce qui est SaaS « par abonnement mensuel » est remplacé par de l'open source auto-hébergé sur des free tiers. Le seul achat obligatoire du projet est le **compte Apple Developer (99 \$/an)**, et seulement au moment d'activer les vraies cartes Wallet.

***

## 3. Réponses aux problèmes techniques du cahier des charges

| Problème posé dans le CDC                          | Solution retenue                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PassKit « SAVOIR GÉRER » + compte Apple Developer  | On **émet nos propres passes signés** avec la lib open source `passkit-generator` (Node). Un endpoint `/api/wallet/apple/:membershipId.pkpass` génère et signe le pass. Certificat « Pass Type ID » créé dans le compte Apple Developer.                                                         |
| Mise à jour des cartes Wallet                      | Les passes Apple se mettent à jour via **APNs** (gratuit, via le même certificat). Google Wallet se met à jour par simple appel API.                                                                                                                                                             |
| Création de compte Mail/Numéro + A2F               | Phase 1 : e-mail + lien magique (Supabase Auth, gratuit). Phase 2 : Google Sign-In (gratuit). SMS/A2F reporté (Twilio coûte \~0,05 €/SMS — à activer quand revenus).                                                                                                                             |
| Preuve de crédibilité commerçant (SIRET)           | **API Sirene de l'INSEE** : on vérifie automatiquement que le SIRET existe, est actif, et que le nom correspond. Gratuit, instantané. + validation manuelle admin pour la première cohorte.                                                                                                      |
| Validation compte commerçant par admin             | Table `restaurants.status = pending/verified/suspended` + mini page admin dans la PWA.                                                                                                                                                                                                           |
| QR code restaurant sans appli + affiche imprimable | QR pointant vers `https://app.fidelity…/r/:slug` → page web publique du restaurant → création d'adhésion + ajout Wallet. Affiche générée en **PDF côté serveur (pdfkit)** à partir du template validé dans l'éditeur.                                                                            |
| Accès aux cartes (menu) en PDF                     | Upload PDF dans Supabase Storage, ou génération PDF depuis le menu saisi. Les deux, le restaurateur choisit.                                                                                                                                                                                     |
| Scan pour changer les points                       | PWA commerçant : bouton « Scanner » → caméra → lecture du QR privé membre → l'**API crédite après confirmation**, jamais le client (ledger + anti-doublon, cf. blueprint).                                                                                                                       |
| Sécurité des points                                | Héritée du blueprint Wallet : **ledger immuable**, clé idempotence (restaurant+source+orderId), aucun point sans preuve de vente ou scan commerçant, écritures compensatrices au lieu de suppressions.                                                                                           |
| Affluence en temps réel                            | Reporté. Phase 3 : déclaratif commerçant (bouton calme/normal/chargé dans l'espace pro). Pas de capteur, pas de prédiction au début.                                                                                                                                                             |
| Lien Deliveroo / dark kitchens                     | Pas d'API publique Deliveroo accessible gratuitement. Solution réaliste : **deep links** vers la page Deliveroo/Uber Eats du restaurant (champ URL dans le profil) + programme « à coches par visite » compatible à emporter. L'intégration profonde se fera quand ils ouvriront un partenariat. |
| Commission sur réservations                        | Abandonné en phase 1 (la réservation exige une dispo temps réel des tables = gros chantier). Monétisation = abonnement restaurateur + posts sponsorisés.                                                                                                                                         |
| Stripe pour les commerçants                        | Stripe Checkout hébergé (pas de PCI à gérer), uniquement pour l'abonnement pro plus tard.                                                                                                                                                                                                        |
| Notifications push d'offres                        | Web Push PWA : le serveur envoie quand un restaurant suivi publie une offre. Gratuit, pas de store requis.                                                                                                                                                                                       |

***

## 4. La feuille de route ordonnée

### Phase 0 — Fondations ✅ (ce soir)

* [x] Frontend reconstruit fidèlement à la vidéo (React + TS, `app/`)

* [ ] Backend scaffoldé : Fastify + Prisma + PostgreSQL (`backend/`)

* [ ] Schéma de données complet (users, restaurants, programs, memberships, ledger)

* [ ] Auth e-mail (Supabase Auth) branchée au front

* [ ] Seed avec les 6 restaurants de démo

### Phase 1 — MVP fidélité (semaines 1-3)

1. API restaurants : profil, menu, horaires, régimes, statut de validation
2. API programmes fidélité (coches/points, CRUD restaurateur)
3. Adhésions (membership user↔restaurant) + **ledger des mouvements** + anti-doublon
4. PWA commerçant : scan QR membre → crédit de points (le cœur du métier)
5. Page publique `/r/:slug` + QR d'inscription + affiche PDF
6. Brancher le front existant sur l'API (remplacer `data.ts` par des appels fetch)
7. **Test grandeur nature** : 1 vrai restaurant ami, 10 clients réels

### Phase 2 — Wallet (semaines 4-5)

8. Compte Apple Developer (99 \$) + certificat Pass Type ID
9. Endpoint génération `.pkpass` + mise à jour APNs
10. Google Wallet API (gratuit, couvre Samsung)
11. QR privé membre dans le pass (identifiant aléatoire, jamais le solde)

### Phase 3 — Social (semaines 6-9)

12. Comptes publics utilisateurs (pseudo, bio, abonnés/abonnements)
13. Posts photos (upload Supabase Storage) + feed « Pour vous »
14. Likes, commentaires, republications
15. **FOODSHARE** : mention du restaurant → republication → crédit de points (branche directe sur le ledger de la phase 1)
16. Stories

### Phase 4 — Découverte & carte (semaines 10-11)

17. Géolocalisation réelle + MapLibre à la place de la carte illustrée
18. Recherche + filtres régimes/horaires/distance sur données réelles
19. Mode « discovery » / adresse au hasard selon les envies

### Phase 5 — Monétisation (semaine 12+)

20. Abonnement restaurateur via Stripe (features pro : stats, mise en avant, affiches premium)
21. Posts sponsorisés géolocalisés dans le feed
22. Page admin (validation SIRET, modération)

### Idées explicitement reportées

Affluence temps réel · intégration Deliveroo profonde · réservation avec commission · connecteurs caisse/TPE · NFC Apple VAS.

***

## 5. Modèle de données (prévu dans `backend/prisma/schema.prisma`)

```
User            (id, email, pseudo, role[member|restaurant|admin], createdAt)
Restaurant      (id, ownerId, name, slug, siret, status, cuisine, description,
                 address, lat, lng, hours, diets[], imageUrl, rating cache)
LoyaltyProgram  (id, restaurantId, type[stamps|points], title, target,
                 reward, rule, style, active)
Membership      (id, userId, restaurantId, publicCode (QR privé), createdAt)
LedgerEntry     (id, membershipId, delta, balanceAfter, kind, source,
                 idempotencyKey UNIQUE, authorId, note, createdAt)
Post            (id, authorId|restaurantId, imageUrl, caption, taggedRestaurantId)
Follow / Like / Comment / Repost
```

**Règle d'or (du blueprint Wallet)** : le solde n'est jamais stocké directement — il est toujours dérivé du ledger. `LedgerEntry.balanceAfter` est un cache contrôlé par transaction SQL.

***

## 6. Budget prévisionnel

| Poste                              | Quand                      | Coût             |
| ---------------------------------- | -------------------------- | ---------------- |
| Tout le développement (phases 0-1) | maintenant                 | **0 €**          |
| Nom de domaine                     | phase 1                    | \~10 €/an        |
| Compte Apple Developer             | phase 2                    | 99 \$/an         |
| Supabase/Render/Vercel             | début                      | 0 € (free tiers) |
| Dépassement free tiers             | \~500+ utilisateurs actifs | \~20-25 €/mois   |
| **Total avant revenus**            | <br />                     | **≈ 110 €/an**   |

