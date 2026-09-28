const EMBERS = [
  { left: "8%", size: 2, duration: 15, delay: 0, drift: 8, opacity: 0.45 },
  { left: "21%", size: 3, duration: 19, delay: 3, drift: -6, opacity: 0.35 },
  { left: "37%", size: 2, duration: 16, delay: 7, drift: 10, opacity: 0.5 },
  { left: "54%", size: 2, duration: 14, delay: 1.5, drift: -10, opacity: 0.4 },
  { left: "69%", size: 3, duration: 18, delay: 5, drift: 6, opacity: 0.35 },
  { left: "83%", size: 2, duration: 17, delay: 9, drift: -8, opacity: 0.45 },
  { left: "94%", size: 2, duration: 20, delay: 4, drift: 6, opacity: 0.4 },
] as const;

/** Decorative floating embers, reserved for rare screens (auth, onboarding).
    Positions/timings are hardcoded (not Math.random()) so SSR and client match. */
export function EmberField() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {EMBERS.map((ember, i) => (
        <span
          key={i}
          className="ember"
          style={
            {
              left: ember.left,
              "--ember-size": `${ember.size}px`,
              "--ember-duration": `${ember.duration}s`,
              "--ember-delay": `${ember.delay}s`,
              "--ember-drift": `${ember.drift}px`,
              "--ember-opacity": ember.opacity,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
