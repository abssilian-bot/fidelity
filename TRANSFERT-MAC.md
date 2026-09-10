# 📱 Transfert Mac — soumettre Fidelity à l'App Store

> **Pour qui :** le propriétaire du projet (Windows) et l'ami qui possède un Mac.
> **Principe :** le repo contient un projet iOS complet (`app/ios/`). Le Mac sert
> uniquement à compiler, signer et envoyer le binaire chez Apple. Tout le reste
> (fiche App Store, soumission) se fait dans un navigateur, depuis Windows.

---

## Ce qui est déjà prêt dans le repo

- `app/ios/` : projet Xcode complet généré par Capacitor 8 (**Swift Package Manager —
  aucun CocoaPods à installer**).
- L'app embarque le front compilé et appelle l'API de production
  (`https://fidelity-api-mcld.onrender.com`, configuré via `app/.env.ios`).
- Permissions caméra (scan QR) et exemption de chiffrement déjà déclarées dans
  `ios/App/App/Info.plist`.
- Le backend autorise les origines natives (`capacitor://localhost`) — rien à changer
  sur Render.

---

## Étape 1 — toi, depuis Windows (10 min)

1. **Inviter ton ami dans ton équipe Apple** : [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   → *Utilisateurs et accès* → **+** → rôle **Développeur**. Il utilisera **son propre
   Apple ID** — ne lui donne jamais le tien.
2. Vérifie que l'App ID **`com.fidelity.app`** existe sur
   [developer.apple.com](https://developer.apple.com/account/resources/identifiers/list)
   → *Identifiers*. Sinon, Xcode pourra le créer automatiquement à l'étape signature.
3. Dis à ton ami de cloner : `git clone https://github.com/abssilian-bot/fidelity.git`

## Étape 2 — ton ami, sur son Mac (30-45 min)

```bash
# 1. Installer Xcode depuis l'App Store, l'ouvrir une fois (licence + composants)
# 2. Puis :
cd fidelity/app
npm install
npm run build:ios        # compile le front et l'injecte dans le projet iOS
open ios/App/App.xcodeproj
```

3. Dans Xcode : cible **App** → onglet **Signing & Capabilities** → cocher
   **Automatically manage signing** → **Team** : choisir ton équipe (visible grâce à
   l'invitation). Xcode crée le profil de signature tout seul.
4. **Test sur iPhone réel** (fortement recommandé avant l'archive) : brancher le
   téléphone, le sélectionner en haut, **Run ▶**. Vérifier : connexion par e-mail,
   scan QR avec la caméra, cartes de fidélité.
5. **Archive** : menu **Product → Archive** → fenêtre Organizer → **Distribute App**
   → **App Store Connect** → **Upload**. (10-20 min de traitement côté Apple ensuite.)
6. Si Apple répond « build déjà utilisé » : incrémenter **Build** dans
   *General → Identity* et recommencer.

## Étape 3 — toi, depuis Windows (navigateur)

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → *Mes apps* → créer
   la fiche **Fidelity** (bundle `com.fidelity.app`).
2. **Captures d'écran** : ton ami les fait sur son iPhone (6,7") ou le simulateur
   Xcode, et te les envoie.
3. Remplir : description, mots-clés, **URL de politique de confidentialité**
   (obligatoire), catégorie (Food & Drink / Social Networking).
4. **Compte de démo pour le réviseur Apple** (obligatoire) : e-mail + mode d'emploi
   du scan et des cartes — voir point 6 de [PREPARATION-APPLE.md](PREPARATION-APPLE.md).
5. Sélectionner le build uploadé → **Soumettre pour révision**.

---

## ⚠️ À traiter AVANT la soumission (rejets probables sinon)

Extraits de [PREPARATION-APPLE.md](PREPARATION-APPLE.md) :

- **Suppression de compte dans l'app** — obligatoire dès qu'une app permet de créer
  un compte (règle 5.1.1). Pas encore implémentée.
- **Signalement et blocage d'utilisateurs** (règle 1.2 — réseau social avec contenu
  généré par les utilisateurs).
- **Politique de confidentialité publique** et contact d'assistance réels.
- **E-mails de connexion** : sans domaine vérifié chez Resend, les liens ne partent
  que vers l'adresse du compte Resend. Le réviseur Apple doit pouvoir se connecter
  → vérifier un domaine (~10 €/an) ou pré-créer le compte de démonstration.
- **Liens magiques** : en v1, le lien reçu ouvre Safari (version web). Pour ouvrir
  directement l'app → *universal links* (fichier `apple-app-site-association` à
  héberger sur le domaine de l'API). Prévu en v1.1.

## Résumé des rôles

| Qui | Quoi |
|---|---|
| **Toi (Windows)** | Invitation équipe, App ID, fiche App Store Connect, politique de confidentialité, compte démo, soumission |
| **Ton ami (Mac)** | Clone, `npm run build:ios`, signature, test iPhone, archive, upload, captures d'écran |

## En cas de pépin

| Symptôme | Piste |
|---|---|
| « No signing certificate » | L'invitation d'équipe n'est pas acceptée → ton ami vérifie ses e-mails Apple |
| Build échoue sur les packages SPM | Xcode → *File → Packages → Reset Package Caches*, puis rebuild |
| L'app affiche la démo hors ligne | L'API Render est endormie (free tier) : ouvrir `https://fidelity-api-mcld.onrender.com/health` pour la réveiller, attendre 30 s, relancer |
| « Bundle ID non disponible » | `com.fidelity.app` est pris par un autre compte → en choisir un autre dans `app/capacitor.config.ts` + Xcode, puis `npm run build:ios` |
