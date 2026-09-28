"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/api/client";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { BrandMark } from "@/components/BrandMark";
import { EmberField } from "@/components/EmberField";
import { inputClass } from "@/components/Field";
import { focusRing } from "@/lib/ui/a11y";
import { PROLOGUE, PROLOGUE_TITLE, TOUR_SLIDES } from "@/lib/game/content/lore";
import { cleanPlayerName, playerNameError, PLAYER_NAME_MAX } from "@/lib/game/playerName";
import type { UserProfile } from "@/types/game";

type Step = { kind: "prologue" } | { kind: "tour"; index: number } | { kind: "name" };

/** Seconds between two prologue paragraphs appearing (a reading pace, not a list stagger). */
const PARAGRAPH_STAGGER = 1.6;

const quietLinkClass = `rounded text-xs text-fg-subtle transition-colors duration-150 hover:text-fg-muted ${focusRing}`;

function StepDots({ step }: { step: Step }) {
  const total = 1 + TOUR_SLIDES.length + 1;
  const current = step.kind === "prologue" ? 0 : step.kind === "tour" ? 1 + step.index : total - 1;
  return (
    <div className="flex justify-center gap-1.5" aria-label={`Étape ${current + 1} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out ${
            i === current ? "w-6 bg-gold" : i < current ? "w-1.5 bg-gold/45" : "w-1.5 bg-white/15"
          }`}
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
    <button type="button" onClick={() => setStep({ kind: "name" })} className={quietLinkClass}>
      Passer l&apos;introduction
    </button>
  );

  const nameMessageIsError = Boolean((touched && nameError) || serverError);

  return (
    <div className="relative flex min-h-[100svh] flex-1 flex-col items-center justify-center px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <EmberField />
      <div className="relative z-10 flex w-full flex-col items-center gap-8">
        <BrandMark size="lg" />

        {step.kind === "prologue" && (
          <Card accent="gold" textured className="w-full max-w-2xl">
            <div className="space-y-6 sm:p-3">
              <h1 className="animate-rise text-center font-display text-2xl font-semibold leading-tight text-fg sm:text-3xl">
                {PROLOGUE_TITLE}
              </h1>
              <div className="space-y-4 text-[15px] leading-7 text-fg-muted sm:text-base sm:leading-7">
                {PROLOGUE.map((paragraph, i) => (
                  <p
                    key={i}
                    className={`animate-rise ${i === PROLOGUE.length - 1 ? "font-medium text-gold" : ""}`}
                    style={{ "--delay": `${0.3 + i * PARAGRAPH_STAGGER}s` } as React.CSSProperties}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
              <div
                className="animate-rise flex flex-col items-center pt-1"
                style={{ "--delay": `${0.3 + PROLOGUE.length * PARAGRAPH_STAGGER}s` } as React.CSSProperties}
              >
                <Button
                  size="lg"
                  className="w-full sm:w-auto sm:min-w-48"
                  onClick={() => setStep({ kind: "tour", index: 0 })}
                >
                  Prêter serment
                </Button>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
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
                <div key={step.index} className="space-y-6 sm:p-3">
                  <div className="animate-rise space-y-3 text-center">
                    <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-gold/25 bg-gold/[0.06] text-2xl shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]">
                      {slide.iconName ? (
                        <Icon name={slide.iconName} className="h-8 w-8" />
                      ) : (
                        <span aria-hidden>{slide.icon}</span>
                      )}
                    </div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold/80 tabular-nums">
                      Comment jouer · {step.index + 1}/{TOUR_SLIDES.length}
                    </p>
                    <h2 className="text-xl font-semibold text-fg">{slide.title}</h2>
                    <p className="text-sm leading-relaxed text-fg-muted">{slide.text}</p>
                    <p className="text-xs text-fg-subtle">{slide.where}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="flex-1"
                      onClick={() =>
                        setStep(step.index === 0 ? { kind: "prologue" } : { kind: "tour", index: step.index - 1 })
                      }
                    >
                      Retour
                    </Button>
                    <Button
                      size="lg"
                      className="flex-1"
                      onClick={() => setStep(isLast ? { kind: "name" } : { kind: "tour", index: step.index + 1 })}
                    >
                      {isLast ? "Choisir mon nom" : "Suivant"}
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
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
            <form onSubmit={submitName} className="animate-rise space-y-6 sm:p-3">
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold text-fg">Ton nom de Gardien</h2>
                <p className="text-sm leading-relaxed text-fg-muted">
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
                  autoComplete="nickname"
                  spellCheck={false}
                  className={`${inputClass} text-center text-lg`}
                />
                <p
                  aria-live="polite"
                  className={`min-h-5 text-center text-xs tabular-nums ${
                    nameMessageIsError ? "text-red-300" : "text-fg-subtle"
                  }`}
                >
                  {serverError ?? (touched ? nameError : null) ?? `${cleaned.length}/${PLAYER_NAME_MAX} caractères`}
                </p>
              </div>
              <Button type="submit" size="lg" disabled={submitting || (touched && !!nameError)} className="w-full">
                {submitting ? "Serment en cours..." : "Entrer dans le donjon"}
              </Button>
              <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
                <StepDots step={step} />
                <button
                  type="button"
                  onClick={() => setStep({ kind: "tour", index: TOUR_SLIDES.length - 1 })}
                  className={quietLinkClass}
                >
                  Revoir la présentation
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
