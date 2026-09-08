# Préparation Apple — état vérifié du 8 septembre 2026

Le dépôt est une application web React et une API Fastify. Il ne contient pas encore de projet iOS, de binaire signé ou de fiche App Store Connect. Le compte Apple Developer est actif et le certificat Wallet a été créé. L'installation d'une carte depuis un site et la soumission d'une application à l'App Store sont deux livraisons distinctes.

## Livré dans le code

- Scan caméra, lecture d'image et code de secours ; crédits et récompenses contrôlés par le serveur, reprise sans double comptage.
- Export Wallet signé et service complet de mise à jour ; activation publique soumise à l'installation des secrets sur Render puis à un essai iPhone réel. Voir `CARTES-WALLET.md`.
- Vrai QR d'inscription, lien direct vers le restaurant, export SVG et impression/PDF.
- Enregistrement serveur des offres depuis la Façade. Le bouton de sauvegarde du menu publie également les données.
- Likes et abonnements des véritables publications/profils enregistrés en base, compteurs serveur ; chargement des FoodShare publics.
- Partage système/copie du lien restaurant, publications enregistrées dans le navigateur, sélecteur FoodShare ; onglet À propos et itinéraire fonctionnels. Les outils internes sans action ont été retirés. L'icône d'avis ouvre désormais le parcours d'avis FoodShare ; elle ne prétend pas ouvrir des commentaires de posts.

## Obstacles encore présents avant une soumission

1. Créer une application iOS, la compiler et la signer avec Xcode, la tester sur iPhone et préparer la fiche App Store Connect. La simple disponibilité du site ne constitue pas une soumission iOS.
2. Ajouter une suppression de compte dans l'application, avec traitement serveur des données associées ; la déconnexion actuelle n'est pas une suppression de compte.
3. Compléter le signalement des contenus, le blocage des utilisateurs et le traitement des signalements. La validation FoodShare par le restaurant ne couvre pas seule les exigences de modération du réseau social.
4. Publier une politique de confidentialité et un contact d'assistance réels, avec l'identité de l'éditeur et les traitements/durées de conservation confirmés. Renseigner correctement les déclarations de données et les permissions caméra dans la version iOS.
5. Vérifier l'envoi de liens de connexion aux adresses externes : `onboarding@resend.dev` sans domaine vérifié est limité à l'adresse du compte Resend. Le compte de test Apple doit pouvoir se connecter sans dépendre de la boîte personnelle de l'éditeur.
6. Fournir un compte de démonstration utilisable par Apple, un restaurant autorisé et des instructions permettant d'essayer le scan et Wallet. Le choix d'interface restaurateur n'accorde aucun droit de propriété.
7. Retirer ou finaliser les parcours encore présentés comme démonstrations : stories, carte géographique illustrée et préparation locale de nouveaux établissements. Les photos FoodShare proposées sont des images d'exemple ; le téléversement de photos personnelles reste à développer. Les favoris restaurant et les brouillons ne sont pas encore synchronisés entre appareils. Le registre de récompenses utilise actuellement un objectif unique, même si l'éditeur local permet de préparer plusieurs paliers.
8. Vérifier la version réellement déployée, les migrations, les certificats et les essais caméra/Wallet sur les appareils cibles. Une compilation ou une suite de tests locale ne prouve pas leur fonctionnement sur iPhone en production.

Les critères pertinents sont la complétude (2.1), le contenu utilisateur (1.2), la fonctionnalité minimale (4.2) et la confidentialité/suppression de compte (5.1.1). Ils motivent cette liste, sans préjuger de la décision d'Apple. [Règles officielles App Review](https://developer.apple.com/app-store/review/guidelines/).

## Validation technique

Backend : TypeScript, 27 tests API, 20 FoodShare, 30 sécurité (dont offres et interactions sociales), 17 Wallet, 10 auth, 5 adhésions, 9 recherche. Front : build Vite/TypeScript, 13 compte/API, 50 recherche, 6 cartes, 4 scan, 7 Discovery. Total : **198 scénarios**, sans envoi Resend réel dans les suites.

Un audit syntaxique a examiné les boutons natifs du code applicatif. Les parcours de navigation doivent également être testés dans le navigateur ; un gestionnaire `onClick` présent n'établit pas à lui seul que toute fonctionnalité est prête. Les tests PostgreSQL s'exécutent exclusivement dans une base locale jetable `fidelity_security_*`.

Essai navigateur sur une API/base isolée : lecture d'une image QR générée par le parcours membre, reconnaissance de Camille, ajout de 2 coches, reçu serveur, activité du restaurateur et carte membre à 7 coches (5 avant). Après arrêt de cette API de test, l'accueil affiche le repli de démonstration et reste utilisable. La sélection de couverture met désormais à jour le brouillon envoyé au serveur. L'export SVG repose sur un téléchargement navigateur ; le navigateur intégré n'a pas remonté d'événement de téléchargement pour cette URL Blob, donc la récupération du fichier reste à vérifier dans Safari/Chrome. La caméra physique et l'installation/mise à jour Wallet sur iPhone ne sont pas validées par cet essai.
