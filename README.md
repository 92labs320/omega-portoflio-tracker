# Omega Portfolio Tracker

App iOS de suivi de portefeuille crypto et actions par 92labs. Expo SDK 54 · React Native 0.81 · Expo Router · SQLite local · sauvegarde cloud anonyme sur **Neon** via une API **Vercel**.

## Architecture

```
iPhone (Expo)                          Vercel (backend/)                 Neon
┌──────────────────────────┐   HTTPS   ┌──────────────────────┐   SQL   ┌──────────────┐
│ SQLite local (source de  │ ────────▶ │ /api/sync            │ ──────▶ │ transactions │
│ vérité, marche hors-ligne)│          │ /api/account (DELETE)│         └──────────────┘
│ Clé anonyme (Keychain)   │           │ /api/quotes → Finnhub│
│ CoinGecko en direct      │           │ /privacy /terms /support (pages statiques)
└──────────────────────────┘           └──────────────────────┘
```

- **Pas de compte.** L'app génère une clé aléatoire de 256 bits stockée dans le Keychain. Le serveur ne garde que son hash SHA-256.
- **La chaîne de connexion Neon ne quitte jamais Vercel.** Rien de secret n'est embarqué dans l'app (seule `EXPO_PUBLIC_API_URL` y figure).
- **Synchro** : last-write-wins sur `updated_at`, suppressions par tombstone, curseur `server_seq` côté serveur.
- **Calcul du P&L** : méthode du coût moyen, frais inclus (`lib/portfolio.ts`, testé).

## Arborescence

```
app/                     écrans (Expo Router)
  (tabs)/                Home, Markets, Portfolio, Settings
  add-transaction/       catégorie → type → formulaire (création et édition)
  asset/[key].tsx        détail d'une position + transactions
lib/                     db.ts (SQLite), sync.ts (Neon), portfolio.ts (calculs), format.ts
services/marketService   CoinGecko + cotations actions via l'API
store/portfolioStore     état Zustand
backend/                 API Vercel + schéma Neon + pages légales
docs/APP_STORE.md        textes et réponses App Store Connect
```

## Commandes

```powershell
npm install
npm run typecheck       # TypeScript
npm test                # tests du calcul de portefeuille
npx expo-doctor
npx expo start --clear
```

Backend :

```powershell
cd backend
npm install
npm run typecheck
npm test                # teste la synchro sur un vrai Postgres (PGlite)
```

---

## Mise en production — étape par étape

### 1. Neon (base de données)

1. Crée un compte sur https://console.neon.tech, puis un projet **omega-portfolio**. Choisis la région **AWS US East (Ohio)** ou **N. Virginia**, la plus proche de Vercel par défaut.
2. Ouvre **Connect**, coche **Pooled connection** et copie la chaîne `postgresql://…-pooler…/neondb?sslmode=require`.
3. Crée la table depuis ton PC :

```powershell
cd "C:\Users\kamde\OneDrive\Bureau\omega-portfolio-tracker\backend"
npm install
$env:DATABASE_URL="COLLE_ICI_LA_CHAINE_NEON"
npm run migrate
```

Résultat attendu : `Schema applied. transactions table ready (0 rows).`

### 2. Finnhub (prix des actions, gratuit)

Inscris-toi sur https://finnhub.io/register et copie ta clé API. Sans clé, l'app fonctionne quand même, mais les actions s'affichent sans prix.

### 3. Vercel (API + pages légales)

1. Sur https://vercel.com/new, importe le dépôt `92labs320/omega-portoflio-tracker`.
2. **Root Directory** : `backend`. Framework Preset : **Other**.
3. **Environment Variables** :
   - `DATABASE_URL` = la chaîne Neon
   - `FINNHUB_API_KEY` = ta clé Finnhub
4. Nomme le projet **omega-portfolio** pour obtenir `https://omega-portoflio-tracker-backend.vercel.app`, puis clique **Deploy**.
5. Vérifie :
   - `https://omega-portoflio-tracker-backend.vercel.app/api/health` doit répondre `{"ok":true,...}`
   - `https://omega-portoflio-tracker-backend.vercel.app/privacy` doit afficher la politique de confidentialité

Domaine de production actuel : `omega-portoflio-tracker-backend.vercel.app` (déjà configuré dans `eas.json`, `constants/Config.ts` et `docs/APP_STORE.md`). La branche de production Vercel doit suivre `expo-app`.

### 4. Variables locales de l'app

Crée `.env` à la racine (jamais commité) :

```
EXPO_PUBLIC_API_URL=https://omega-portoflio-tracker-backend.vercel.app
```

Pour les builds EAS, la valeur est déjà dans `eas.json`.

### 5. Build iOS et TestFlight

```powershell
cd "C:\Users\kamde\OneDrive\Bureau\omega-portfolio-tracker"
npm install
npx.cmd expo-doctor
eas build --platform ios --profile production
eas submit --platform ios --latest
```

`eas build` demande ton compte Apple Developer et gère seul les certificats. Le numéro de build s'incrémente automatiquement.

Installe ensuite l'app depuis **TestFlight** sur ton iPhone et passe la checklist ci-dessous.

### 6. App Store Connect

Tout est dans [`docs/APP_STORE.md`](docs/APP_STORE.md) : description, mots-clés, notes pour le reviewer, réponses « App Privacy », captures à faire.

## Checklist avant soumission

- [ ] L'app démarre sur iPhone sans crash (TestFlight)
- [ ] Home et Markets affichent des prix réels avec l'heure de mise à jour
- [ ] Mode avion : message « Live prices unavailable », aucun prix inventé
- [ ] Ajouter, modifier et supprimer une transaction ; fermer l'app puis la rouvrir : les données sont toujours là
- [ ] Portfolio : valeur et P&L cohérents avec un calcul à la main
- [ ] Settings → Cloud backup ON, « Back up now » OK ; effacer les données de l'iPhone puis relancer la synchro : les données reviennent
- [ ] Settings → Delete cloud backup OK
- [ ] Privacy, Terms et Support s'ouvrent
- [ ] Captures 6,9" prises, métadonnées et App Privacy remplies

## Ce qui a changé par rapport à la version Supabase

- Supabase, l'authentification, `app/auth/*` et `authStore` sont supprimés.
- Persistance locale SQLite + synchro Neon optionnelle (les transactions étaient perdues à chaque relance).
- Plus aucun prix fictif sur Home ni de graphique aléatoire sur Portfolio.
- Les prix des positions sont réellement récupérés (avant, `currentPrice` restait à 0).
- AdMob est retiré de la V1. Le SDK sans App ID configuré fait planter iOS au lancement, et son retrait évite l'invite ATT et alourdit moins la fiche App Privacy. À réintégrer en 1.1 si besoin.
- NativeWind est retiré : il n'était utilisé que par du code mort, et `babel.config.js` revient au preset Expo seul.
- Icône et splash Omega remplacent les placeholders Expo.
