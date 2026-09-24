const EMBERS = [
  { left: "4%", size: 2, duration: 13, delay: 0, drift: 8, opacity: 0.5 },
  { left: "11%", size: 3, duration: 17, delay: 2.5, drift: -6, opacity: 0.4 },
  { left: "18%", size: 2, duration: 15, delay: 6, drift: 10, opacity: 0.55 },
  { left: "26%", size: 4, duration: 19, delay: 1, drift: -12, opacity: 0.35 },
  { left: "34%", size: 2, duration: 14, delay: 8, drift: 6, opacity: 0.5 },
  { left: "42%", size: 3, duration: 18, delay: 4, drift: -8, opacity: 0.4 },
  { left: "50%", size: 2, duration: 12, delay: 10, drift: 12, opacity: 0.55 },
  { left: "58%", size: 3, duration: 16, delay: 3, drift: -10, opacity: 0.4 },
  { left: "66%", size: 2, duration: 20, delay: 7, drift: 8, opacity: 0.45 },
  { left: "74%", size: 4, duration: 14, delay: 5, drift: -6, opacity: 0.35 },
  { left: "82%", size: 2, duration: 17, delay: 9, drift: 10, opacity: 0.5 },
  { left: "89%", size: 3, duration: 15, delay: 1.5, drift: -8, opacity: 0.45 },
  { left: "95%", size: 2, duration: 19, delay: 6.5, drift: 6, opacity: 0.5 },
  { left: "70%", size: 2, duration: 13, delay: 11, drift: -12, opacity: 0.4 },
] as const;

/** Purely decorative floating embers over the ink background. Positions/timings
    are hardcoded (not Math.random()) so server and client markup match exactly. */
export function EmberField() {
  return (
    <div
      aria-hidden
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}
    >
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
