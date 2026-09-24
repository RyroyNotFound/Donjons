// "Le Velours Noir" — standalone joke dating-sim. Pure client-side content, no link to the main game economy.
// All characters are adults. Tone: suggestive / innuendo, always fades to black.

export type Style = "charme" | "humour" | "audace" | "sincere" | "flambe";

export const STYLE_META: Record<Style, { label: string; icon: string; color: string }> = {
  charme: { label: "Charme", icon: "🌹", color: "text-rose-300" },
  humour: { label: "Humour", icon: "😏", color: "text-amber-300" },
  audace: { label: "Audace", icon: "🔥", color: "text-orange-400" },
  sincere: { label: "Sincère", icon: "💬", color: "text-sky-300" },
  flambe: { label: "Flambe", icon: "💸", color: "text-emerald-300" },
};

export type GiftId =
  | "rose"
  | "chocolats"
  | "livre"
  | "menottes"
  | "vinyle"
  | "jeu"
  | "whisky"
  | "lingerie"
  | "parfum"
  | "bijou";

export interface Gift {
  id: GiftId;
  label: string;
  icon: string;
  price: number;
  /** Offending before the "Complice" threshold unless it's her favorite. */
  spicy?: boolean;
}

export const GIFTS: Gift[] = [
  { id: "rose", label: "Rose rouge", icon: "🌹", price: 30 },
  { id: "chocolats", label: "Chocolats fins", icon: "🍫", price: 60 },
  { id: "livre", label: "Livre ancien", icon: "📕", price: 80 },
  { id: "menottes", label: "Menottes en velours", icon: "⛓️", price: 90, spicy: true },
  { id: "vinyle", label: "Vinyle de jazz", icon: "🎷", price: 120 },
  { id: "jeu", label: "Jeu vidéo collector", icon: "🎮", price: 150 },
  { id: "whisky", label: "Whisky de 25 ans", icon: "🥃", price: 180 },
  { id: "lingerie", label: "Lingerie en soie", icon: "👙", price: 200, spicy: true },
  { id: "parfum", label: "Parfum de luxe", icon: "🧴", price: 220 },
  { id: "bijou", label: "Collier de diamants", icon: "💎", price: 400 },
];

export interface Hostess {
  id: string;
  name: string;
  age: number;
  tagline: string;
  emoji: string;
  /** Tailwind gradient classes for the portrait. */
  gradient: string;
  /** -2..3 — how much she likes each conversation style. */
  prefs: Record<Style, number>;
  favoriteGift: GiftId;
  /** Multiplier on positive gains (harder hostesses < 1). */
  difficulty: number;
  /** Only shows up once this many other hostesses are conquered. */
  unlockAfter?: number;
  intro: string;
  reactions: Record<Style, string>;
  /** Scenes at 40 (Complice), 70 (Troublée) and 100 (after, conquest). */
  scenes: [string, string, string];
}

export const MILESTONES = [40, 70] as const;
export const CONQUEST_THRESHOLD = 100;

export const HOSTESSES: Hostess[] = [
  {
    id: "scarlett",
    name: "Scarlett",
    age: 29,
    tagline: "Femme fatale en robe rouge",
    emoji: "💋",
    gradient: "from-red-500 to-rose-900",
    prefs: { charme: 2, humour: 1, audace: 3, sincere: -1, flambe: 0 },
    favoriteGift: "lingerie",
    difficulty: 1,
    intro: "*Elle fait tourner une cerise entre ses lèvres.* Tu t'es perdu, mon mignon ? Ou tu viens te faire dévorer ?",
    reactions: {
      charme: "Joli. Tu as appris ça dans un film ? Continue quand même.",
      humour: "*Rire rauque.* D'accord, tu m'as eue.",
      audace: "*Elle se mord la lèvre.* Enfin un homme qui ose.",
      sincere: "Oh, un petit chaton perdu. Ce n'est vraiment pas mon genre.",
      flambe: "L'argent, j'en vois passer tous les soirs, chéri.",
    },
    scenes: [
      "Scarlett attrape ta cravate et t'attire tout près. Son rouge à lèvres laisse une trace brûlante sur ton col. « Garde ça. Comme ça, tout le monde saura que tu es à moi ce soir. »",
      "Dans le couloir des loges, elle te plaque contre le mur. Son genou se glisse entre les tiens, sa bouche frôle la tienne sans jamais la toucher. « Pas encore. J'aime quand ils supplient. »",
      "À la fermeture, elle t'attend sur le trottoir, manteau ouvert sur la robe rouge. Un taxi. Sa main sur ta cuisse pendant tout le trajet. Sa porte claque derrière vous… et la robe rouge finit accrochée à la poignée. Le reste de la nuit ne regarde que vous deux.",
    ],
  },
  {
    id: "yuki",
    name: "Yuki",
    age: 26,
    tagline: "Timide… en apparence",
    emoji: "🌸",
    gradient: "from-pink-300 to-fuchsia-700",
    prefs: { charme: 1, humour: 2, audace: -2, sincere: 3, flambe: -1 },
    favoriteGift: "chocolats",
    difficulty: 1,
    intro: "*Elle joue nerveusement avec sa paille.* B-bonsoir… Je suis nouvelle ici. Sois gentil, d'accord ?",
    reactions: {
      charme: "*Elle rougit jusqu'aux oreilles.* T-tu dis ça à toutes les filles…",
      humour: "*Elle pouffe derrière sa main.* Tu es bête ! J'adore.",
      audace: "*Elle se recroqueville.* C'est… un peu trop direct, pour moi.",
      sincere: "*Elle te regarde enfin dans les yeux.* Merci d'être honnête. C'est rare, ici.",
      flambe: "Je… je ne suis pas là pour l'argent, tu sais.",
    },
    scenes: [
      "Yuki glisse un origami dans ta main : un petit cœur plié dans une serviette. Dessus, au stylo : « Tu es gentil. Reviens demain ? » Elle détourne les yeux, les joues en feu.",
      "Entre deux services, elle t'entraîne dans la réserve. Timidement, elle se hisse sur la pointe des pieds et t'embrasse. Puis encore. Beaucoup moins timidement. « Ne le dis à personne… »",
      "Yuki t'invite chez elle, un petit studio plein de plantes et de mangas. Elle éteint tout, sauf une guirlande lumineuse. « Je suis moins timide dans le noir », souffle-t-elle en défaisant lentement la ceinture de son kimono. Elle ne mentait pas.",
    ],
  },
  {
    id: "valentina",
    name: "Valentina",
    age: 33,
    tagline: "Salsa, rhum et tempérament de feu",
    emoji: "💃",
    gradient: "from-orange-400 to-red-700",
    prefs: { charme: 1, humour: 3, audace: 2, sincere: 0, flambe: -1 },
    favoriteGift: "parfum",
    difficulty: 1,
    intro: "*Elle s'installe à côté de toi en ondulant des hanches.* Hola, guapo. Tu sais danser, au moins ?",
    reactions: {
      charme: "Ay, qué lindo… mais j'ai déjà entendu mieux, cariño.",
      humour: "*Elle éclate de rire et te frappe l'épaule.* Tu es fou ! Encore !",
      audace: "*Ses yeux s'allument.* Mmh, tu joues avec le feu, gringo.",
      sincere: "C'est mignon. Un peu sérieux, mais mignon.",
      flambe: "Pff. Les hommes qui montrent leur argent cachent toujours quelque chose de petit.",
    },
    scenes: [
      "Valentina te tire sur la piste quand passe une salsa. Ses hanches épousent les tiennes, elle guide chacun de tes pas. « Tu danses mal. Mais tu apprends vite… surtout avec les mains. »",
      "Elle s'assoit sur tes genoux, face à toi, un bras autour de ton cou, et goûte le rhum sur tes lèvres. « Ce soir, je te laisse partir. La prochaine fois… non. »",
      "Chez Valentina, la musique ne s'arrête jamais. Elle danse pour toi seul, retirant ses bracelets un à un, puis tout le reste, avec la même lenteur torride. Les voisins frapperont au mur deux fois. Elle rira les deux fois.",
    ],
  },
  {
    id: "margaux",
    name: "Margaux",
    age: 31,
    tagline: "Ex-avocate, langue acérée",
    emoji: "👓",
    gradient: "from-slate-400 to-indigo-900",
    prefs: { charme: 0, humour: 3, audace: 1, sincere: 1, flambe: -2 },
    favoriteGift: "livre",
    difficulty: 1,
    intro: "*Elle referme son livre sans se presser.* Tu as trente secondes pour me convaincre que tu n'es pas ennuyeux. Top chrono.",
    reactions: {
      charme: "Compliment standard, niveau débutant. Tu peux mieux faire.",
      humour: "*Elle rit franchement.* Enfin quelqu'un qui a de l'esprit dans ce bar.",
      audace: "Direct. J'apprécie la clarté des intentions.",
      sincere: "Honnête. Objection rejetée, tu restes à ma table.",
      flambe: "Tu crois que je suis à vendre ? J'ai plaidé contre des types comme toi.",
    },
    scenes: [
      "Margaux retire ses lunettes et les pose sur ton nez. « Là. Maintenant tu vois le monde comme moi : flou, sauf toi. » Elle ne les reprend pas.",
      "« Contre-interrogatoire », annonce-t-elle en t'attirant dans un box isolé. Chaque question est plus indécente que la précédente. Chaque réponse est récompensée par un baiser. Tu perds le fil au bout de la troisième.",
      "Son appartement sent le vieux papier et le vin rouge. Elle t'allonge sur une pile de codes civils et déboutonne sa chemise avec la précision d'une plaidoirie. « Je déclare la séance… ouverte. » Verdict rendu à l'aube, à l'unanimité.",
    ],
  },
  {
    id: "jade",
    name: "Jade",
    age: 27,
    tagline: "Gameuse tatouée, zéro filtre",
    emoji: "🎮",
    gradient: "from-emerald-400 to-teal-900",
    prefs: { charme: -1, humour: 3, audace: 1, sincere: 2, flambe: 0 },
    favoriteGift: "jeu",
    difficulty: 1,
    intro: "*Elle lève à peine les yeux de son téléphone.* Attends, je finis ma game. …Voilà. Alors, t'es qui toi ?",
    reactions: {
      charme: "Beurk, les répliques de dragueur. J'ai failli recracher mon mojito.",
      humour: "*Elle tape du poing sur la table en riant.* GG, t'es drôle toi.",
      audace: "Oh, on passe en mode hardcore ? J'aime bien.",
      sincere: "T'es vrai, toi. Ça change des tryhards.",
      flambe: "Ok, t'as du fric. Tu veux un succès Steam ?",
    },
    scenes: [
      "Jade te montre ses tatouages. Le dragon sur son bras, la phrase sur sa clavicule… « Il y en a un dernier, mais faut débloquer le niveau suivant. » Clin d'œil.",
      "Sur la borne d'arcade du fond, elle te bat trois fois de suite. « Le perdant paie un gage. » Le gage se passe dans le photomaton. Les photos sont… floues. Très floues.",
      "Chez Jade : néons RGB, setup gaming, lit défait. Tu finis par découvrir le dernier tatouage — très bien placé, et largement mérité. « Achievement unlocked », rit-elle contre ta peau. Vous ne lancerez aucune partie cette nuit.",
    ],
  },
  {
    id: "ingrid",
    name: "Madame Ingrid",
    age: 38,
    tagline: "Glaciale, gantée de cuir",
    emoji: "🖤",
    gradient: "from-zinc-600 to-black",
    prefs: { charme: 1, humour: -1, audace: -2, sincere: 3, flambe: 1 },
    favoriteGift: "menottes",
    difficulty: 0.9,
    intro: "*Elle te détaille de haut en bas, lentement.* Assieds-toi. Non, pas là. Là. Bien. On va voir si tu sais obéir.",
    reactions: {
      charme: "Flatteur. Continue. À genoux, ce serait mieux.",
      humour: "*Regard glacial.* Est-ce que je t'ai autorisé à faire de l'esprit ?",
      audace: "Tu prends des initiatives ? Mauvais garçon. Très mauvais.",
      sincere: "*Un sourire fin.* Bien. J'aime qu'on m'obéisse et qu'on me dise la vérité.",
      flambe: "Un tribut. Tu apprends les usages.",
    },
    scenes: [
      "Ingrid glisse un doigt ganté sous ton menton et relève ton visage. « Tu as le droit de me regarder. Pour l'instant. » Tu n'as jamais eu aussi chaud à cause d'un gant.",
      "Elle te fait asseoir, se penche, et noue sa ceinture de soie autour de tes poignets, derrière la chaise. « Pas un geste jusqu'à la fermeture. » Tu tiens. Elle a l'air très satisfaite.",
      "Chez Ingrid, il y a des règles. Beaucoup. Elle te les murmure une à une, tout de cuir noir vêtue, une cravache à la main. Tu les respecteras toutes — ou presque, et elle adorera te punir pour celles que tu oublies.",
    ],
  },
  {
    id: "chloe",
    name: "Chloé",
    age: 24,
    tagline: "Étudiante aux Beaux-Arts, pétillante",
    emoji: "🎨",
    gradient: "from-yellow-300 to-pink-600",
    prefs: { charme: 3, humour: 2, audace: 0, sincere: 1, flambe: -1 },
    favoriteGift: "rose",
    difficulty: 1,
    intro: "*Elle a de la peinture sur le poignet et un sourire immense.* Coucou ! Oh, t'as un visage super intéressant. Je peux te dessiner ?",
    reactions: {
      charme: "*Elle papillonne des yeux.* Arrête, je vais fondre !",
      humour: "*Rire cristallin.* T'es trop con. J'adore !",
      audace: "Ooh, monsieur est entreprenant… Pourquoi pas.",
      sincere: "C'est touchant. Je vais vraiment te dessiner, toi.",
      flambe: "Ouais, bof. Mon coloc aussi a une Rolex. Fausse.",
    },
    scenes: [
      "Chloé griffonne ton portrait sur un sous-bock. Tu es plus beau dessiné par elle qu'en vrai. « Je te le donne si tu reviens poser. Pour de vrai. Dans mon atelier. »",
      "Dans son atelier, l'odeur de térébenthine. Elle t'enlève ta chemise « pour la lumière », puis te peint un cœur sur le torse du bout du pinceau. Le pinceau est froid. Ses lèvres, beaucoup moins.",
      "« À toi de poser », dit-elle — mais c'est elle qui laisse tomber sa robe sur le parquet taché de peinture. Tu ne sais pas dessiner. Elle te guide la main, trait par trait. La toile restera blanche. Personne ne s'en plaindra.",
    ],
  },
  {
    id: "nadia",
    name: "Nadia",
    age: 30,
    tagline: "Diamants, champagne et regard de braise",
    emoji: "💎",
    gradient: "from-amber-300 to-yellow-800",
    prefs: { charme: 2, humour: 0, audace: 1, sincere: -1, flambe: 3 },
    favoriteGift: "bijou",
    difficulty: 1,
    intro: "*Elle jette un œil à ta montre avant ton visage.* Mmh. Bonsoir, toi. Tu m'offres quelque chose de pétillant ?",
    reactions: {
      charme: "Jolis mots. Les mots, c'est bien. Les diamants, c'est mieux.",
      humour: "*Petit rire poli.* Mignon.",
      audace: "Oh… Toi, tu sais ce que tu veux. Moi aussi.",
      sincere: "Oh non, ne me fais pas le coup du cœur brisé, chéri.",
      flambe: "*Elle se colle à toi.* Voilà un langage que je comprends parfaitement.",
    },
    scenes: [
      "Nadia fait glisser ton verre vers elle et le finit d'un trait, sans te quitter des yeux. Ses bracelets d'or tintent quand elle pose la main sur ta nuque. « Tu as bon goût. Reste comme ça. »",
      "Dans le carré VIP, elle danse rien que pour toi, lentement, à portée de main — mais tu n'as pas le droit de toucher. « Les règles du VIP, chéri. Paie-moi l'after et on les change. »",
      "Suite présidentielle, vue sur la ville. Nadia ne porte que le collier que tu lui as offert et une coupe de champagne. « Tu m'as achetée ? Non. Tu m'as méritée. » Le room service frappera au matin. Personne n'ira ouvrir.",
    ],
  },
  {
    id: "rose",
    name: "Rose",
    age: 36,
    tagline: "Veuve mystérieuse, voix de velours",
    emoji: "🥀",
    gradient: "from-purple-400 to-violet-950",
    prefs: { charme: 2, humour: 0, audace: -1, sincere: 3, flambe: -1 },
    favoriteGift: "vinyle",
    difficulty: 1,
    intro: "*Elle allume une cigarette qu'elle ne fume pas.* Bonsoir. Tu as l'air de quelqu'un qui cherche quelque chose. Moi aussi, peut-être.",
    reactions: {
      charme: "*Sourire mélancolique.* Tu as la galanterie d'un autre temps.",
      humour: "*Un sourire poli.* Tu es drôle. Mon mari l'était aussi.",
      audace: "Doucement… Je ne suis pas de celles qu'on brusque.",
      sincere: "*Ses yeux brillent.* Ça faisait longtemps qu'on ne m'avait pas parlé comme ça.",
      flambe: "L'argent ne m'a jamais rien acheté qui compte.",
    },
    scenes: [
      "Rose te raconte le Paris d'avant, le jazz, les caves enfumées. Sa main gantée se pose sur la tienne et y reste. « Tu me rappelles que je suis vivante. »",
      "Elle pose un vinyle sur la vieille platine du bar. Un slow. Vous dansez joue contre joue, et elle te souffle : « Serre-moi plus fort. Personne ne l'a fait depuis des années. »",
      "Chez elle, dentelles et bougies. Elle défait sa longue chevelure, puis les agrafes de sa robe noire, une à une, sans quitter tes yeux. « Sois tendre. Puis ne le sois plus. » Au matin, elle chantonne dans la cuisine pour la première fois depuis longtemps.",
    ],
  },
  {
    id: "lola",
    name: "Mama Lola",
    age: 35,
    tagline: "La patronne. Personne ne l'a jamais eue.",
    emoji: "👑",
    gradient: "from-fuchsia-500 via-red-600 to-amber-500",
    prefs: { charme: 2, humour: 2, audace: 2, sincere: 2, flambe: 2 },
    favoriteGift: "whisky",
    difficulty: 0.7,
    unlockAfter: 9,
    intro: "*La salle se tait quand elle s'approche.* Alors c'est toi, le Casanova dont toutes mes filles parlent. Voyons si tu tiens la distance.",
    reactions: {
      charme: "Joli. Je l'ai entendue mille fois, mais tu la dis bien.",
      humour: "*Sourire en coin.* D'accord, tu as du répondant.",
      audace: "Tu oses draguer la patronne ? J'aime l'audace.",
      sincere: "Tu es sincère. C'est une denrée rare, dans mon établissement.",
      flambe: "Bien. J'aime les clients qui font tourner la maison.",
    },
    scenes: [
      "Mama Lola s'assoit à ta table — elle ne s'assoit jamais à une table. « Neuf de mes filles ont perdu la tête pour toi. Montre-moi ce qu'elles ont vu. »",
      "Elle t'emmène dans son bureau, au-dessus du bar. Deux whiskies. Elle s'assoit sur le bureau devant toi, jambes croisées, fendue de soie jusqu'à la hanche. « Personne ne monte ici. Tu es le premier depuis dix ans. »",
      "Lola baisse le rideau de fer du Velours Noir. Les néons s'éteignent un à un, sauf le rouge. Elle défait son chignon, dégrafe sa robe, et t'offre la seule chose qu'elle n'a jamais vendue dans ce bar. Cette nuit, tu es le roi du Velours Noir.",
    ],
  },
];

export const HOSTESS_BY_ID: Record<string, Hostess> = Object.fromEntries(HOSTESSES.map((h) => [h.id, h]));

export interface Topic {
  id: string;
  /** 0: Inconnue/Intriguée (<40), 1: Complice (40-69), 2: Troublée (70+). */
  tier: 0 | 1 | 2;
  line: string;
  answers: { style: Style; text: string }[];
}

export const TOPICS: Topic[] = [
  // ── Tier 0 ────────────────────────────────────────────────
  {
    id: "t0-first",
    tier: 0,
    line: "Alors, c'est ta première fois au Velours Noir ?",
    answers: [
      { style: "charme", text: "Première fois que je regrette de ne pas être venu plus tôt." },
      { style: "humour", text: "Non, je viens pour les cacahuètes. Elles sont divines." },
      { style: "sincere", text: "Oui. Honnêtement, je suis un peu intimidé." },
      { style: "flambe", text: "Première fois, mais je compte laisser une trace. Et un gros pourboire." },
    ],
  },
  {
    id: "t0-job",
    tier: 0,
    line: "Qu'est-ce que tu fais dans la vie, quand tu ne dragues pas les hôtesses ?",
    answers: [
      { style: "humour", text: "Testeur professionnel de matelas. C'est un métier exigeant." },
      { style: "audace", text: "Ce soir ? Je compte me consacrer à toi à plein temps." },
      { style: "sincere", text: "Un job banal. C'est pour ça que je viens chercher un peu de magie ici." },
      { style: "flambe", text: "Je gère des investissements. Disons que l'addition ne me fait pas peur." },
    ],
  },
  {
    id: "t0-look",
    tier: 0,
    line: "Tu me trouves comment, ce soir ?",
    answers: [
      { style: "charme", text: "Assez belle pour que j'oublie mon propre prénom." },
      { style: "audace", text: "Franchement ? Cette robe est un crime, et j'ai envie d'être complice." },
      { style: "humour", text: "Mieux que la déco. Et pourtant, j'adore le velours." },
      { style: "sincere", text: "Tu as l'air fatiguée, en vrai. Mais ça te va bien." },
    ],
  },
  {
    id: "t0-secret",
    tier: 0,
    line: "On joue à un jeu ? Dis-moi un secret.",
    answers: [
      { style: "audace", text: "Ça fait dix minutes que je lutte pour regarder tes yeux. Je perds." },
      { style: "humour", text: "Je chante du Céline Dion sous la douche. Très fort. Avec chorégraphie." },
      { style: "sincere", text: "Je suis venu ici parce que je me sentais seul." },
      { style: "charme", text: "Mon secret, c'est que je suis déjà un peu sous ton charme." },
    ],
  },
  {
    id: "t0-drink",
    tier: 0,
    line: "Tu m'offres un verre, ou tu comptes juste me regarder ?",
    answers: [
      { style: "flambe", text: "Un verre ? Barman ! La bouteille la plus chère. Pour elle." },
      { style: "humour", text: "Je comptais juste regarder, mais tu as de la chance : je suis généreux." },
      { style: "charme", text: "Te regarder, c'est déjà une ivresse. Mais va pour le verre." },
      { style: "audace", text: "Je t'offre ce que tu veux. Le verre, c'est pour commencer." },
    ],
  },
  {
    id: "t0-why",
    tier: 0,
    line: "Qu'est-ce qui t'a fait choisir ma table ?",
    answers: [
      { style: "charme", text: "Ton sourire. Il éclaire la salle mieux que les néons." },
      { style: "audace", text: "Tes jambes. Ensuite ton sourire. Je suis honnête." },
      { style: "sincere", text: "Tu avais l'air de t'ennuyer autant que moi." },
      { style: "humour", text: "C'était la seule table avec des bretzels." },
    ],
  },
  // ── Tier 1 ────────────────────────────────────────────────
  {
    id: "t1-kiss",
    tier: 1,
    line: "Tu embrasses bien, au moins ? …Je demande pour une amie.",
    answers: [
      { style: "audace", text: "Dis à ton amie de venir vérifier elle-même. Là, maintenant." },
      { style: "humour", text: "On me dit que je suis correct. Enfin, ma grand-mère le dit." },
      { style: "charme", text: "Je laisse les lèvres concernées juger. Jamais les amies." },
      { style: "sincere", text: "Aucune idée. Personne ne me l'a dit depuis longtemps." },
    ],
  },
  {
    id: "t1-hot",
    tier: 1,
    line: "Il fait chaud ici, non ? *Elle écarte doucement le col de sa robe.*",
    answers: [
      { style: "audace", text: "Continue comme ça et je demande qu'on monte le chauffage." },
      { style: "humour", text: "Je transpire depuis que je suis arrivé. Je pensais que c'était toi." },
      { style: "charme", text: "C'est toi qui fais monter la température. La clim n'y peut rien." },
      { style: "flambe", text: "Je t'offre un séjour à Bora-Bora. Là-bas aussi, il fait chaud." },
    ],
  },
  {
    id: "t1-where",
    tier: 1,
    line: "Si je te suivais ce soir, tu m'emmènerais où ?",
    answers: [
      { style: "flambe", text: "Suite au dernier étage d'un palace. Champagne dans la baignoire." },
      { style: "charme", text: "Sur un toit, sous les étoiles. Une couverture, et toi." },
      { style: "humour", text: "Au kebab. Puis chez moi. Dans cet ordre, c'est important." },
      { style: "sincere", text: "Je ne sais pas. Quelque part où on pourrait parler pour de vrai." },
    ],
  },
  {
    id: "t1-fantasy",
    tier: 1,
    line: "C'est quoi, ton fantasme à toi ?",
    answers: [
      { style: "audace", text: "Toi, cette robe par terre, et aucune règle du bar pour nous arrêter." },
      { style: "humour", text: "Une imprimante qui marche du premier coup. Et toi, en bonus." },
      { style: "sincere", text: "Me réveiller à côté de quelqu'un qui a envie de rester." },
      { style: "charme", text: "Découvrir ce que tu caches derrière ce sourire de professionnelle." },
    ],
  },
  {
    id: "t1-thigh",
    tier: 1,
    line: "*Elle pose sa main sur ta cuisse.* Ça te dérange ?",
    answers: [
      { style: "audace", text: "Ce qui me dérange, c'est qu'elle soit encore si loin." },
      { style: "humour", text: "Pas du tout. Par contre, mon cœur vient de faire une syncope." },
      { style: "charme", text: "Elle est exactement à sa place. Comme toi, à côté de moi." },
      { style: "sincere", text: "Non… Mais je t'avoue que ça me fait un effet fou." },
    ],
  },
  {
    id: "t1-love",
    tier: 1,
    line: "On dit que les clients tombent souvent amoureux des hôtesses. Tu es comme ça ?",
    answers: [
      { style: "sincere", text: "Peut-être. Et je ne suis pas sûr d'avoir envie de me protéger." },
      { style: "humour", text: "Moi ? Jamais. Je suis juste amoureux de ton parfum. Et de ta voix. Et…" },
      { style: "flambe", text: "Je ne tombe pas amoureux, j'investis. Je plaisante. À moitié." },
      { style: "charme", text: "Je ne tombe pas. Je glisse, doucement. Et tu me tends la main." },
    ],
  },
  // ── Tier 2 ────────────────────────────────────────────────
  {
    id: "t2-alone",
    tier: 2,
    line: "*Elle te murmure à l'oreille.* Qu'est-ce que tu me ferais, si on était seuls ?",
    answers: [
      { style: "audace", text: "Je commencerais par ta nuque. Et je prendrais tout mon temps pour descendre." },
      { style: "charme", text: "Je te ferais oublier l'heure, le bar, et jusqu'à ton nom de scène." },
      { style: "humour", text: "Un Scrabble endiablé. Mot compte triple : « déshabillée »." },
      { style: "sincere", text: "Je te demanderais ce que toi, tu veux. Et je t'écouterais." },
    ],
  },
  {
    id: "t2-under",
    tier: 2,
    line: "J'ai retiré quelque chose sous ma robe pendant que tu étais aux toilettes. Devine quoi.",
    answers: [
      { style: "audace", text: "Donne-moi un indice… ou laisse-moi vérifier." },
      { style: "humour", text: "Ta dignité ? Non, pardon. Je sors." },
      { style: "charme", text: "Je ne devine pas. Je préfère que tu me le montres plus tard." },
      { style: "flambe", text: "Peu importe, je t'en rachète dix. En soie." },
    ],
  },
  {
    id: "t2-rules",
    tier: 2,
    line: "Tu sais que c'est interdit de toucher les hôtesses, ici ?",
    answers: [
      { style: "audace", text: "Alors on va devoir enfreindre le règlement. Discrètement." },
      { style: "charme", text: "Je sais. C'est pour ça que je te dévore des yeux à la place." },
      { style: "sincere", text: "Je respecte les règles. Mais j'attends la fermeture avec impatience." },
      { style: "humour", text: "Je peux toucher ton verre ? C'est déjà très osé pour moi." },
    ],
  },
  {
    id: "t2-legs",
    tier: 2,
    line: "*Elle croise lentement les jambes.* Tu regardes où, là ?",
    answers: [
      { style: "audace", text: "Exactement là où tu voulais que je regarde." },
      { style: "humour", text: "Moi ? Le plafond. Magnifiques moulures. Très… galbées." },
      { style: "charme", text: "Je regardais le chemin. J'aimerais bien l'emprunter un jour." },
      { style: "sincere", text: "Pardon, j'ai du mal à me concentrer. Tu es vraiment trop belle." },
    ],
  },
  {
    id: "t2-lodge",
    tier: 2,
    line: "Ma loge ferme à clé, tu sais…",
    answers: [
      { style: "audace", text: "Alors qu'est-ce qu'on attend ? Donne-moi la clé." },
      { style: "charme", text: "Une clé, une porte, et toi derrière. Le plus beau des coffres-forts." },
      { style: "humour", text: "Je suis claustrophobe. Mais pour toi, je veux bien faire un effort." },
      { style: "flambe", text: "Je privatise la loge. Et le bar. Et la rue, si tu veux." },
    ],
  },
  {
    id: "t2-woman",
    tier: 2,
    line: "Tu ne m'as toujours pas dit ce que tu aimais chez une femme.",
    answers: [
      { style: "sincere", text: "Qu'elle me regarde comme tu me regardes, là." },
      { style: "audace", text: "Sa façon de soupirer mon prénom. Tu veux essayer ?" },
      { style: "charme", text: "Qu'elle me rende fou rien qu'en respirant. Tu y arrives très bien." },
      { style: "humour", text: "Qu'elle rie à mes blagues nulles. Tu as une longueur d'avance." },
    ],
  },
];

/** The risky "geste" action, one flavor per tier. */
export const MOVES: Record<0 | 1 | 2, { label: string; success: string; fail: string }> = {
  0: {
    label: "Frôler sa main",
    success: "*Elle ne retire pas sa main. Au contraire, ses doigts s'entrelacent aux tiens.*",
    fail: "*Elle retire sa main d'un geste sec.* On se calme, cowboy.",
  },
  1: {
    label: "Main sur sa cuisse",
    success: "*Elle frissonne et pose sa main sur la tienne… pour la remonter un peu.*",
    fail: "*CLAC.* La gifle résonne dans tout le bar. Le videur te regarde.",
  },
  2: {
    label: "L'embrasser dans le cou",
    success: "*Un soupir lui échappe. Elle incline la tête pour t'offrir plus de peau.* Encore…",
    fail: "*Elle te repousse, les joues rouges.* Pas ici, idiot ! Tout le monde regarde !",
  },
};

export const DRINKS = [
  { id: "coupe", label: "Offrir une coupe", icon: "🥂", price: 40, base: 3, flambeWeight: 1 },
  { id: "champagne", label: "Bouteille de champagne", icon: "🍾", price: 250, base: 9, flambeWeight: 3 },
] as const;

export function affectionTier(affection: number): 0 | 1 | 2 {
  if (affection >= MILESTONES[1]) return 2;
  if (affection >= MILESTONES[0]) return 1;
  return 0;
}

export function affectionLabel(affection: number, conquered: boolean): string {
  if (conquered) return "Conquise 💘";
  if (affection >= CONQUEST_THRESHOLD) return "Prête pour l'after 🔥";
  if (affection >= MILESTONES[1]) return "Troublée";
  if (affection >= MILESTONES[0]) return "Complice";
  if (affection >= 15) return "Intriguée";
  return "Inconnue";
}
