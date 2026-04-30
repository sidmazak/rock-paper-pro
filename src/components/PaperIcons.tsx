/**
 * Hand-drawn paper-style SVG icons for Rock / Paper / Scissors.
 * Use stroke="currentColor" so they inherit ink color.
 */

type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

const baseProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 100 100",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
});

export function RockIcon({
  size = 80,
  className,
  strokeWidth = 2.5,
}: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      {/* River stone — low flat cobble with clear facet planes */}
      <path
        d="M18 62
           C16 48 22 36 34 28
           C44 22 58 20 70 26
           C84 34 88 48 84 60
           C80 76 64 84 46 82
           C30 80 20 74 18 62 Z"
        strokeWidth={strokeWidth}
      />
      {/* major facet edges */}
      <path
        d="M34 28 L42 48 L30 70 M70 26 L58 44 L84 60 M42 48 L58 44 L46 82"
        strokeWidth={strokeWidth - 0.6}
        opacity="0.55"
      />
      {/* lit plane */}
      <path
        d="M38 34 L52 32 L48 42 Z"
        strokeWidth={strokeWidth - 0.8}
        opacity="0.45"
        fill="currentColor"
        fillOpacity="0.06"
      />
      {/* ground contact shadow */}
      <path
        d="M28 78 Q48 84 72 76"
        strokeWidth={strokeWidth - 0.9}
        opacity="0.4"
      />
    </svg>
  );
}

export function PaperIcon({
  size = 80,
  className,
  strokeWidth = 2.5,
}: IconProps) {
  const w = strokeWidth - 0.7;
  return (
    <svg {...baseProps(size, className)}>
      {/* Loose leaf — uneven outline reads like torn/scribbled binder paper */}
      <path
        d="M26 82
           Q21 74 21 64 L20 38
           Q19 31 21 26 Q24 21 31 20
           L73 17
           Q79 17 80 23 L81 70
           Q81 78 76 82
           Q72 87 62 83
           L30 87
           Q27 87 26 82 Z"
        strokeWidth={strokeWidth}
      />
      {/* scribbly margin */}
      <path
        d="M33 24 Q32 52 34 82"
        strokeWidth={strokeWidth - 1}
        opacity="0.5"
      />
      {/* faint hole punches */}
      <circle
        cx="28"
        cy="30"
        r="2.2"
        strokeWidth={strokeWidth - 1.2}
        opacity="0.45"
      />
      <circle
        cx="28"
        cy="48"
        r="2.2"
        strokeWidth={strokeWidth - 1.2}
        opacity="0.45"
      />
      <circle
        cx="28.5"
        cy="66"
        r="2.2"
        strokeWidth={strokeWidth - 1.2}
        opacity="0.45"
      />
      {/* ruled lines — slightly waved, uneven length */}
      <path d="M38 37 Q52 39 74 34" strokeWidth={w} opacity="0.5" />
      <path d="M38 48 Q54 46 71 46" strokeWidth={w} opacity="0.5" />
      <path d="M37 58 Q53 61 76 56" strokeWidth={w} opacity="0.5" />
      <path d="M38 69 Q52 67 62 71" strokeWidth={w} opacity="0.5" />
      <path d="M38 74 Q52 73 54 74" strokeWidth={w - 0.2} opacity="0.42" />
      {/* folded dog-ear */}
      <path
        d="M62 83 L73 71 L73 82 Q69 83 62 83 Z"
        strokeWidth={strokeWidth}
        fill="currentColor"
        fillOpacity={0.05}
      />
    </svg>
  );
}

export function ScissorsIcon({
  size = 80,
  className,
  strokeWidth = 2.5,
}: IconProps) {
  // Classic open scissors: two finger loops at bottom-left,
  // two blades crossing at a pivot and opening toward the top-right.
  return (
    <svg {...baseProps(size, className)}>
      {/* Finger loops (handles) */}
      <ellipse
        cx="22"
        cy="74"
        rx="11"
        ry="9"
        strokeWidth={strokeWidth}
        transform="rotate(-20 22 74)"
      />
      <ellipse
        cx="44"
        cy="80"
        rx="11"
        ry="9"
        strokeWidth={strokeWidth}
        transform="rotate(20 44 80)"
      />

      {/* Handle stems leading into the pivot */}
      <path d="M30 66 L52 50" strokeWidth={strokeWidth} />
      <path d="M52 72 L52 50" strokeWidth={strokeWidth} />

      {/* Upper blade — leaf shape opening up-right */}
      <path
        d="M52 50 Q60 36 84 14 Q86 12 84 16 Q72 40 58 56 Z"
        strokeWidth={strokeWidth}
      />
      {/* Lower blade — leaf shape opening to the right */}
      <path
        d="M52 50 Q68 44 90 38 Q92 38 90 40 Q70 52 56 56 Z"
        strokeWidth={strokeWidth}
      />

      {/* Pivot screw */}
      <circle
        cx="52"
        cy="50"
        r="3"
        strokeWidth={strokeWidth - 0.5}
        fill="currentColor"
      />
      <circle cx="52" cy="50" r="1" fill="var(--background)" stroke="none" />
    </svg>
  );
}

export function LockIcon({
  size = 80,
  className,
  strokeWidth = 2.5,
}: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M30 50 Q30 28 50 28 Q70 28 70 50" strokeWidth={strokeWidth} />
      <rect
        x="22"
        y="50"
        width="56"
        height="36"
        rx="6"
        strokeWidth={strokeWidth}
      />
      <circle cx="50" cy="66" r="4" strokeWidth={strokeWidth} />
      <path d="M50 70 L50 76" strokeWidth={strokeWidth} />
    </svg>
  );
}

export function QuestionIcon({
  size = 80,
  className,
  strokeWidth = 2.5,
}: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path
        d="M34 38 Q34 22 50 22 Q66 22 66 38 Q66 48 54 52 Q50 54 50 62"
        strokeWidth={strokeWidth}
      />
      <circle
        cx="50"
        cy="76"
        r="3"
        strokeWidth={strokeWidth}
        fill="currentColor"
      />
    </svg>
  );
}

/** SVG filter that gives any element a hand-drawn rough edge. Render once. */
export function RoughFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <filter id="paper-rough">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="2"
            seed="3"
          />
          <feDisplacementMap in="SourceGraphic" scale="2.2" />
        </filter>
      </defs>
    </svg>
  );
}
