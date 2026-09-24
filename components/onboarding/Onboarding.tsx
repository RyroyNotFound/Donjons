"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/api/client";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { inputClass } from "@/components/Field";
import { PROLOGUE, PROLOGUE_TITLE, TOUR_SLIDES } from "@/lib/game/content/lore";
import { cleanPlayerName, playerNameError, PLAYER_NAME_MAX } from "@/lib/game/playerName";
import type { UserProfile } from "@/types/game";

type Step = { kind: "prologue" } | { kind: "tour"; index: number } | { kind: "name" };

/** Seconds between two prologue paragraphs appearing. */
const PARAGRAPH_STAGGER = 1.6;

function StepDots({ step }: { step: Step }) {
  const total = 1 + TOUR_SLIDES.length + 1;
  const current = step.kind === "prologue" ? 0 : step.kind === "tour" ? 1 + step.index : total - 1;
  return (
    <div className="flex justify-center gap-1.5" aria-label={`Étape ${current + 1} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-1.5 rounded-full transition-all ${i === current ? "w-6 bg-amber-400" : i < current ? "w-1.5 bg-amber-400/50" : "w-1.5 bg-white/15"}`}
        />
      ))}
    </div>
  );
}

/** First-login intro: story prologue → short game presentation → name choice. Blocks the game until a name is set. */
export function Onboarding({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "prologue" });
  // Existing players already renamed keep their name prefilled; the auto-generated one is not worth keeping.
  const [name, setName] = useState(profile.displayNameKey ? profile.displayName : "");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cleaned = cleanPlayerName(name);
  const nameError = playerNameError(cleaned);

  async function submitName(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (nameError) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await callApi("/api/profile/onboarding", { displayName: cleaned });
      router.push("/tableau-de-bord");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Impossible d'enregistrer le pseudo.");
      setSubmitting(false);
    }
  }

  const skipToName = (
    <button
      type="button"
      onClick={() => setStep({ kind: "name" })}
      className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
    >
      Passer l&apos;introduction
    </button>
  );

  return (
    <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <p className="font-display text-gold-gradient text-2xl font-bold tracking-wide">⚔️ Donjons</p>

      {step.kind === "prologue" && (
        <Card accent="gold" textured className="w-full max-w-2xl">
          <div className="space-y-5 sm:p-3">
            <h1 className="font-display text-glow-gold text-center text-2xl font-bold sm:text-3xl">{PROLOGUE_TITLE}</h1>
            <div className="space-y-4 font-display text-[15px] leading-relaxed text-slate-200 sm:text-base">
              {PROLOGUE.map((paragraph, i) => (
                <p
                  key={i}
                  className={`animate-rise ${i === PROLOGUE.length - 1 ? "font-semibold text-amber-200" : ""}`}
                  style={{ "--delay": `${0.3 + i * PARAGRAPH_STAGGER}s` } as React.CSSProperties}
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <div
              className="animate-rise flex flex-col items-center gap-3 pt-2"
              style={{ "--delay": `${0.3 + PROLOGUE.length * PARAGRAPH_STAGGER}s` } as React.CSSProperties}
            >
              <Button onClick={() => setStep({ kind: "tour", index: 0 })}>Prêter serment</Button>
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              <StepDots step={step} />
              {skipToName}
            </div>
          </div>
        </Card>
      )}

      {step.kind === "tour" && (
        <Card accent="gold" className="w-full max-w-lg">
          {(() => {
            const slide = TOUR_SLIDES[step.index];
            const isLast = step.index === TOUR_SLIDES.length - 1;
            return (
              <div key={step.index} className="space-y-5 sm:p-3">
                <div className="animate-rise space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-3xl">
                    {slide.iconName ? <Icon name={slide.iconName} className="h-9 w-9" /> : <span aria-hidden>{slide.icon}</span>}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/80">
                    Comment jouer · {step.index + 1}/{TOUR_SLIDES.length}
                  </p>
                  <h2 className="font-display text-2xl font-bold text-slate-50">{slide.title}</h2>
                  <p className="text-sm leading-relaxed text-slate-300">{slide.text}</p>
                  <p className="text-xs text-slate-500">{slide.where}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setStep(step.index === 0 ? { kind: "prologue" } : { kind: "tour", index: step.index - 1 })}
                  >
                    Retour
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => setStep(isLast ? { kind: "name" } : { kind: "tour", index: step.index + 1 })}
                  >
                    {isLast ? "Choisir mon nom" : "Suivant"}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <StepDots step={step} />
                  {!isLast && skipToName}
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {step.kind === "name" && (
        <Card accent="gold" className="w-full max-w-md">
          <form onSubmit={submitName} className="animate-rise space-y-5 sm:p-3">
            <div className="space-y-2 text-center">
              <h2 className="font-display text-2xl font-bold text-slate-50">Ton nom de Gardien</h2>
              <p className="text-sm text-slate-400">
                C&apos;est sous ce nom que les autres Gardiens te verront au classement et lors des raids.
              </p>
            </div>
            <div className="space-y-1.5">
              <input
                autoFocus
                value={name}
                maxLength={PLAYER_NAME_MAX + 4}
                onChange={(e) => {
                  setName(e.target.value);
                  setServerError(null);
                }}
                onBlur={() => setTouched(true)}
                placeholder="Ex. Morgane la Rouge"
                aria-label="Pseudo"
                aria-invalid={touched && !!nameError}
                className={`${inputClass} text-center text-lg`}
              />
              <p className={`min-h-5 text-center text-xs ${(touched && nameError) || serverError ? "text-red-400" : "text-slate-500"}`}>
                {serverError ?? (touched ? nameError : null) ?? `${cleaned.length}/${PLAYER_NAME_MAX} caractères`}
              </p>
            </div>
            <Button type="submit" disabled={submitting || (touched && !!nameError)} className="w-full">
              {submitting ? "Serment en cours..." : "Entrer dans le donjon"}
            </Button>
            <div className="flex items-center justify-between gap-3">
              <StepDots step={step} />
              <button
                type="button"
                onClick={() => setStep({ kind: "tour", index: TOUR_SLIDES.length - 1 })}
                className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
              >
                Revoir la présentation
              </button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
