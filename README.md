# Donjons

Jeu de gestion : configure ton donjon (salles, pièges, monstres, garnison) pour le défendre en **raid PvP asynchrone**, et envoie une équipe de héros — personnalisés pièce par pièce via classe/sorts/talents/maîtrises obtenus au gacha, à la Pokémon — combattre en temps réel dans une **arène 2D façon Vampire Survivors** pour du loot, de l'équipement, du craft et des invocations gacha.

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

Une fois `.env.local` rempli, relance `npm run dev` : l'inscription (`/inscription`) crée un compte, un profil Firestore, un unique héros de départ **sans classe** ("Recrue") et 15 cristaux d'invocation de départ. Un héros sans classe reste jouable partout (expéditions comprises) mais avec des stats volontairement très faibles, pour inciter à lui assigner une classe dès qu'elle est débloquée à l'invocation.

## Systèmes de jeu

- **Héros** (`/heros`) : un héros commence vide — sans classe, sans sort, sans talent, sans maîtrise — et devient ce que tu en fais. Tout se pioche à l'invocation puis s'équipe/se retire librement (rien n'est consommé à l'usage, comme un movepool Pokémon), avec un inventaire dédié (`/heros/inventaire`) qui liste tout ce qui a été obtenu :
  - **Classe** : remplace un rôle DPS/HEAL/TANK figé — 6 classes possibles (Guerrier/Archer, Prêtre/Druide, Paladin/Colosse), rattachées à des stats de base + croissance par niveau. Change-la à tout moment (héros disponible requis) ; les points de talent déjà investis dans une classe restent en réserve et réapparaissent si tu la reprends plus tard. Simple débloqué/non-débloqué pour l'instant — pas de système de progression dédié (à venir séparément).
  - **Sorts** : de vrais sorts d'attaque (jusqu'à 4 équipés), 5 par classe (30 au total), chacun avec **deux effets de combat distincts** — jamais un simple bonus de stats passif. Équipable sur n'importe quel héros, quelle que soit sa classe ; avoir la classe assortie au sort rend juste son effet plus fort (bonus de puissance sur les deux volets ci-dessous, pas une condition pour l'utiliser). En donjon (raid au tour par tour), le sort modifie l'attaque du héros : éclaboussure sur une cible proche, dégâts renforcés contre une cible affaiblie, perce-défense, étourdissement, vol de vie, poison, bouclier contre le prochain coup, ou (classes de soin) un soin renforcé à la place d'attaquer. En zone PvE (arène temps réel), le même sort donne un effet différent adapté au jeu en temps réel (frappe de zone, projectiles multiples, soin passif, cadence, bonus de dégâts d'équipe, vol de vie).
  - **Talents** : arbre à 4 paliers par classe (le 4e nécessite un rang d'étoile ≥3, 42 nœuds au total), mais un nœud doit d'abord être obtenu au gacha avant de pouvoir y investir des points de talent (gagnés en montant de niveau).
  - **Maîtrises** : bonus passifs génériques (jusqu'à 3 équipées, 30 au total), non liés à une classe — plusieurs sont aussi des compromis bonus/malus (ex. + dégâts, − défense).
  - **Rang par doublon** : retirer un sort/talent/maîtrise déjà possédé au gacha ne redonne pas un doublon inerte — ça fait monter son rang (1 à 5, +8 %/rang sur son effet), jusqu'au rang max où il se reconvertit en jetons de rang. Les classes n'ont pas ce système (juste débloqué/non-débloqué).
  - **Ensembles** : sauvegarde nommée d'une combinaison classe + sorts + maîtrises, pour rebasculer instantanément entre plusieurs configurations sans perdre l'ancienne.
  - Le nombre d'emplacements de héros dépend de la filière d'amélioration de donjon **Antre des héros** (voir plus bas) — recrute un nouveau héros vierge une fois un emplacement libéré.
- **Attaque/défense physique et magique** : les stats attaque et défense sont chacune scindées en physique et magique (`atkPhys`/`atkMag`/`defPhys`/`defMag`). Au combat, une unité frappe avec sa valeur dominante (phys. ou mag.) et l'adversaire mitige avec la défense correspondante — un guerrier tout en attaque physique perce mal une cible en défense magique, et inversement. Classes/talents/sorts/maîtrises/objets peuvent viser l'un, l'autre, ou un mix.
- **Invocation (gacha)** (`/gacha`) : dépense des cristaux 💎 pour tirer une classe, un sort, un talent, une maîtrise, de l'or, des jetons de rang ou des fragments de monstre. Système de pity (garantie de rareté après N tirages sans). Un doublon de classe déjà possédée, ou un sort/talent/maîtrise déjà au rang maximum, se reconvertit automatiquement en jetons de rang.
- **Rang d'étoiles** (page détail d'un héros) : dépense jetons de rang + or pour monter un héros de 1★ à 5★ — augmente le cap de niveau, les stats, et débloque le talent de palier 4.
- **Expéditions** (`/expeditions`) : choisis une zone et une équipe, puis joue une **arène 2D en temps réel** (`/expeditions/jouer/[id]`) — déplacement au clavier (WASD/flèches), attaque automatique, vagues de monstres. Chaque sort équipé apporte un bonus actif dans l'arène selon le nombre de héros l'ayant équipé. Le butin (or, ressources, objet, capture de monstre, cristaux) dépend de la performance réelle (survie + kills), pas d'un tirage aveugle.
- **Donjon** (`/donjon`) : configure une grille de salles (pièges/monstres/garnison de héros) sur une grille 5×5, avec un budget de points et un nombre de salles maximum limités par tes **améliorations** (voir ci-dessous). Le layout doit rester connecté à l'entrée (vérifié côté serveur). Les héros affectés en garnison passent en statut "en garde" et ne peuvent plus partir en expédition tant qu'ils y sont.
- **Améliorations** (`/donjon/ameliorations`) : dépense des ressources pour monter 8 filières indépendantes de ton donjon — Expansion (salles max), Architecture (budget de points), Vigueur défensive (taille et stats de la garnison), Ingénierie des pièges (tiers débloqués et charges), Maîtrise des bêtes (stats des monstres capturés en garde), Densité des dangers (occupants max par salle), Capacité du trésor (réserve de butin totale du donjon), **Antre des héros** (emplacements de héros recrutables). Le coût de chaque niveau augmente (×1,35 par palier déjà atteint).
- **Raid PvP asynchrone** (`/donjon/attaquer`) : choisis une cible — le donjon d'un autre joueur, ou un **donjon pré-conçu par les développeurs** (4 tiers "bot", toujours disponibles pour ne jamais tomber sur une liste de cibles vide) — puis une équipe de héros disponibles, et explore la grille cible salle par salle (`/donjon/attaquer/raid`), sans jamais voir le layout complet à l'avance (brouillard de guerre : seules les salles visitées et leurs voisines immédiates sont révélées). Chaque salle atteinte peut contenir un piège (dégâts à toute l'équipe si une charge reste), des monstres/gardiens (combat au tour par tour, ciblage tank/soin), ou un trésor (butin mis en banque au fur et à mesure des salles atteintes). Fuir à tout moment conserve le butin déjà banqué ; se faire anéantir (piège ou combat perdu) fait tout perdre (risque total, "all-or-nothing"). Contre un vrai joueur : une victoire ou une fuite débite le butin volé de son stock de ressources ; s'il repousse l'attaque, il reçoit une petite compensation en cristaux.
- **Forge** (`/forge`) : craft d'équipement à partir de ressources récoltées en expédition.

## Architecture de jeu

- Tout ce qui modifie l'économie (or, cristaux, XP, loot, combat, craft, gacha) passe par des routes API serveur (`app/api/**/route.ts`) qui utilisent `firebase-admin` — le client ne peut qu'écouter ses propres données en lecture (`onSnapshot`), jamais écrire directement dans Firestore. Voir `firestore.rules`.
- Le contenu de jeu (classes, sorts, talents, maîtrises, salles/pièges/monstres, donjons "bot", filières d'amélioration, zones de farm, recettes de craft, table de gacha) est défini dans `lib/game/content/*.ts` — pas en base de données. Pour ajouter du contenu (une classe, un sort, une zone, une recette...), c'est le seul endroit à éditer. Les composants de héros (classes/sorts/talents/maîtrises) sont piochés au gacha : `UserProfile.unlockedClasses` (classes, simple liste) et `UserProfile.componentRanks` (sorts/talents/maîtrises, id → rang 1-5) puis équipés librement sur n'importe quel héros (`Hero.equippedSpellIds`/`equippedMasteryIds`/`talents`) — rien n'est consommé à l'équipement, voir `lib/game/engine/stats.ts` (`resolveHeroStats` prend le compte des rangs en 3ᵉ argument pour scaler chaque bonus).
- Le raid de donjon (`lib/game/engine/dungeonRaid.ts` + `dungeonCombat.ts` + `dungeonLayout.ts`) résout chaque déplacement de salle indépendamment côté serveur, avec un RNG seedé (mulberry32, `lib/game/engine/rng.ts`) dérivé du raid et de la position ciblée — déterministe et rejouable salle par salle (mais plus un seul replay global comme l'ancien système). Le layout complet du donjon défenseur n'est jamais envoyé au client : les routes `app/api/dungeon/raid/**` ne renvoient qu'une vue filtrée (`RaidView`) des salles visitées + les salles adjacentes non révélées, et le document Firestore `dungeonRaids/{raidId}` a une règle `read: false` inconditionnelle (même pour son propriétaire) — l'état brut du raid ne quitte jamais le serveur.
- La mini-jeu d'arène (`lib/game/arena/engine.ts`) tourne côté client en temps réel (boucle `requestAnimationFrame`) ; le résultat rapporté (survie, kills) est validé sommairement côté serveur avant de calculer le butin — un client déterminé pourrait tricher sur le résultat rapporté, acceptable pour un projet perso sans enjeu compétitif réel.
- Le combat de raid (`lib/game/engine/dungeonCombat.ts`) résout les dégâts par type : une unité attaque avec sa plus haute valeur entre `atkPhys`/`atkMag`, mitigée par la `defPhys`/`defMag` correspondante de la cible. L'arène (mini-jeu d'expédition) reste plus simple : elle additionne `atkPhys + atkMag` en dégâts bruts sans mitigation par type, pour ne pas complexifier son moteur temps réel.
- Le sort équipé d'un héros donne son `raidEffectTag` (`SpellDefinition`) au combat de raid : au tour de ce héros, `dungeonCombat.ts` applique l'effet (éclaboussure, dégâts renforcés, perce-défense, étourdissement — état `Set`/`Map` local à la salle qui persiste entre les rounds —, vol de vie, bouclier, ou soin renforcé pour les classes de soin) au lieu d'une attaque neutre. Un héros de garnison hérite du même effet via son sort équipé (`lib/game/engine/dungeonRaid.ts` `GarrisonMember.raidEffectTag`) ; les monstres n'ont pas de sort, donc pas d'effet. Le même sort donne un `arenaAbilityTag` différent pour l'arène (compté par nombre de héros l'ayant équipé, voir `lib/game/arena/engine.ts`).

## Roadmap (pas encore construit)

- Plus de zones, salles, pièges, monstres, recettes et métiers.
- Un vrai système de progression pour les classes (actuellement simple débloqué/non-débloqué, sans rang).
- Sorts non liés à une classe (tous les sorts actuels sont class-locked).
- Matchmaking PvP plus fin que la liste de cibles actuelle.
- Vrais sprites/assets graphiques dans l'arène (actuellement des emoji).

## Déploiement (Vercel)

1. Pousse le repo sur GitHub, importe-le dans Vercel.
2. Renseigne les mêmes variables d'environnement que `.env.local` dans les Settings du projet Vercel (Production + Preview).
3. Déploie — aucune configuration supplémentaire n'est nécessaire (`vercel.json` n'est pas requis pour ce projet Next.js standard).
