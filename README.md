# Donjons

Jeu de gestion : configure ton donjon (salles, pièges, monstres, boss) pour le défendre en **PvP asynchrone**, et envoie une équipe de héros (DPS/HEAL/TANK, 6 sous-classes, arbres de talents, rang d'étoiles) combattre en temps réel dans une **arène 2D façon Vampire Survivors** pour du loot, de l'équipement, du craft et des invocations gacha.

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
3. **Firestore Database** → Créer une base → mode production → choisis une région proche.
4. **Règles Firestore** : onglet Règles de la base Firestore → colle le contenu de `firestore.rules` de ce repo → Publier. (Alternative en CLI : `firebase login && firebase init firestore && firebase deploy --only firestore:rules`.)
5. **Config web** : Paramètres du projet (⚙️) → Général → "Vos applications" → ajoute une app Web → copie les valeurs `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` dans les variables `NEXT_PUBLIC_FIREBASE_*` de `.env.local`.
6. **Compte de service (Admin)** : Paramètres du projet → Comptes de service → "Générer une nouvelle clé privée" → télécharge le JSON. Reporte-le dans `.env.local` :
   - `FIREBASE_PROJECT_ID` = `project_id`
   - `FIREBASE_CLIENT_EMAIL` = `client_email`
   - `FIREBASE_PRIVATE_KEY` = `private_key`, **entre guillemets**, avec ses `\n` littéraux tels quels (attention si tu copies-colles depuis le JSON : n'inclus pas la virgule de fin de ligne du JSON, elle ferait partie de la valeur et casserait le parsing de la clé).

   Ce compte de service n'est utilisé que côté serveur (routes `app/api/**`), jamais exposé au navigateur.

Une fois `.env.local` rempli, relance `npm run dev` : l'inscription (`/inscription`) crée un compte, un profil Firestore, 3 héros de départ (Guerrier, Prêtre, Paladin) et 15 cristaux d'invocation de départ.

## Systèmes de jeu

- **Héros** : 3 rôles (DPS/HEAL/TANK) × 2 sous-classes chacun (Guerrier/Archer, Prêtre/Druide, Paladin/Colosse), arbre de talents à 4 paliers par sous-classe (le 4e palier nécessite un rang d'étoile ≥3), niveau (XP via expéditions) plafonné par le rang d'étoile.
- **Invocation (gacha)** (`/gacha`) : dépense des cristaux 💎 pour tirer un héros, de l'or, des éclats de sous-classe ou des fragments de monstre. Système de pity (garantie de rareté après N tirages sans). Un doublon de sous-classe déjà possédée se convertit automatiquement en éclats.
- **Rang d'étoiles** (page détail d'un héros) : dépense éclats + or pour monter un héros de 1★ à 5★ — augmente le cap de niveau, les stats, et débloque le talent de palier 4.
- **Expéditions** (`/expeditions`) : choisis une zone et une équipe, puis joue une **arène 2D en temps réel** (`/expeditions/jouer/[id]`) — déplacement au clavier (WASD/flèches), attaque automatique, vagues de monstres. Chaque sous-classe apporte un bonus actif dans l'arène selon le nombre de héros de cette sous-classe emmenés (Guerrier = frappe de zone, Archer = projectiles supplémentaires, Prêtre = soin passif, Druide = cadence d'attaque, Paladin = bonus de dégâts, Colosse = vol de vie). Le butin (or, ressources, objet, capture de monstre, cristaux) dépend de la performance réelle (survie + kills), pas d'un tirage aveugle.
- **Donjon** (`/donjon`) : configure tes salles (pièges/monstres/boss) avec un budget de points limité.
- **Attaque PvP asynchrone** (`/donjon/attaquer`) : attaque le donjon d'un autre joueur, combat simulé côté serveur (déterministe, seedé) salle par salle. Le vainqueur vole de l'or/ressources au perdant ; défendre avec succès rapporte des cristaux au propriétaire du donjon.
- **Forge** (`/forge`) : craft d'équipement à partir de ressources récoltées en expédition.

## Architecture de jeu

- Tout ce qui modifie l'économie (or, cristaux, XP, loot, combat, craft, gacha) passe par des routes API serveur (`app/api/**/route.ts`) qui utilisent `firebase-admin` — le client ne peut qu'écouter ses propres données en lecture (`onSnapshot`), jamais écrire directement dans Firestore. Voir `firestore.rules`.
- Le contenu de jeu (classes, sous-classes, arbres de talents, salles/pièges/monstres, zones de farm, recettes de craft, table de gacha) est défini dans `lib/game/content/*.ts` — pas en base de données. Pour ajouter du contenu (une sous-classe, une zone, une recette...), c'est le seul endroit à éditer.
- La simulation de combat PvP (`lib/game/engine/combat.ts`) est déterministe (seedée), ce qui permet de stocker et rejouer un battle log à l'identique. La mini-jeu d'arène (`lib/game/arena/engine.ts`) tourne côté client en temps réel (boucle `requestAnimationFrame`) ; le résultat rapporté (survie, kills) est validé sommairement côté serveur avant de calculer le butin — un client déterminé pourrait tricher sur le résultat rapporté, acceptable pour un projet perso sans enjeu compétitif réel.

## Roadmap (pas encore construit)

- Plus de zones, salles, pièges, monstres, recettes et métiers.
- Rendre les fragments de monstre (gacha) et les monstres capturés en expédition réellement utilisables dans le donjon.
- Matchmaking PvP plus fin que la liste de cibles actuelle.
- Vrais sprites/assets graphiques dans l'arène (actuellement des emoji).

## Déploiement (Vercel)

1. Pousse le repo sur GitHub, importe-le dans Vercel.
2. Renseigne les mêmes variables d'environnement que `.env.local` dans les Settings du projet Vercel (Production + Preview).
3. Déploie — aucune configuration supplémentaire n'est nécessaire (`vercel.json` n'est pas requis pour ce projet Next.js standard).
