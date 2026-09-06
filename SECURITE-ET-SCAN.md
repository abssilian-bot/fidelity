# Contrôle de sécurité et caisse Fidelity — 6 septembre 2026

## Périmètre et conclusion

Revue de toutes les routes Fastify présentes, de l'authentification, des accès PostgreSQL/Supabase, du registre, des programmes, des adhésions, de FoodShare, de la recherche publique, des URL publiées, des réponses HTTP, des dépendances et du parcours de caisse React. Tests d'attaque sur une **base PostgreSQL locale isolée**, sans envoyer d'e-mails réels ni modifier des soldes de production.

Ce contrôle ne constitue pas une garantie d'absence de fraude. Il établit les protections ci-dessous et leurs tests reproductibles. La preuve d'un achat encaissé n'existe pas encore : les montants restent déclarés par le propriétaire du restaurant.

## Failles corrigées

| Problème observé | Correction et vérification |
| --- | --- |
| Supabase : RLS désactivée et droits SELECT/INSERT/UPDATE/DELETE accordés à `anon` et `authenticated` sur les comptes, cartes et mouvements | RLS activée et privilèges publics retirés. **Correction appliquée à la base en ligne** après test local. Contrôle ultérieur : RLS active, aucun droit client sur ces tables, API publique fonctionnelle. Aucune donnée métier changée. |
| Lectures concurrentes du dernier solde : crédits perdus ou double consommation de récompense | Verrou PostgreSQL sur la carte pour chaque écriture, somme des mouvements CONFIRMED, validation et écriture dans la même transaction. Huit crédits concurrents donnent exactement huit unités ; deux retraits simultanés ne peuvent consommer la même provision. |
| Rejeu d'une clé d'idempotence sans vérifier la carte et le contenu | Vérification de la carte, de l'auteur, de la nature, du montant, de la source et du motif. Conflit = 409, sans divulgation de l'opération existante. Une répétition identique retrouve le reçu même après expiration du QR. |
| Identifiant permanent de carte utilisable indéfiniment | QR aléatoire à 192 bits, valable deux minutes et consommé atomiquement pour une seule opération. Aucun montant ni donnée personnelle dans le QR. Les anciens codes permanents ne permettent plus de créditer/débiter. |
| Restaurant suspendu ou programme arrêté encore créditable | Vérification serveur sous verrou, y compris lors de FoodShare. Établissement sélectionné explicitement comparé à la carte. Auto-crédit du propriétaire refusé. |
| Publication FoodShare validée avant son crédit, décisions concurrentes et publications répétées pour un achat | Publication et crédit atomiques, décision conditionnelle PENDING, une publication par écriture EARN. Motifs, plafonds et propriétaire contrôlés. |
| Déconnexion uniquement locale et autorité du rôle contenu dans le Bearer | Révocation serveur par empreinte ; rôle actuel relu en base à chaque requête ; utilisateur supprimé refusé. Le navigateur attend la confirmation pour la déconnexion explicite. |
| Sans Resend, possibilité de récupérer un lien dev en production | NODE_ENV=production refuse la connexion par 503 si l'e-mail n'est pas configuré ; aucun devLink. Le développement local sans clé reste possible. |
| Confiance illimitée dans X-Forwarded-For | Pas de confiance dans les en-têtes de proxy par défaut ; configuration explicite via TRUSTED_PROXIES. Les limites des scans utilisent aussi l'identifiant authentifié. |
| URL dangereuses, réponses privées mises en cache, journaux trop détaillés | Validation HTTP(S)/images locales, no-store, masquage des QR et tokens dans les journaux, erreurs serveur génériques, corps limités à 64 Ko, CSP/HSTS en production, CORS limité. |
| Faux succès locaux en cas d'échec de publication/crédit | Aucun succès de scan ou décision FoodShare sans réponse serveur. Reprise de l'opération exacte enregistrée dans sessionStorage ; pas de remplacement par une opération démo. |
| Dépendances signalées | Mises à jour compatibles frontend ; deepmerge-ts 8 substitué dans l'outillage Prisma 6 (génération, migrations et compilation vérifiées). Audit npm sans alerte connue après mise à jour. |

## Parcours de caisse

1. Le client connecté ajoute la carte puis l'ouvre dans **Fidélité → Voir la carte**. Son QR se renouvelle automatiquement.
2. Le propriétaire connecté ouvre **Résumé → Scanner un client** et choisit son établissement si nécessaire.
3. La caméra lit le QR ; à défaut, le client peut copier son code temporaire et le transmettre en caisse.
4. L'écran affiche le client et le solde vérifiés par le serveur. Boutons **+1 / +2 / +3** pour les coches, **+10 / +50 / +100** pour les points, avec saisie personnalisée.
5. Une validation produit un reçu serveur : référence, date, variation et solde après opération. **Client suivant** relance la caméra. Une récompense disponible exige une confirmation distincte et le serveur calcule le débit.

Plafonds : 10 coches ou 1 000 points par crédit/correction ; correction avec motif. Les récompenses utilisent actuellement l'objectif unique `LoyaltyProgram.target`, affiché au membre depuis le serveur.

Le solde du client se rafraîchit toutes les cinq secondes quand sa carte est visible ; cartes/historique et activité restaurateur toutes les quinze secondes. Les timers suspendent leurs appels lorsque l'onglet est masqué. La caméra est arrêtée en quittant l'écran, après lecture, ou en arrière-plan.

En cas de coupure, le bouton **Vérifier et terminer** réutilise la même référence. Le QR expiré reste refusé si rien n'avait été enregistré ; si la transaction avait déjà abouti, le reçu initial est retrouvé. Aucun crédit différé automatique en arrière-plan.

## Vérifications

- Backend : TypeScript sans erreur ; génération Prisma et migrations sur PostgreSQL réel.
- API sans Resend : `test-api.mjs` **27** et `test-shares.mjs` **18**.
- `test-security.mjs` : **25 scénarios**, avec de nombreuses requêtes par scénario : sessions, accès croisés, plafonds, QR, courses entre transactions, FoodShare atomique, URL, fichiers privés, CORS, corps excessifs et accès SQL anonyme.
- Tests ciblés : auth **10**, adhésions **5**, recherche serveur **9** ; compte frontend **10**, recherche **50**, cartes **6**, reprise scan **3**.
- Interface locale : crédit avec reçu, coupure réelle de l'API puis reprise, affichage du QR et du solde côté membre. Cet ordinateur n'expose aucune caméra : la prise de vue physique reste à essayer sur iPhone/Android en HTTPS.

`test-security.mjs` refuse une API distante ou une base dont le nom ne commence pas par `fidelity_security_`. Fournir DATABASE_URL, APP_SECRET et TEST_API_URL d'une base jetable migrée et d'une API lancée sur cette même base. Les scripts historiques acceptent aussi TEST_API_URL ; ils exigent un seed frais et ne doivent pas tourner sur la production.

## Exploitation et limites

- Le service Fastify doit utiliser le propriétaire des tables ou un rôle SQL BYPASSRLS dédié. **Ne pas rétablir les accès anon/authenticated** pour faire fonctionner un frontend : tout passe par Fastify. Les nouvelles tables doivent suivre la même règle.
- L'accès restaurateur vient d'un rattachement propriétaire en base, jamais du choix d'interface. Aucun endpoint public ne peut attribuer ce droit. La procédure de vérification d'établissement/SIRET et l'accès nominatif des salariés restent à mettre en place avant ouverture à des restaurateurs externes.
- Un commerçant autorisé peut déclarer un achat fictif ou agir de concert avec un client. Une preuve de paiement/connexion caisse, des contrôles de tickets et une revue des anomalies sont nécessaires pour réduire ce risque. Le QR court et à usage unique réduit la copie, sans empêcher le partage volontaire en direct.
- Les limites de débit sont en mémoire par instance, adaptées au service Render actuel ; une montée en charge multi-instance exige un compteur partagé. TRUSTED_PROXIES doit refléter les vrais proxies de l'hébergeur, jamais `true`/toute adresse ; sans cette configuration, plusieurs visiteurs derrière le même proxy partagent une limite.
- Le Bearer reste dans localStorage suivant le contrat existant. CSP, validation des URL et rendu React réduisent le risque XSS sans l'annuler. Une session HttpOnly avec protection CSRF est une évolution possible. La rotation des secrets exposés dans d'anciens exports doit être gérée par le propriétaire.
- Les offres, photos téléversées, affiliations/SIRET, paiements, Wallet et plusieurs écrans sociaux restent hors de ce parcours de fidélité réel. Les contrôles ci-dessus ne les rendent pas fonctionnels automatiquement.
- Les anciens mouvements sont conservés. Un ancien `balanceAfter` incohérent n'est pas réécrit silencieusement ; le solde courant utilise désormais la somme confirmée.
- L'API Resend sans domaine vérifié reste limitée à l'adresse du compte Resend. Pas de test d'envoi réel supplémentaire pendant cet audit.

## Publication

La fermeture de l'accès public Supabase a été appliquée et vérifiée en ligne. Le code et les deux migrations `20260906030000_secure_loyalty` / `20260906040000_backend_only_database` sont préparés pour le déploiement Render existant. La migration RLS est idempotente afin de conserver la protection déjà appliquée.
