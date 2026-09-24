"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useGameData } from "@/lib/game/GameDataProvider";
import { callApi } from "@/lib/api/client";
import { COSMETIC_THEMES, TAVERN_NPCS } from "@/lib/game/content/tavern";
import { getRecipe } from "@/lib/game/content/recipes";
import {
  canAffordOffer,
  currentTavernSlot,
  formatTavernAmount,
  offerBlockedReason,
  slotEndsAt,
  tavernNpcFor,
  tavernStateFor,
} from "@/lib/game/tavern";
import { RARITY_LABEL } from "@/lib/ui/rarity";
import { Card, type CardAccent } from "@/components/Card";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { PageTransition } from "@/components/PageTransition";
import { Panel } from "@/components/Panel";
import { Spinner } from "@/components/Spinner";
import type { Item, TavernNpc, TavernNpcKind, TavernNpcRarity, TavernOffer, TavernReward, UserProfile } from "@/types/game";

const KIND_LABEL: Record<TavernNpcKind, string> = {
  marchand: "🪙 Marchand",
  conteur: "📖 Conteur",
  bienfaiteur: "🎁 Bienfaiteur",
  parieur: "🎲 Parieur",
};

const NPC_RARITY_LABEL: Record<TavernNpcRarity, string> = {
  commun: "Habitué",
  rare: "Visiteur rare",
  legendaire: "Légende",
};

const NPC_RARITY_TONE: Record<TavernNpcRarity, BadgeTone> = { commun: "commun", rare: "rare", legendaire: "legendaire" };
const NPC_RARITY_ACCENT: Record<TavernNpcRarity, CardAccent> = { commun: "gold", rare: "rare", legendaire: "legendaire" };

function formatReward(reward: TavernReward): string {
  const parts = [formatTavernAmount(reward)].filter(Boolean);
  if (reward.randomItem) parts.push("un objet au hasard");
  if (reward.cosmeticThemeId) {
    const theme = COSMETIC_THEMES.find((t) => t.id === reward.cosmeticThemeId);
    parts.push(`thème « ${theme?.name ?? reward.cosmeticThemeId} » (temporaire)`);
  }
  if (reward.item) {
    const recipe = getRecipe(reward.item.recipeId);
    parts.push(reward.item.rarity ? `${recipe.result.name} (${RARITY_LABEL[reward.item.rarity]})` : recipe.result.name);
  }
  return parts.join(", ");
}

/** Le Magnifique: whatever you pick, you get something else. */
function pickOtherTheme(requestedId: string) {
  const others = COSMETIC_THEMES.filter((t) => t.id !== requestedId);
  return others[Math.floor(Math.random() * others.length)];
}

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function TavernPage() {
  const { user } = useAuth();
  const { profile } = useGameData();
  const now = useNow(1000);
  const slot = currentTavernSlot(now);
  const uid = user?.uid;

  // Record the visitor in the codex whenever a new one walks in.
  useEffect(() => {
    if (uid) callApi("/api/tavern/visit").catch(console.error);
  }, [uid, slot]);

  if (!uid || !profile) return <Spinner label="Chargement de la taverne..." />;

  const npc = tavernNpcFor(uid, slot);
  const state = tavernStateFor(profile, slot);

  return (
    <TavernView
      npc={npc}
      slot={slot}
      now={now}
      profile={profile}
      claimedOfferIds={state.claimedOfferIds}
      metNpcIds={state.metNpcIds}
    />
  );
}

function TavernView({
  npc,
  slot,
  now,
  profile,
  claimedOfferIds,
  metNpcIds,
}: {
  npc: TavernNpc;
  slot: number;
  now: number;
  profile: UserProfile;
  claimedOfferIds: string[];
  metNpcIds: string[];
}) {
  // Le Magnifique's theme: a filter on the whole document, removed as soon as the page unmounts.
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  useEffect(() => {
    const root = document.documentElement;
    root.style.filter = themeFilter ?? "";
    return () => {
      root.style.filter = "";
    };
  }, [themeFilter]);

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Taverne du Chope-Fendue"
          subtitle="Un nouveau visiteur s'installe au comptoir toutes les 30 minutes."
          action={
            <Badge tone="gold" className="text-sm">
              ⏳ Prochain visiteur dans {formatCountdown(slotEndsAt(slot) - now)}
            </Badge>
          }
        />
        <VisitorCard
          key={`${npc.id}-${slot}`}
          npc={npc}
          slot={slot}
          profile={profile}
          claimedOfferIds={claimedOfferIds}
          onTheme={setThemeFilter}
        />
        <Codex metNpcIds={metNpcIds} />
      </div>
    </PageTransition>
  );
}

function VisitorCard({
  npc,
  slot,
  profile,
  claimedOfferIds,
  onTheme,
}: {
  npc: TavernNpc;
  slot: number;
  profile: UserProfile;
  claimedOfferIds: string[];
  onTheme: (filter: string) => void;
}) {
  const [storyStep, setStoryStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "success" | "danger" } | null>(null);

  const story = npc.story ?? [];
  const storyAtEnd = storyStep >= story.length;
  const showOffers = (npc.offers?.length ?? 0) > 0 && storyAtEnd;

  async function take(offer: TavernOffer) {
    setBusy(offer.id);
    setMessage(null);
    try {
      const res = await callApi<{ won: boolean; item: Item | null; paidGold: number | null }>("/api/tavern/interact", {
        slot,
        offerId: offer.id,
      });
      const gained = res.item ? `${res.item.name} (${RARITY_LABEL[res.item.rarity]})` : formatReward(offer.reward);
      if (offer.reward.cosmeticThemeId) {
        const theme = pickOtherTheme(offer.reward.cosmeticThemeId);
        onTheme(theme.filter);
        setMessage({
          text: `« Magnifique ! » Vous vouliez ${offer.label}… vous obtenez « ${theme.name} ». Ni repris, ni échangé. Ça partira quand vous quitterez la taverne.`,
          tone: "success",
        });
      } else if (res.paidGold !== null) {
        setMessage({ text: `Dieu accepte ton offrande de ${res.paidGold} or. En retour : ${gained}.`, tone: "success" });
      } else if (offer.winChance === undefined) setMessage({ text: `Obtenu : ${gained}.`, tone: "success" });
      else if (res.won) setMessage({ text: `${npc.winLine ?? "Gagné !"} — ${gained}.`, tone: "success" });
      else setMessage({ text: npc.loseLine ?? "Perdu !", tone: "danger" });
    } catch (e) {
      setMessage({ text: (e as Error).message, tone: "danger" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card accent={NPC_RARITY_ACCENT[npc.rarity]} textured>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2 sm:w-40">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border border-amber-500/30 bg-black/30 text-6xl shadow-inner">
            <span aria-hidden>{npc.portrait}</span>
          </div>
          <Badge tone={NPC_RARITY_TONE[npc.rarity]}>{NPC_RARITY_LABEL[npc.rarity]}</Badge>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="font-display text-xl font-semibold text-slate-50">{npc.name}</p>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {npc.title} · {KIND_LABEL[npc.kind]}
            </p>
          </div>

          <Panel tone="highlight">
            <p className="text-sm italic text-amber-100">« {npc.greeting} »</p>
          </Panel>

          {story.length > 0 && (
            <div className="space-y-3">
              {story.slice(0, storyStep).map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-300">
                  {paragraph}
                </p>
              ))}
              {(!storyAtEnd || npc.storyLoops) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setStoryStep((s) => (s >= story.length ? 1 : s + 1))}
                >
                  {storyStep === 0 ? "Écouter l'histoire" : "Continuer…"}
                </Button>
              )}
              {storyAtEnd && !npc.storyLoops && <p className="text-xs text-slate-500">— Fin de l&apos;histoire —</p>}
            </div>
          )}

          {showOffers && (
            <div className="space-y-2">
              {npc.offerMode === "pickOne" && npc.offers!.length > 1 && (
                <p className="text-xs text-slate-400">Un seul choix possible.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {npc.offers!.map((offer) => {
                  const blocked = offerBlockedReason(npc, offer, claimedOfferIds);
                  const affordable = canAffordOffer(profile, offer);
                  return (
                    <Panel key={offer.id} tone={claimedOfferIds.includes(offer.id) ? "owned" : "neutral"} dim={!!blocked && !claimedOfferIds.includes(offer.id)}>
                      <p className="font-semibold text-slate-100">{offer.label}</p>
                      {offer.description && <p className="text-xs text-slate-400">{offer.description}</p>}
                      <p className="mt-1 text-xs text-emerald-300">
                        {offer.winChance !== undefined ? `Gain (${Math.round(offer.winChance * 100)} %) : ` : "Reçu : "}
                        {formatReward(offer.reward)}
                      </p>
                      {offer.randomGoldCost && (
                        <p className={`text-xs ${affordable ? "text-amber-300" : "text-red-400"}`}>Prix : ??? or</p>
                      )}
                      {offer.cost && (
                        <p className={`text-xs ${affordable ? "text-amber-300" : "text-red-400"}`}>
                          {offer.winChance !== undefined ? "Mise" : "Prix"} : {formatTavernAmount(offer.cost)}
                        </p>
                      )}
                      <Button
                        size="sm"
                        className="mt-2"
                        disabled={!!blocked || !affordable || busy !== null}
                        onClick={() => take(offer)}
                      >
                        {blocked ?? (busy === offer.id ? "..." : actionLabel(npc.kind))}
                      </Button>
                    </Panel>
                  );
                })}
              </div>
            </div>
          )}

          {message && (
            <p className={`text-sm ${message.tone === "success" ? "text-emerald-300" : "text-red-400"}`}>{message.text}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function actionLabel(kind: TavernNpcKind): string {
  if (kind === "marchand") return "Acheter";
  if (kind === "parieur") return "Parier";
  return "Accepter";
}

function Codex({ metNpcIds }: { metNpcIds: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = TAVERN_NPCS.find((npc) => npc.id === openId && metNpcIds.includes(npc.id));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-slate-50">Registre des visiteurs</h2>
        <p className="text-xs text-slate-500">
          {metNpcIds.length} / {TAVERN_NPCS.length} rencontrés
        </p>
      </div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-9 lg:grid-cols-12">
        {TAVERN_NPCS.map((npc) => {
          const met = metNpcIds.includes(npc.id);
          return (
            <button
              key={npc.id}
              type="button"
              disabled={!met}
              onClick={() => setOpenId(openId === npc.id ? null : npc.id)}
              title={met ? `${npc.name} — ${npc.title}` : "Inconnu"}
              className={`flex aspect-square items-center justify-center rounded-lg border text-2xl transition ${
                openId === npc.id
                  ? "border-amber-500 bg-amber-500/20"
                  : met
                    ? "border-white/10 bg-white/5 hover:bg-white/10"
                    : "border-white/5 bg-black/30 text-slate-600"
              }`}
            >
              {met ? npc.portrait : "?"}
            </button>
          );
        })}
      </div>
      {open && (
        <Panel>
          <p className="font-semibold text-slate-100">
            {open.portrait} {open.name} <span className="text-xs font-normal text-slate-500">· {open.title} · {KIND_LABEL[open.kind]}</span>
          </p>
          <p className="mt-1 text-sm italic text-amber-100">« {open.greeting} »</p>
          {open.story?.map((paragraph, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-slate-300">
              {paragraph}
            </p>
          ))}
        </Panel>
      )}
    </section>
  );
}
