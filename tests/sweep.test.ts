/**
 * The parameter sweep moves one slider across its range and re-runs the showdown at each value.
 * These tests check the value lists, the one-parameter override, and that a sweep uses exactly the
 * same batch statistics as a normal single run.
 * Run with:  npm test
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_SETTINGS, PRESETS, STRATEGIES } from "../src/lib/sim/strategies";
import { applyParam, paramById, runSweep, sweepValues, type SweepSetup } from "../src/lib/sim/sweep";
import { runTournament, type TournamentInput } from "../src/lib/sim/tournament";

const driveSpeed = paramById("profile.driveSpeed")!;
const tipThreshold = paramById("settings.tipThreshold")!;

const base: SweepSetup = {
  strategies: STRATEGIES.slice(0, 2),
  profiles: [PRESETS.Average, PRESETS.Average],
  settings: DEFAULT_SETTINGS,
  matchesPerPair: 2,
  seed: 1000,
};

describe("sweepValues", () => {
  test("spreads evenly across the range, on the step grid, including the current value", () => {
    const values = sweepValues(driveSpeed, 5, 4);
    assert.equal(values.length, 5);
    assert.deepEqual([...values].sort((a, b) => a - b), values);
    assert.ok(values.includes(4), "current value must be on the curve");
    for (const v of values) {
      assert.ok(v >= driveSpeed.min && v <= driveSpeed.max);
      assert.ok(Math.abs((v - driveSpeed.min) / driveSpeed.step - Math.round((v - driveSpeed.min) / driveSpeed.step)) < 1e-9, `${v} is off the step grid`);
    }
  });

  test("a single value is just the current setting", () => {
    assert.deepEqual(sweepValues(driveSpeed, 1, 5.25), [5.25]);
  });

  test("values are unique even when the range is small", () => {
    const values = sweepValues(tipThreshold, 9, 7.5);
    assert.equal(new Set(values).size, values.length);
    assert.ok(values.includes(7.5));
  });
});

describe("applyParam", () => {
  test("a robot parameter moves both robots and leaves the base setup alone", () => {
    const next = applyParam(base, driveSpeed, 7);
    assert.equal(next.profiles[0].driveSpeed, 7);
    assert.equal(next.profiles[1].driveSpeed, 7);
    assert.equal(base.profiles[0].driveSpeed, PRESETS.Average.driveSpeed);
    assert.equal(next.settings, base.settings);
  });

  test("a game assumption changes only that setting", () => {
    const next = applyParam(base, tipThreshold, 9);
    assert.equal(next.settings.tipThreshold, 9);
    assert.equal(base.settings.tipThreshold, DEFAULT_SETTINGS.tipThreshold);
    assert.equal(next.profiles, base.profiles);
  });
});

describe("runSweep", () => {
  const values = [6, 8];

  test("runs a full batch per value with the same statistics as a single run", async () => {
    const points = (await runSweep(base, driveSpeed, values))!;
    assert.equal(points.length, 2);
    for (const pt of points) {
      assert.equal(pt.stats.length, base.strategies.length);
      const direct = (await runTournament(applyParam(base, driveSpeed, pt.value) as TournamentInput))!;
      assert.deepEqual(pt.stats, direct.stats);
    }
  });

  test("is deterministic", async () => {
    const a = await runSweep(base, driveSpeed, values);
    const b = await runSweep(base, driveSpeed, values);
    assert.deepEqual(a, b);
  });

  test("cancelling returns null", async () => {
    const res = await runSweep(base, driveSpeed, values, undefined, () => true);
    assert.equal(res, null);
  });
});