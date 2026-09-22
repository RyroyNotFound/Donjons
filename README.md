# Donjons

Jeu de gestion : configure ton donjon (salles, pièges, monstres, boss) pour le défendre en **PvP asynchrone**, et envoie une équipe de héros (DPS/HEAL/TANK, sous-classes, arbres de talents) **farmer des zones** pour du loot, de l'équipement et du craft.

Stack : Next.js (App Router, TypeScript) · Tailwind CSS · Firebase (Auth + Firestore) · Vercel.

## Démarrage

```bash
npm install
cp .env.local.example .env.local   # puis remplis les valeurs (voir ci-dessous)
npm run dev
```

L'app tourne sur [http://localhost:3000](http://localhost:3000). Les pages se chargent sans Firebase configuré, mais toute action de jeu (connexion, héros, donjon...) a besoin des clés ci-dessous.

## Configurer Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com) et crée un nouveau projet (nom libre, ex. `donjons`).
2. **Authentication** → Sign-in method → active le fournisseur **Email/Password**.
3. **Firestore Database** → Créer une base → mode production (les règles sont déjà fournies dans `firestore.rules`) → choisis une région proche.
4. Déploie les règles : installe la CLI Firebase (`npm i -g firebase-tools`), puis :
   ```bash
   firebase login
   firebase init firestore   # sélectionne le projet créé, garde firestore.rules existant
   firebase deploy --only firestore:rules
   ```
5. **Config web** : Paramètres du projet (⚙️) → Général → "Vos applications" → ajoute une app Web → copie les valeurs `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` dans les variables `NEXT_PUBLIC_FIREBASE_*` de `.env.local`.
6. **Compte de service (Admin)** : Paramètres du projet → Comptes de service → "Générer une nouvelle clé privée" → télécharge le JSON. Reporte-le dans `.env.local` :
   - `FIREBASE_PROJECT_ID` = `project_id`
   - `FIREBASE_CLIENT_EMAIL` = `client_email`
   - `FIREBASE_PRIVATE_KEY` = `private_key` (garde-le entre guillemets, avec ses `\n` littéraux)

   Ce compte de service n'est utilisé que côté serveur (routes `app/api/**`), jamais exposé au navigateur.

Une fois `.env.local` rempli, relance `npm run dev` : l'inscription (`/inscription`) crée un compte, un profil Firestore et 3 héros de départ (Guerrier, Prêtre, Paladin).

## Architecture de jeu

- Tout ce qui modifie l'économie (or, XP, loot, combat, craft) passe par des routes API serveur (`app/api/**/route.ts`) qui utilisent `firebase-admin` — le client ne peut qu'écouter ses propres données en lecture (`onSnapshot`), jamais écrire directement dans Firestore. Voir `firestore.rules`.
- Le contenu de jeu (classes, sous-classes, arbres de talents, salles/pièges/monstres, zones de farm, recettes de craft) est défini dans `lib/game/content/*.ts` — pas en base de données. Pour ajouter du contenu (une sous-classe, une zone, une recette...), c'est le seul endroit à éditer.
- La simulation de combat (`lib/game/engine/combat.ts`) est déterministe (seedée), ce qui permet de stocker et rejouer un battle log à l'identique.

## Roadmap (pas encore construit)

- Sous-classes supplémentaires par rôle (ex. Druide en plus du Prêtre) et arbres de talents plus étoffés.
- Plus de zones, salles, pièges, monstres, recettes et métiers.
- Matchmaking PvP plus fin que la liste de cibles actuelle.
- Habillage graphique (sprites) si le style idle/texte actuel ne suffit plus.

## Déploiement (Vercel)

1. Pousse le repo sur GitHub, importe-le dans Vercel.
2. Renseigne les mêmes variables d'environnement que `.env.local` dans les Settings du projet Vercel (Production + Preview).
3. Déploie — aucune configuration supplémentaire n'est nécessaire (`vercel.json` n'est pas requis pour ce projet Next.js standard).
