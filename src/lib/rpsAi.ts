/**
 * Learning RPS opponent: predicts your *next* move from past rounds only.
 * The AI never sees the current pick — `pickLearningAiMove` runs before you choose.
 *
 * Design:
 * - Recency-weighted Markov backoff (recent rounds update the model fastest).
 * - Stochastic exploitation: sample from the inferred human mixture, then beat that sample
 *   (professional unpredictability vs. always slamming the single modal counter).
 * - Cryptographic RNG for exploration and discrete choices when available.
 * - Light uniform blending in the predicted mixture preserves “alive” randomness.
 */

export type RpsChoice = "rock" | "paper" | "scissors";

const CHOICES: RpsChoice[] = ["rock", "paper", "scissors"];

const STORAGE_KEY = "rps-pro-player-history-v2";
export const MAX_PLAYER_HISTORY = 400;

const LAPLACE = 0.32;
/** Older rounds decay; newest events weight ~1 */
const RECENCY_DECAY = 0.86;
/** Ignore the learner and uniform-random gesture. */
const PURE_RANDOM_EXPLORE = 0.092;
/** Discrete 1/3 noise stirred into logits before categorical sample. */
const MIX_UNIFORM_IN_PREDICTION = 0.08;

export function idxChoice(c: RpsChoice): 0 | 1 | 2 {
  if (c === "rock") return 0;
  if (c === "paper") return 1;
  return 2;
}

/** Unbiased index in `[0, n)`, `n===3`. */
function secureIndexBelowThree(): 0 | 1 | 2 {
  const n = 3;
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    return Math.min(2, Math.floor(Math.random() * n)) as 0 | 1 | 2;
  }
  const maxAccepted = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= maxAccepted);
  return (x % n) as 0 | 1 | 2;
}

/** Uniform [0, 1). */
export function secureUnitInterval(): number {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    return Math.random();
  }
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! / 0x1_0000_0000;
}

function secureChoiceUniform(): RpsChoice {
  return CHOICES[secureIndexBelowThree()]!;
}

type Triple = [number, number, number];

function normalize(p: Triple): Triple {
  const s = p[0] + p[1] + p[2];
  if (s <= 0) return [1 / 3, 1 / 3, 1 / 3];
  return [p[0] / s, p[1] / s, p[2] / s];
}

function laplace(dist: Triple, alpha: number): Triple {
  const s = dist[0] + dist[1] + dist[2] + 3 * alpha;
  return [(dist[0] + alpha) / s, (dist[1] + alpha) / s, (dist[2] + alpha) / s];
}

function blend(a: Triple, b: Triple, w: number): Triple {
  const u = 1 - w;
  return [w * a[0] + u * b[0], w * a[1] + u * b[1], w * a[2] + u * b[2]];
}

function sampleCategorical(raw: Triple, rnd: () => number): 0 | 1 | 2 {
  const p = normalize(raw);
  const r = rnd();
  if (r < p[0]) return 0;
  if (r < p[0] + p[1]) return 1;
  return 2;
}

/** Play the move that beats `c` (standard RPS). */
export function winningCounter(c: RpsChoice): RpsChoice {
  if (c === "rock") return "paper";
  if (c === "paper") return "scissors";
  return "rock";
}

function buildRecencyWeightedMarkov(history: readonly RpsChoice[]): {
  bigram: Record<RpsChoice, Triple>;
  trigram: Record<string, Triple>;
  marginal: Triple;
} {
  const marginal: Triple = [0, 0, 0];
  const bigram: Record<RpsChoice, Triple> = {
    rock: [0, 0, 0],
    paper: [0, 0, 0],
    scissors: [0, 0, 0],
  };
  const trigram: Record<string, Triple> = {};

  const n = history.length;
  for (let i = 0; i < n; i++) {
    const w = RECENCY_DECAY ** (n - 1 - i);
    marginal[idxChoice(history[i]!)] += w;
  }

  for (let i = 1; i < n; i++) {
    const w = RECENCY_DECAY ** (n - 1 - i);
    const prev = history[i - 1]!;
    const cur = history[i]!;
    bigram[prev][idxChoice(cur)] += w;
  }

  for (let i = 2; i < n; i++) {
    const w = RECENCY_DECAY ** (n - 1 - i);
    const key = `${history[i - 2]!}:${history[i - 1]!}`;
    if (!trigram[key]) trigram[key] = [0, 0, 0];
    trigram[key][idxChoice(history[i]!)] += w;
  }

  return { bigram, marginal, trigram };
}

/** Estimated P(next player move | history prior to sealing). */
export function predictPlayerMoveDistribution(
  history: readonly RpsChoice[],
): Triple {
  const uniform: Triple = [1 / 3, 1 / 3, 1 / 3];
  if (history.length === 0) return uniform;

  const { bigram, trigram, marginal } = buildRecencyWeightedMarkov(history);
  const margSmooth = laplace(marginal, LAPLACE);

  if (history.length === 1) {
    const last = history[0]!;
    const bSmooth = laplace(bigram[last], LAPLACE);
    return normalize(blend(bSmooth, margSmooth, 0.62));
  }

  const prev2 = history[history.length - 2]!;
  const prev1 = history[history.length - 1]!;
  const tKey = `${prev2}:${prev1}`;
  const tRaw = trigram[tKey] ?? ([0, 0, 0] as Triple);
  const tSum = tRaw[0] + tRaw[1] + tRaw[2];

  const bSmooth = laplace(bigram[prev1], LAPLACE);
  const tSmooth = laplace(tRaw, LAPLACE);

  const trigramWeight =
    tSum >= 4.8 ? 0.82 : tSum >= 2.4 ? 0.67 : tSum >= 1.05 ? 0.5 : 0.28;

  const mixedTB = blend(tSmooth, bSmooth, trigramWeight);
  const withMarg = blend(mixedTB, margSmooth, 0.14);
  return normalize(withMarg);
}

/**
 * Chooses AI move before the human picks this round.
 * Inject `rnd` only in tests; production prefers `secureUnitInterval`.
 */
export function pickLearningAiMove(
  history: readonly RpsChoice[],
  rnd: () => number = secureUnitInterval,
): RpsChoice {
  if (rnd() < PURE_RANDOM_EXPLORE) {
    return secureChoiceUniform();
  }
  if (history.length === 0) {
    return secureChoiceUniform();
  }

  let p = predictPlayerMoveDistribution(history);
  const uni: Triple = [1 / 3, 1 / 3, 1 / 3];
  p = normalize(blend(p, uni, MIX_UNIFORM_IN_PREDICTION));

  const predictedIdx = sampleCategorical(p, rnd);
  const predictedHuman = CHOICES[predictedIdx]!;
  return winningCounter(predictedHuman);
}

export function loadPlayerHistory(): RpsChoice[] {
  if (typeof window === "undefined") return [];
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem("rps-pro-player-history-v1");
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RpsChoice =>
          x === "rock" || x === "paper" || x === "scissors",
      )
      .slice(-MAX_PLAYER_HISTORY);
  } catch {
    return [];
  }
}

export function savePlayerHistory(moves: readonly RpsChoice[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...moves].slice(-MAX_PLAYER_HISTORY)),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPlayerLearning() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("rps-pro-player-history-v1");
  } catch {
    /* ignore */
  }
}
