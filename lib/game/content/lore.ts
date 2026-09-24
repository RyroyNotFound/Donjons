import { STARTING_CRYSTALS } from "@/lib/game/economy";
import type { IconName } from "@/lib/ui/icons";

/** First-login prologue (components/onboarding/Onboarding.tsx), shown one paragraph at a time. */
export const PROLOGUE_TITLE = "L'Astre brisé";

export const PROLOGUE: string[] = [
  "Autrefois, un astre veillait sur le royaume d'Aldhaven. Les anciens l'appelaient le Cœur-d'Étoile : sa lumière gardait vivants les savoirs des héros — l'art des armes, les sorts, les serments.",
  "Puis vint le Seigneur des ombres. Du fond de sa Nécropole, il éteignit le Cœur-d'Étoile et le fit voler en éclats. Les héros oublièrent leurs arts, et les royaumes tombèrent un à un.",
  "Mais les éclats ne sont pas morts. Ces cristaux, semés de la Lisière aux Ruines oubliées, gardent chacun un fragment du savoir perdu. Qui les rassemble peut rappeler une classe oubliée, un sort, un talent… et réveiller ce qui dort chez une simple recrue.",
  "Les survivants ont bâti des donjons pour protéger leurs éclats. On les appelle les Gardiens. Tous rêvent de rallumer le Cœur-d'Étoile — et aucun n'a l'intention de partager.",
  `Tu es le dernier à prêter serment. Un donjon vide, une recrue qui ne sait encore rien, ${STARTING_CRYSTALS} éclats au creux de la main. Le reste, il faudra le prendre.`,
];

export interface TourSlide {
  icon: string;
  iconName?: IconName;
  title: string;
  text: string;
  /** Where to find it in the menu, shown as a hint under the text. */
  where: string;
}

/** The "how to play" mini-presentation that follows the prologue. */
export const TOUR_SLIDES: TourSlide[] = [
  {
    icon: "🔮",
    title: "Réveille tes héros",
    text: "Ta recrue commence sans classe ni pouvoir. Dépense tes cristaux à l'Invocation pour obtenir des classes, des sorts, des talents et des maîtrises, puis équipe-les librement : rien n'est consommé, tu peux tout changer à tout moment.",
    where: "Menu Héros → Mes héros · Invocation",
  },
  {
    icon: "🗺️",
    iconName: "scroll",
    title: "Pars en expédition",
    text: "Des combats de moins d'une minute en temps réel : dirige ton équipe, choisis un bonus à chaque montée de niveau et abats le boss. Tu en reviens avec de l'or, des ressources, des objets et des cristaux. Quatre zones t'attendent, de la Lisière jusqu'à la Nécropole.",
    where: "Menu Aventure → Expéditions",
  },
  {
    icon: "🛡️",
    iconName: "shield",
    title: "Bâtis ton donjon",
    text: "Place tes salles, tes pièges, les monstres que tu as capturés et des héros en garnison. D'autres Gardiens viendront le piller pendant ton absence : améliore-le pour qu'il tienne.",
    where: "Menu Donjon → Mon donjon · Améliorations",
  },
  {
    icon: "⚔️",
    iconName: "sword",
    title: "Pille tes rivaux",
    text: "Lance des raids au tour par tour sur les donjons des autres joueurs et sur les bastions des lieutenants de l'ombre. Chaque conquête rapporte du butin et des cristaux, et te fait grimper au classement.",
    where: "Menu Donjon → Attaquer · Social → Classement",
  },
  {
    icon: "🔨",
    title: "Forge et taverne",
    text: "Transforme tes ressources en équipement à la Forge, et passe à la Taverne : chaque jour, des marchands de passage y proposent leurs affaires.",
    where: "Menu Héros → Forge · Aventure → Taverne",
  },
];
