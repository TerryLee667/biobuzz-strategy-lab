import { PROFILE_FIELDS, SETTINGS_FIELDS, type NumField } from "./params";
import { runTournamentParallel } from "./parallel";
import type { StrategyStats } from "./tournament";
import type { GameSettings, RobotProfile, Strategy } from "./types";

/**
 * Parameter sweep: hold everything else fixed, move one slider across its range, and re-run the whole
 * Strategy showdown at each value. Each value gets the same batch as a normal showdown run (many
 * matches, each with its own seed) and the per-strategy numbers are that batch's averages, so a curve
 * shows how the parameter moves each strategy's results.
 */

export type SweepTarget = "profile" | "settings";

export interface SweepParam {
  /** "profile.driveSpeed" | "settings.tipThreshold" */
  id: string;
  target: SweepTarget;
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const fromField = (target: SweepTarget, key: string, f: NumField): SweepParam => ({ id: `${target}.${key}`, target, key, ...f });

/** Every numeric slider, robots first (both robots are moved together), then the game assumptions. */
export const SWEEP_PARAMS: SweepParam[] = [
  ...Object.entries(PROFILE_FIELDS).map(([k, f]) => fromField("profile", k, f)),
  ...Object.entries(SETTINGS_FIELDS).map(([k, f]) => fromField("settings", k, f)),
];

export function paramById(id: string): SweepParam | undefined {
  return SWEEP_PARAMS.find((p) => p.id === id);
}

/** One curve's worth of data: how a single strategy number reads out of a tournament summary. */
export interface Metric {
  id: string;
  label: string;
  format: (v: number) => string;
  get: (s: StrategyStats) => number;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const one = (v: number) => v.toFixed(1);

/** The same columns the rankings table shows, one per curve. */
export const METRICS: Metric[] = [
  { id: "win", label: "Win %", format: pct, get: (s) => (s.wins + s.ties * 0.5) / s.matches },
  { id: "avgScore", label: "Avg score", format: one, get: (s) => s.avgScore },
  { id: "margin", label: "Margin", format: one, get: (s) => s.avgMargin },
  { id: "sd", label: "± SD", format: (v) => v.toFixed(0), get: (s) => s.scoreStdDev },
  { id: "tips", label: "Tips", format: one, get: (s) => s.avgTips },
  { id: "flowers", label: "FLOWER pts", format: one, get: (s) => s.breakdown.flowerBottom + s.breakdown.flowerOwned },
  { id: "rp", label: "RP", format: (v) => v.toFixed(2), get: (s) => s.avgRP },
  { id: "p1", label: "4+ tips", format: pct, get: (s) => s.p1Rate },
  { id: "p2", label: "7+ tips", format: pct, get: (s) => s.p2Rate },
];

export function metricById(id: string): Metric {
  return METRICS.find((m) => m.id === id) ?? METRICS[0];
}

export interface SweepSetup {
  strategies: Strategy[];
  profiles: [RobotProfile, RobotProfile];
  settings: GameSettings;
  matchesPerPair: number;
  seed: number;
}

/** Evenly spaced values across [min,max], snapped to the step grid and always including `current`. */
export function sweepValues(p: SweepParam, count: number, current: number): number[] {
  const clamp = (v: number) => Math.min(p.max, Math.max(p.min, v));
  const snap = (v: number) => {
    const stepped = p.min + Math.round((v - p.min) / p.step) * p.step;
    const decimals = (String(p.step).split(".")[1] ?? "").length;
    return Number(clamp(stepped).toFixed(decimals));
  };
  if (count <= 1) return [snap(clamp(current))];

  const values: number[] = [];
  for (let i = 0; i < count; i++) values.push(snap(p.min + ((p.max - p.min) * i) / (count - 1)));
  let unique = [...new Set(values)].sort((a, b) => a - b);

  const target = snap(clamp(current));
  if (!unique.includes(target)) {
    // Replace the nearest generated value so the current setting is always somewhere on the curve.
    let nearest = 0;
    for (let i = 1; i < unique.length; i++) if (Math.abs(unique[i] - target) < Math.abs(unique[nearest] - target)) nearest = i;
    unique[nearest] = target;
    unique = [...new Set(unique)].sort((a, b) => a - b);
  }
  return unique;
}

/** The same setup with one parameter forced to `value`. Never mutates `base`. */
export function applyParam(base: SweepSetup, p: SweepParam, value: number): SweepSetup {
  if (p.target === "profile") {
    return { ...base, profiles: base.profiles.map((pr) => ({ ...pr, [p.key]: value })) as [RobotProfile, RobotProfile] };
  }
  return { ...base, settings: { ...base.settings, [p.key]: value } as GameSettings };
}

export interface SweepPoint {
  value: number;
  stats: StrategyStats[];
}

/**
 * Runs one full tournament per parameter value (same batch as the Strategy showdown) and collects the
 * per-strategy averages. Every value reuses the same seed group, so a curve moves because of the
 * parameter, not because of different random draws.
 */
export async function runSweep(
  base: SweepSetup,
  p: SweepParam,
  values: number[],
  onProgress?: (done: number, total: number) => void,
  shouldCancel?: () => boolean,
): Promise<SweepPoint[] | null> {
  const points: SweepPoint[] = [];
  for (let i = 0; i < values.length; i++) {
    if (shouldCancel?.()) return null;
    const setup = applyParam(base, p, values[i]);
    const res = await runTournamentParallel(
      {
        strategies: setup.strategies,
        profiles: setup.profiles,
        settings: setup.settings,
        matchesPerPair: setup.matchesPerPair,
        seed: setup.seed,
      },
      (d, t) => onProgress?.(i + d / t, values.length),
      shouldCancel,
    );
    if (!res) return null;
    points.push({ value: values[i], stats: res.stats });
  }
  onProgress?.(values.length, values.length);
  return points;
}