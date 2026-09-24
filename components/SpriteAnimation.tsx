export function SpriteAnimation({
  sheet,
  frames,
  frameSize,
  fps = 6,
  tint = "none",
  label,
  className = "",
}: {
  /** Path to a horizontal sprite sheet of `frames` equal-width frames. */
  sheet: string;
  frames: number;
  frameSize: number;
  fps?: number;
  /** CSS `filter` value, e.g. from lib/ui/heroSprites.ts's CLASS_TINT. */
  tint?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`pixel-art shrink-0 ${className}`}
      style={
        {
          width: frameSize,
          height: frameSize,
          backgroundImage: `url(${sheet})`,
          backgroundSize: `${frameSize * frames}px ${frameSize}px`,
          filter: tint,
          animation: `sprite-frames ${frames / fps}s steps(${frames}) infinite`,
          "--sprite-frames": frames,
          "--sprite-frame-size": `${frameSize}px`,
        } as React.CSSProperties
      }
    />
  );
}
