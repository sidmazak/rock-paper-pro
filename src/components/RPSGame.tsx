"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sfx, setMuted, primeAudio } from "@/lib/sounds";
import {
  RockIcon,
  PaperIcon,
  ScissorsIcon,
  LockIcon,
  QuestionIcon,
  RoughFilter,
} from "./PaperIcons";
import {
  clearPlayerLearning,
  loadPlayerHistory,
  pickLearningAiMove,
  savePlayerHistory,
  MAX_PLAYER_HISTORY,
} from "@/lib/rpsAi";

type Choice = "rock" | "paper" | "scissors";
type Phase = "idle" | "locking" | "awaiting" | "reveal" | "result";
type Outcome = "win" | "lose" | "draw";

const CHOICES: Choice[] = ["rock", "paper", "scissors"];
const LABEL: Record<Choice, string> = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors",
};

/** Left-hand shortcuts: same row home as WASD ergonomics */
const CHOICE_HOTKEY: Record<Choice, string> = {
  rock: "Q",
  paper: "W",
  scissors: "E",
};

/** Narrow vertical strips on the viewport edges only — avoids the centred play area */
const EDGE_LEFT = { left: [2.5, 17] as const, top: [12, 86] as const };
const EDGE_RIGHT = { left: [83, 96.5] as const, top: [12, 86] as const };

function edgeStripeForIconIndex(i: number) {
  return i % 2 === 0 ? EDGE_LEFT : EDGE_RIGHT;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

type BackdropIconPose = {
  leftPct: number;
  topPct: number;
  rotateDeg: number;
  size: number;
  floatDelaySec: number;
  floatDurationSec: number;
};

function randRange(range: readonly [number, number]): number {
  return range[0] + Math.random() * (range[1] - range[0]);
}

/** Seed vertical separation so neighbours on the same side do not pile up */
function initialTopBandForBackdrop(i: number): readonly [number, number] {
  if (edgeStripeForIconIndex(i) === EDGE_LEFT) {
    if (i === 0) return [14, 34];
    if (i === 2) return [42, 58];
    return [64, 84];
  }
  if (i === 1) return [14, 44];
  return [52, 84];
}

/** Five gentle phase offsets so bobbing cycles stay staggered */
const BACKDROP_FLOAT_DELAYS_SEC = [-0.35, -1.95, -3.55, -2.45, -4.35] as const;

/**
 * Seed: spreads icons along the margins. Updates: tiny drifts inside the same stripe
 * so motion stays barely noticeable while the idle loop runs.
 */
function backdropIconPosesNext(
  prev?: readonly BackdropIconPose[],
): BackdropIconPose[] {
  return BACKDROP_ICONS.map((_, i) => {
    const stripe = edgeStripeForIconIndex(i);

    if (!prev?.[i]) {
      const topRanges = initialTopBandForBackdrop(i);
      return {
        leftPct: randRange(stripe.left),
        topPct: randRange(topRanges),
        rotateDeg: randRange([-6, 6]),
        size: 94 + Math.round(Math.random() * 14),
        floatDelaySec: BACKDROP_FLOAT_DELAYS_SEC[i] ?? -(i + 1) * 1.1,
        floatDurationSec: 6.2 + Math.random() * 1.8,
      };
    }

    const p = prev[i];
    return {
      leftPct: clamp(
        p.leftPct + (Math.random() * 2.6 - 1.3),
        stripe.left[0],
        stripe.left[1],
      ),
      topPct: clamp(
        p.topPct + (Math.random() * 2.8 - 1.4),
        stripe.top[0],
        stripe.top[1],
      ),
      rotateDeg: clamp(p.rotateDeg + (Math.random() * 2.4 - 1.2), -9, 9),
      size: clamp(p.size + Math.round(Math.random() * 4 - 2), 88, 118),
      floatDelaySec: p.floatDelaySec,
      floatDurationSec: p.floatDurationSec,
    };
  });
}

const BACKDROP_EASE = "cubic-bezier(0.45, 0.05, 0.55, 0.95)";

const BACKDROP_ICONS = [
  { Icon: RockIcon, key: "bg-rock-a" },
  { Icon: PaperIcon, key: "bg-paper-a" },
  { Icon: ScissorsIcon, key: "bg-scissors" },
  { Icon: RockIcon, key: "bg-rock-b" },
  { Icon: PaperIcon, key: "bg-paper-b" },
] as const;

/** Fixed first paint for SSR + hydration — never use Math.random here. */
const STATIC_BACKDROP_POSES: BackdropIconPose[] = [
  {
    leftPct: 8.5,
    topPct: 22,
    rotateDeg: -3,
    size: 100,
    floatDelaySec: -0.35,
    floatDurationSec: 6.6,
  },
  {
    leftPct: 87,
    topPct: 26,
    rotateDeg: 4,
    size: 102,
    floatDelaySec: -1.95,
    floatDurationSec: 6.75,
  },
  {
    leftPct: 11,
    topPct: 48,
    rotateDeg: 2,
    size: 98,
    floatDelaySec: -3.55,
    floatDurationSec: 6.9,
  },
  {
    leftPct: 89,
    topPct: 58,
    rotateDeg: -5,
    size: 104,
    floatDelaySec: -2.45,
    floatDurationSec: 7.0,
  },
  {
    leftPct: 13,
    topPct: 72,
    rotateDeg: 3,
    size: 96,
    floatDelaySec: -4.35,
    floatDurationSec: 6.65,
  },
];

const ChoiceIcon = ({
  choice,
  size,
  className,
}: {
  choice: Choice;
  size?: number;
  className?: string;
}) => {
  if (choice === "rock") return <RockIcon size={size} className={className} />;
  if (choice === "paper")
    return <PaperIcon size={size} className={className} />;
  return <ScissorsIcon size={size} className={className} />;
};

const CONFETTI_COLORS = [
  "oklch(0.7 0.16 50)",
  "oklch(0.55 0.14 145)",
  "oklch(0.55 0.2 25)",
  "oklch(0.45 0.12 35)",
  "oklch(0.82 0.12 80)",
] as const;

type ConfettiPiece = {
  id: string;
  left: number;
  delay: number;
  dur: number;
  bg: string;
  w: number;
  h: number;
  rot: number;
};

function buildConfettiPieces(): ConfettiPiece[] {
  return Array.from({ length: 70 }, (_, i) => ({
    id: `${i}-${crypto.randomUUID()}`,
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    dur: 1.2 + Math.random() * 0.9,
    bg: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    rot: Math.random() * 360,
  }));
}

function judge(p: Choice, a: Choice): Outcome {
  if (p === a) return "draw";
  if (
    (p === "rock" && a === "scissors") ||
    (p === "paper" && a === "rock") ||
    (p === "scissors" && a === "paper")
  )
    return "win";
  return "lose";
}

export function RPSGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [playerChoice, setPlayerChoice] = useState<Choice | null>(null);
  const [aiChoice, setAiChoice] = useState<Choice | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [score, setScore] = useState({ w: 0, l: 0, d: 0 });
  const [muted, setMutedState] = useState(false);
  const [shake, setShake] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<ConfettiPiece[]>([]);
  const [backdropPoses, setBackdropPoses] = useState<BackdropIconPose[]>(
    STATIC_BACKDROP_POSES,
  );

  const timeouts = useRef<number[]>([]);
  const aiChoiceRef = useRef<Choice | null>(null);
  const playerHistoryRef = useRef<Choice[]>([]);

  useEffect(() => {
    playerHistoryRef.current = loadPlayerHistory();
  }, []);

  const clearTimers = () => {
    timeouts.current.forEach((t) => window.clearTimeout(t));
    timeouts.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setBackdropPoses(backdropIconPosesNext());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;
    const tick = () => {
      timeoutId = window.setTimeout(
        () => {
          if (cancelled) return;
          setBackdropPoses((prev) => backdropIconPosesNext(prev));
          tick();
        },
        11000 + Math.random() * 8000,
      );
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  const toggleMute = () => {
    const m = !muted;
    setMutedState(m);
    setMuted(m);
  };

  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 500);
  };

  const startRound = useCallback(() => {
    primeAudio();
    clearTimers();
    setPlayerChoice(null);
    setAiChoice(null);
    aiChoiceRef.current = null;
    setOutcome(null);
    setPhase("locking");
    sfx.tick();

    const t = window.setTimeout(() => {
      const ai = pickLearningAiMove(playerHistoryRef.current);
      aiChoiceRef.current = ai;
      sfx.go();
      setPhase("awaiting");
    }, 750);
    timeouts.current.push(t);
  }, []);

  const pick = useCallback(
    (c: Choice) => {
      if (phase !== "awaiting") return;
      const ai = aiChoiceRef.current;
      if (!ai) return;

      sfx.click();
      setPlayerChoice(c);
      setAiChoice(ai);
      setPhase("reveal");

      const t = window.setTimeout(() => {
        const r = judge(c, ai);
        playerHistoryRef.current = [...playerHistoryRef.current, c].slice(
          -MAX_PLAYER_HISTORY,
        );
        savePlayerHistory(playerHistoryRef.current);
        setOutcome(r);
        setPhase("result");
        if (r === "win") {
          sfx.win();
          setScore((s) => ({ ...s, w: s.w + 1 }));
          setConfettiPieces(buildConfettiPieces());
          window.setTimeout(() => setConfettiPieces([]), 1500);
        } else if (r === "lose") {
          sfx.lose();
          setScore((s) => ({ ...s, l: s.l + 1 }));
          triggerShake();
        } else {
          sfx.draw();
          setScore((s) => ({ ...s, d: s.d + 1 }));
        }
      }, 600);
      timeouts.current.push(t);
    },
    [phase],
  );

  const reset = () => {
    clearTimers();
    setPhase("idle");
    setPlayerChoice(null);
    setAiChoice(null);
    aiChoiceRef.current = null;
    setOutcome(null);
  };

  const resetScore = () => setScore({ w: 0, l: 0, d: 0 });

  const forgetRivalMemory = () => {
    playerHistoryRef.current = [];
    clearPlayerLearning();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "r" && phase === "result") {
        startRound();
        return;
      }
      if (k === "t" && phase === "result") {
        reset();
        return;
      }
      if (k === "q") pick("rock");
      else if (k === "w") pick("paper");
      else if (k === "e") pick("scissors");
      else if (k === " " || k === "enter") {
        if (phase === "idle" || phase === "result") startRound();
      } else if (k === "m") toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, muted, pick, reset, startRound]);

  const resultText = useMemo(() => {
    if (outcome === "win") return "You Win!";
    if (outcome === "lose") return "You Lose";
    if (outcome === "draw") return "Draw";
    return "";
  }, [outcome]);

  const resultColor =
    outcome === "win"
      ? "text-success"
      : outcome === "lose"
        ? "text-destructive"
        : "text-ink";

  return (
    <div
      className={`relative flex min-h-dvh flex-col items-center px-3 py-3 sm:justify-center sm:px-4 sm:py-5 md:py-7 ${
        shake ? "animate-camera-shake" : ""
      }`}
    >
      <RoughFilter />

      {/* Page backdrop — left/right margins only, micro-drift on a slow timer */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden z-0 text-ink/11"
        aria-hidden
      >
        {BACKDROP_ICONS.map(({ Icon, key }, i) => {
          const p = backdropPoses[i];
          if (!p) return null;
          return (
            <div
              key={key}
              className="absolute will-change-[left,top,transform]"
              style={{
                left: `${p.leftPct}%`,
                top: `${p.topPct}%`,
                transform: `rotate(${p.rotateDeg}deg)`,
                transition: `left 1.75s ${BACKDROP_EASE}, top 1.75s ${BACKDROP_EASE}, transform 1.9s ${BACKDROP_EASE}`,
              }}
            >
              <div
                className="animate-float-paper"
                style={{
                  animationDelay: `${p.floatDelaySec}s`,
                  animationDuration: `${p.floatDurationSec}s`,
                }}
              >
                <Icon size={p.size} strokeWidth={2} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Top bar */}
      <header className="relative z-10 mb-4 flex w-full max-w-3xl shrink-0 flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
        <div className="min-w-0 max-w-xl">
          <h1 className="font-marque inline-block font-normal leading-[1.08] text-ink text-[clamp(1.5rem,5vw,2.75rem)]">
            <span className="inline-flex flex-wrap items-baseline gap-0 whitespace-normal sm:whitespace-nowrap">
              <span>Roc</span>
              <span className="scribble-hand-paper">k · Paper · Sci</span>
              <span className="-ml-[0.02em]">ssors</span>
            </span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="chip flex gap-3 text-[0.95rem] leading-tight font-hand font-medium tracking-tight">
            <span className="text-success font-bold">W {score.w}</span>
            <span className="text-ink-soft">·</span>
            <span className="text-destructive font-bold">L {score.l}</span>
            <span className="text-ink-soft">·</span>
            <span className="text-ink-soft font-bold">D {score.d}</span>
          </div>
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="chip w-10 h-10 p-0 flex items-center justify-center hover:rotate-[-4deg] transition-transform"
            title={muted ? "Unmute" : "Mute"}
          >
            <span className="font-hand text-lg font-semibold leading-none">
              {muted ? "✕" : "♪"}
            </span>
          </button>
        </div>
      </header>

      {/* Stage */}
      <main className="relative z-10 flex min-h-0 w-full max-w-3xl flex-1 flex-col justify-center gap-3 pb-2 sm:gap-4 md:gap-5">
        <div
          className={`paper-card flex max-h-[min(58dvh,calc(100dvh-11.5rem))] min-h-0 flex-col items-center justify-center overflow-y-auto overscroll-contain p-5 text-center sm:max-h-none sm:min-h-[260px] md:min-h-[300px] lg:min-h-[320px] md:p-10 ${
            outcome === "lose" ? "animate-flash" : ""
          }`}
          style={{ transform: "rotate(-0.4deg)" }}
        >
          {phase === "idle" && (
            <div className="animate-slide-up flex flex-col items-center gap-3 sm:gap-5">
              <h2 className="font-stage max-w-[18ch] text-center text-[clamp(1.5rem,5.2vw,3rem)] font-semibold leading-[1.12] tracking-[0.05em] text-ink antialiased not-italic sm:max-w-[22ch] md:text-[clamp(1.875rem,6vw,3.5rem)]">
                A Game on Paper
              </h2>
              <p className="font-hand max-w-md text-sm leading-snug text-ink-soft sm:text-base">
                They seal a throw before you—no spoilers, scout&apos;s honour.
                Lose often enough and they start collecting your habits like
                souvenir stamps.
              </p>
              <button
                onClick={startRound}
                className="stamp-btn mt-1 text-base sm:mt-2 sm:text-lg"
              >
                Begin Match
              </button>
              <p className="font-hand mt-0.5 text-xs text-ink-soft sm:text-sm">
                Tip: use <span className="chip text-sm py-0.5 px-2">Q</span>{" "}
                <span className="chip text-sm py-0.5 px-2">W</span>{" "}
                <span className="chip text-sm py-0.5 px-2">E</span> on your
                keyboard
              </p>
            </div>
          )}

          {(phase === "locking" ||
            phase === "awaiting" ||
            phase === "reveal" ||
            phase === "result") && (
            <div className="flex w-full flex-col items-center gap-4 sm:gap-6">
              <div className="grid w-full max-w-md grid-cols-3 items-center gap-2 sm:gap-4">
                {/* Player */}
                <div className="flex flex-col items-center gap-1.5 sm:gap-3">
                  <p className="font-stage text-xs font-medium uppercase tracking-[0.18em] text-ink-soft sm:text-sm md:text-base">
                    You
                  </p>
                  <div
                    key={playerChoice ?? "you-empty"}
                    className={`origin-bottom scale-[0.88] text-ink sm:scale-100 ${playerChoice ? "animate-pop-in" : "opacity-40"}`}
                  >
                    {playerChoice ? (
                      <ChoiceIcon choice={playerChoice} size={88} />
                    ) : (
                      <QuestionIcon size={88} />
                    )}
                  </div>
                </div>

                <div className="font-display text-xl text-ink-soft sm:text-2xl md:text-3xl">
                  vs
                </div>

                {/* AI */}
                <div className="flex flex-col items-center gap-1.5 sm:gap-3">
                  <p className="font-stage text-xs font-medium uppercase tracking-[0.18em] text-ink-soft sm:text-sm md:text-base">
                    Foe
                  </p>
                  <div
                    key={`${phase}-${aiChoice ?? "hidden"}`}
                    className={`origin-bottom scale-[0.88] text-ink sm:scale-100 ${
                      phase === "reveal" || phase === "result"
                        ? "animate-pop-in"
                        : ""
                    }`}
                  >
                    {phase === "reveal" || phase === "result" ? (
                      aiChoice ? (
                        <ChoiceIcon choice={aiChoice} size={88} />
                      ) : (
                        <QuestionIcon size={88} />
                      )
                    ) : phase === "awaiting" ? (
                      <div className="animate-pulse-soft text-primary">
                        <LockIcon size={88} />
                      </div>
                    ) : (
                      <div className="opacity-40">
                        <QuestionIcon size={88} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {phase === "locking" && (
                <p className="font-scratch animate-pulse-soft text-xl text-ink-soft sm:text-2xl">
                  sealing the envelope…
                </p>
              )}

              {phase === "awaiting" && (
                <div className="animate-pop-in flex flex-col items-center gap-1">
                  <p className="font-display text-2xl font-semibold text-primary sm:text-3xl md:text-4xl">
                    Sealed!
                  </p>
                  <p className="font-hand text-sm text-ink-soft sm:text-base md:text-lg">
                    Your move — pick when ready
                  </p>
                </div>
              )}

              {phase === "reveal" && (
                <p className="font-scratch text-xl text-ink-soft sm:text-2xl">
                  breaking the seal…
                </p>
              )}

              {phase === "result" && (
                <>
                  <h2
                    className={`font-display animate-stamp-in text-[clamp(1.875rem,4.75vw,2.75rem)] font-bold leading-tight tracking-[0.02em] sm:text-4xl md:text-5xl ${resultColor}`}
                    style={{
                      textShadow: "2px 2px 0 oklch(0.45 0.06 50 / 0.15)",
                    }}
                  >
                    {resultText}
                  </h2>
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-3">
                      <button onClick={startRound} className="stamp-btn">
                        Play Again
                      </button>
                      <button onClick={reset} className="ghost-btn">
                        Menu (T)
                      </button>
                    </div>
                    <p className="font-hand text-sm text-ink-soft">
                      Or press{" "}
                      <span className="chip py-0.5 px-2 text-xs">R</span> for
                      another round
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Choice buttons */}
        <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-4 md:gap-5">
          {CHOICES.map((c, i) => {
            const enabled = phase === "awaiting";
            const active =
              playerChoice === c && (phase === "reveal" || phase === "result");
            const tilt = ["-rotate-1", "rotate-1", "-rotate-2"][i];
            return (
              <button
                key={c}
                onClick={() => pick(c)}
                disabled={!enabled}
                className={`paper-card group relative flex flex-col items-center gap-1.5 py-4 ${tilt} sm:gap-2 sm:py-6 md:py-7
                  ${!enabled ? "opacity-70 cursor-not-allowed" : "hover:-translate-y-1 hover:rotate-0 active:translate-y-0 transition-transform"}
                  ${active ? "shadow-paper-lift ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}
                `}
                style={{
                  transformOrigin: "50% 80%",
                }}
              >
                <span
                  className={`text-ink sm:mx-1 ${enabled ? "group-hover:scale-110 group-hover:rotate-[-4deg] transition-transform" : ""}`}
                >
                  <ChoiceIcon choice={c} size={64} />
                </span>
                <span className="font-marque text-base font-bold text-ink sm:text-lg md:text-xl">
                  {LABEL[c]}
                </span>
                <span className="absolute top-2 right-3 chip text-xs py-0 px-2">
                  {CHOICE_HOTKEY[c]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft sm:mt-4 sm:text-sm">
          <span className="font-hand">Pick when the foe’s move is sealed.</span>
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={resetScore}
              className="font-hand underline decoration-dotted underline-offset-4 hover:text-ink transition"
            >
              reset score
            </button>
            <button
              type="button"
              onClick={forgetRivalMemory}
              className="font-hand underline decoration-dotted underline-offset-4 hover:text-ink transition"
              title="Clear saved pattern memory (this device only)"
            >
              forget foe memory
            </button>
          </span>
        </div>
      </main>

      {/* Confetti — paper bits */}
      {confettiPieces.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {confettiPieces.map((p) => (
            <span
              key={p.id}
              className="absolute top-[-20px]"
              style={{
                left: `${p.left}%`,
                background: p.bg,
                width: `${p.w}px`,
                height: `${p.h}px`,
                transform: `rotate(${p.rot}deg)`,
                animation: `confetti ${p.dur}s ${p.delay}s linear forwards`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
