# Cartes, scan et Apple Wallet — 8 septembre 2026

## Parcours réalisé

Une adhésion ne crédite aucun point. « Ajouter à mes cartes » crée ou retrouve l'adhésion du membre connecté. Le solde provient exclusivement des mouvements confirmés en base. Sans backend, la démonstration reste navigable ; elle ne produit aucun crédit réel.

Le propriétaire d'un établissement validé ouvre **Résumé → Scanner un client**, lit le QR avec la caméra, choisit le nombre de coches/points et valide. Un reçu serveur précède le bouton **Client suivant**. Saisie du code et lecture d'une image sont disponibles en secours ; cette image n'est pas envoyée au serveur. Une coupure propose de vérifier la même opération, avec sa référence conservée, sans double crédit. L'unité du reçu survit aussi à cette reprise.

## Carte Apple Wallet

Le bouton d'export dépend de `GET /wallet/status`. Avec une configuration valide, il demande un téléchargement limité à 60 secondes pour la carte du membre. Le fichier `.pkpass` est signé et contient une carte classique orange, le nom du restaurant, le solde, l'objectif, la récompense et un QR. Un serveur non configuré explique l'indisponibilité ; il ne distribue aucun faux fichier Wallet.

Le certificat Apple Pass Type ID a été créé et téléchargé le 8 septembre 2026. La correspondance avec la clé privée, la signature par le certificat intermédiaire Apple G4, la validité et la génération d'un pass avec ce véritable certificat ont été vérifiées localement. La clé et les certificats sont hors Git dans `.local/apple-wallet/certs/`.

### Variables sur le serveur public

| Variable | Valeur attendue |
| --- | --- |
| `APPLE_WALLET_PASS_TYPE_ID` | Identifiant Pass Type ID enregistré chez Apple |
| `APPLE_WALLET_TEAM_ID` | Identifiant de l'équipe Apple, 10 caractères |
| `APPLE_WALLET_WEB_SERVICE_URL` | `https://votre-api/wallet`, sans query ni fragment |
| `APPLE_WALLET_WWDR_CERT_PATH` | Chemin du certificat intermédiaire Apple G4 au format PEM |
| `APPLE_WALLET_SIGNER_CERT_PATH` | Chemin du certificat Pass Type ID PEM |
| `APPLE_WALLET_SIGNER_KEY_PATH` | Chemin de la clé privée correspondante PEM |
| `APPLE_WALLET_SIGNER_KEY_PASSPHRASE` | Seulement si la clé est chiffrée |
| `APP_URL` | Adresse HTTPS publique de Fidelity |

Sur Render, conserver les trois fichiers dans **Secret Files**, par exemple `/etc/secrets/wwdr.pem`, `/etc/secrets/signer-cert.pem` et `/etc/secrets/fidelity-wallet.key.pem`. Ne jamais ajouter la clé privée au dépôt, aux journaux ni au frontend. Renouveler le certificat avant expiration en conservant le Pass Type ID, les numéros de série et les tokens existants.

### Mise à jour du solde

Les routes standard `/wallet/v1/…` gèrent inscription/désinscription des appareils, liste des cartes modifiées, téléchargement authentifié de la dernière version et diagnostic. Chaque carte possède un secret de mise à jour distinct du QR ; l'identifiant de l'appareil est stocké sous forme d'empreinte.

Les crédits, débits, bonus FoodShare et modifications du programme ou du nom du restaurant augmentent la version dans la transaction métier. Un worker traite la file persistante toutes les 15 secondes et envoie une notification APNs vide avec le certificat du pass. Échec Apple : délai progressif avant nouvelle tentative, sans annuler la visite. Une modification survenue pendant l'envoi reste à distribuer. Les appareils supprimés par Apple sont désinscrits. Apple contrôle la réception et le rafraîchissement effectif : il ne s'agit pas d'une garantie d'affichage instantané.

### QR et fraude

Le QR dans Fidelity (`fc1_…`) est valable deux minutes pour une seule opération. Le QR Wallet (`fidelity:wallet:fw1_…`) est permanent : seuls le propriétaire du restaurant et les administrateurs peuvent l'échanger contre une présentation courte, liée à l'opérateur, **réservée aux crédits**. Un débit de récompense ou une correction exige le QR temporaire ouvert par le client dans Fidelity.

Cette distinction évite qu'une copie du QR Wallet serve à dépenser un solde. Elle ne prouve pas l'encaissement : un commerçant autorisé peut encore déclarer un achat fictif. Une preuve de paiement/POS demeure nécessaire pour contrôler ce risque.

## Vérifications et activation

Les migrations `20260908010000_apple_wallet` et `20260908020000_restaurant_offers` ont été appliquées sur PostgreSQL local. Les nouvelles tables Wallet ont RLS activée et aucun droit SQL public. `backend/scripts/test-wallet.mjs` vérifie 17 scénarios : signature PKCS7, manifeste, accès, QR, doublons, expiration, protocole Apple et reprises APNs. Ce test utilise des certificats de test et un transport APNs simulé dans une base locale jetable.

Avant de déclarer Wallet opérationnel en production : installer les fichiers secrets sur Render, appliquer les migrations avec `npm run start:render`, vérifier `/wallet/status`, ajouter une vraie carte depuis Safari sur iPhone, créditer depuis un second appareil et constater le nouveau solde dans Wallet. Tester aussi une récompense depuis le QR temporaire Fidelity. La réception physique APNs et la caméra iPhone ne peuvent pas être validées depuis cet ordinateur seul.

Le QR d'affiche restaurant est désormais un vrai QR d'inscription avec lien `?restaurant=slug`, téléchargement SVG et impression/PDF. Générer les affiches depuis le site public ; `127.0.0.1` ne permet pas aux téléphones des clients d'ouvrir le site.

Références : [création et signature Apple](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html), [protocole de mise à jour et APNs](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html), [certificats intermédiaires Apple](https://developer.apple.com/help/account/certificates/wwdr-intermediate-certificates).
