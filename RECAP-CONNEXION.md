# 🔌 Récap connexion front ↔ backend — session du 1er septembre

> **TL;DR : ton app est connectée au vrai backend. Tout a été testé dans le navigateur, écran par écran. ✅**

---

## 1. Ce qui a été fait

| Morceau | Détail |
|---|---|
| **Pont API** (`app/src/lib/api.ts`) | Nouveau fichier : toutes les fonctions pour parler au backend (restos, connexion, soldes, historique, clients restaurateur, publication) |
| **2 routes backend ajoutées** | `GET /restaurants/:id/members` (clients du restaurateur) et `PUT /restaurants/:id/menu` (édition du menu) |
| **App.tsx** | Au démarrage, l'app charge les vraies données du serveur (avec repli démo si le serveur est éteint) |
| **Studio (espace restaurateur)** | Les boutons "Publier" écrivent maintenant **pour de vrai** dans la base (avant : simple toast "publié localement") |
| **Page d'accueil** | Affiche "Connecté au serveur · données en temps réel" ou "serveur hors ligne, données de démonstration" selon le cas |

## 2. Ce qui a été testé dans le navigateur (captures à l'appui)

- ✅ Accueil : 6 restos réels venant de Supabase
- ✅ Fidélité : cartes avec **vrais soldes** (Chez Amina : 2/10 coches réelles — les points de mes tests API)
- ✅ Historique : les vrais mouvements du ledger (date, montant, solde)
- ✅ Page restaurant : profil + carte fidélité réels
- ✅ Espace restaurateur : vraie liste de clients (Camille, 2/10 coches) + activité récente réelle
- ✅ **Bouton "Publier le profil et le menu"** : écrit en base (vérifié en relisant la base après coup)

## 3. Le bug qu'on a trouvé ensemble (et corrigé)

Le bouton Publier ne faisait rien. Cause trouvée : **la bibliothèque CORS du serveur n'autorisait que GET/POST par défaut** — les PUT (modifications) étaient bloqués silencieusement par le navigateur. Corrigé dans `backend/src/server.ts` (methods explicites). C'est un piège ultra classique, bonne pioche de l'avoir attrapé maintenant.

## 4. Comment tout démarrer (2 terminaux)

```bash
# Terminal 1 — l'API
cd C:\Users\jebza\Documents\Kimi\Workspaces\OnMangeQuoi\backend
npm run dev

# Terminal 2 — l'app
cd C:\Users\jebza\Documents\Kimi\Workspaces\OnMangeQuoi\app
npm run dev
```

Puis ouvre **http://localhost:3000** — l'app se connecte toute seule avec les comptes démo.

> ⚠️ Si l'API n'est pas lancée, l'app bascule automatiquement en mode démo (rien ne casse).

## 5. Ce qui reste en mode démo (normal, c'est la phase 3)

- Le fil social, les stories, FoodShare, les profils membres → affichent les données fictives (le backend social n'est pas encore codé)
- Le scan caméra commerçant → le bouton existe, la route backend `POST /ledger/earn` est prête et testée, il manque juste l'écran caméra dans le front
- Les photos des restos → images locales (Supabase Storage plus tard)

## 6. Prochaine étape logique

**Mettre en ligne** : API sur Render (gratuit) + l'app packagée avec Capacitor pour iPhone/Android. À faire ensemble, jamais sans toi (création de comptes).

*Session du 01/09/2026 — tout testé et fonctionnel.*
