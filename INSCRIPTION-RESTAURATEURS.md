# Inscription et validation des restaurants — 9 septembre 2026

## Utilisation

Choisir « Je suis restaurateur », ou ouvrir Réglages → Mon espace restaurateur. Entrer son e-mail puis ouvrir le lien reçu : le compte est créé à la première connexion. Aucun code partagé ni mot de passe. Le lien conserve l’accès à l’espace restaurateur même depuis un autre appareil.

Un compte sans établissement validé voit « Votre restaurant sur Fidelity ». Il renseigne le SIRET de l’adresse concernée, l’enseigne, la cuisine, l’adresse, le code postal, la ville, le nom et la fonction du responsable et son téléphone professionnel. Le site et les précisions sont facultatifs. Il atteste être habilité à gérer cet établissement. Le dossier reste privé et en attente. Un refus motivé peut être corrigé et renvoyé ; la décision est consultable dans « Mes demandes ».

Un restaurateur déjà validé retrouve ses restaurants après connexion. Pour une nouvelle adresse : Façade → Réglages des établissements → Mes inscriptions et nouveaux établissements.

## Administration

Définir `FIDELITY_ADMIN_EMAILS` dans les variables privées du backend, avec les adresses explicitement autorisées, séparées par des virgules. Exemple non réel : `admin@example.fr`. Ne pas mettre de secret ni d’adresse personnelle de production dans Git.

L’adresse autorisée reçoit le rôle ADMIN **après validation d’un nouveau lien de connexion**. Le navigateur ne peut pas choisir ce rôle. Si le compte était déjà connecté, se déconnecter puis demander un nouveau lien. Ouvrir ensuite Réglages → Valider les restaurants, ou le bouton équivalent dans l’espace restaurateur.

Avant d’accepter : consulter l’annuaire officiel, vérifier l’activité réelle de restauration, puis contrôler l’habilitation du demandeur par un canal trouvé indépendamment de ses déclarations (contact officiel de l’établissement, confirmation du dirigeant). Cocher les deux contrôles et conserver une trace privée de la méthode/date/source. Le SIRET est public : connaître un SIRET ou recevoir un e-mail ne prouve jamais le droit de gestion.

L’acceptation rattache un restaurant unique à son demandeur, avec l’adresse officielle, et crée un programme de fidélité **inactif**. Le restaurateur doit définir puis publier son programme. Aucune remise de points n’est permise tant qu’il n’est pas actif. Un SIRET déjà rattaché demande une intervention Fidelity ; aucun transfert automatique. Retirer une adresse de `FIDELITY_ADMIN_EMAILS` empêche les futures promotions, mais ne révoque pas un rôle ADMIN déjà enregistré : pour révoquer un administrateur, changer aussi son rôle dans la base.

## Contrôles serveur

- Validation de format et de clé de contrôle du SIRET (dont cas La Poste), entrées strictes et longueurs bornées.
- Recherche du **SIRET exact de l’établissement**, état actif de l’établissement et de l’entreprise, raison sociale, adresse et APE via l’API publique de l’Annuaire des entreprises. Un résultat voisin ou le siège d’un autre établissement ne suffit pas. Aucun service payant.
- Seul le SIRET est envoyé au service public. Timeout de 7 secondes ; panne ou résultat absent conserve le dossier en attente, jamais validé automatiquement. Les entreprises non diffusibles demandent un traitement de support ; la validation de cette version reste bloquée tant que l’annuaire ne confirme pas les données requises.
- Nouvelle consultation du registre lors de l’acceptation. Contrôle du rôle ADMIN lu en base, indépendamment du rôle annoncé par le jeton ou le navigateur.
- Dossiers privés limités à leur auteur ; coordonnées accessibles uniquement à l’auteur et aux administrateurs. Notes de contrôle et historique des décisions restent réservés au serveur/administration. Historique conservé après correction.
- Limitation des tentatives de recherche et soumission ; aucune création de restaurant ni élévation de rôle à la soumission.
- Transactions/verrous et contrainte unique SIRET empêchent deux acceptations concurrentes et deux rattachements. Changer l’adresse officielle d’un établissement vérifié requiert Fidelity.
- La migration active RLS et retire les droits publics des nouvelles tables. Les tests sont faits dans une base PostgreSQL locale isolée, sans envoi Resend.

Ce parcours réduit les inscriptions frauduleuses ; la qualité de la vérification humaine du droit de gestion reste nécessaire. Il ne constitue pas une garantie d’absence de fraude.

## Déploiement et tests

Appliquer `20260909010000_restaurant_registration` avec `prisma migrate deploy` (automatique avec `npm run start:render`). Aucune modification des secrets Apple Wallet ou Resend n’est nécessaire.

L’expéditeur `onboarding@resend.dev` limite les envois à l’adresse du compte Resend. Pour ouvrir les inscriptions à tous les restaurateurs, vérifier un domaine dans Resend puis configurer `EMAIL_FROM` avec ce domaine. [Restriction officielle](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).

Tests automatisés : inscription/validation 17, auth 12, comptes frontend 13 ; régression API 27, FoodShare 20, sécurité 30, Wallet 17, recherche/adhésion backend 14 et recherche/cartes/scan/Discovery frontend 67, soit **217 vérifications réussies**. Compilation TypeScript backend et build frontend vérifiés. Aucun dossier de test créé dans la base publique.

Déploiement du 9 septembre 2026 vers 18 h 49 (Paris) : commit applicatif `882bb3b`, bundle public `index-xeuTx5A3.js`, neuvième migration appliquée avec succès. L’adresse administrateur désignée est configurée dans l’environnement privé Render. Contrôle public : accueil et API disponibles, nouvelles routes privées en 401 sans session, Apple Wallet toujours activé, six restaurants et deux publications conservés. Aucun e-mail de test réel envoyé.

Essai navigateur sur une base locale isolée : connexion par le bouton dev, dépôt d’un dossier fictif en attente, absence d’accès au scan, connexion administrateur, consultation et refus motivé, filtre des dossiers refusés ; message explicite après arrêt de l’API de test. Vérification visuelle de l’écran de connexion et du détail administratif. L’aperçu utilisateur sur le port 7100 reste ouvert sur la connexion restaurateur, avec l’API principale démarrée.

Sources du registre : [API publique](https://www.data.gouv.fr/dataservices/api-recherche-dentreprises), [contrat OpenAPI](https://recherche-entreprises.api.gouv.fr/openapi.json).
