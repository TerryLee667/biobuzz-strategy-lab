"use client";

import { Play, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { METRICS, SWEEP_PARAMS, metricById, paramById, runSweep, sweepValues, type Metric, type SweepParam, type SweepPoint } from "@/lib/sim/sweep";
import type { GameSettings, RobotProfile, Strategy } from "@/lib/sim/types";

const STEP_OPTIONS = [3, 5, 7, 9];
const PER_PAIR_OPTIONS = [10, 20, 50];
/** Same seed as the Strategy showdown, so every value faces the same schedule of matches. */
const SEED = 1000;
const PALETTE = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#475569", "#b45309"];

/**
 * Parameter sweep: hold the robots, settings and strategies fixed, move one slider across its range,
 * and re-run the whole showdown at each value. One line per strategy, so you can see which strategy a
 * parameter helps or hurts.
 */
export function Sensitivity({
  strategies,
  profiles,
  settings,
  perPair,
  configVersion,
}: {
  strategies: Strategy[];
  profiles: [RobotProfile, RobotProfile];
  settings: GameSettings;
  perPair: number;
  configVersion: number;
}) {
  const [paramId, setParamId] = useState("profile.driveSpeed");
  const param = paramById(paramId) ?? SWEEP_PARAMS[0];
  const [steps, setSteps] = useState(5);
  const [matchesPerPair, setMatchesPerPair] = useState(perPair);
  const [metricId, setMetricId] = useState("win");
  const [showAll, setShowAll] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [points, setPoints] = useState<SweepPoint[] | null>(null);
  const [ranParam, setRanParam] = useState<SweepParam | null>(null);
  const [ranVersion, setRanVersion] = useState(0);
  const [ranCount, setRanCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const current = (param.target === "profile" ? profiles[0][param.key as keyof RobotProfile] : settings[param.key as keyof GameSettings]) as number;
  const values = useMemo(() => sweepValues(param, steps, current), [param, steps, current]);
  const metric = metricById(metricId);
  const totalMatches = values.length * strategies.length * strategies.length * Math.ceil(matchesPerPair / 2);

  const run = async () => {
    if (strategies.length < 2) return;
    const id = ++runId.current;
    setRunning(true);
    setError(null);
    setProgress(0);
    try {
      const res = await runSweep(
        { strategies, profiles, settings, matchesPerPair, seed: SEED },
        param,
        values,
        (d, t) => {
          if (id === runId.current) setProgress(d / t);
        },
        () => id !== runId.current,
      );
      if (res && id === runId.current) {
        setPoints(res);
        setRanParam(param);
        setRanVersion(configVersion);
        setRanCount(strategies.length);
        track("sensitivity_run", {
          parameter: param.id,
          values: values.length,
          matches_per_pair: matchesPerPair,
          strategies: strategies.length,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === runId.current) setRunning(false);
    }
  };

  const cancel = () => {
    runId.current += 1;
    setRunning(false);
  };

  const buildData = (m: Metric) =>
    (points ?? []).map((pt) => {
      const row: Record<string, number> = { value: pt.value };
      for (const s of strategies) {
        const stat = pt.stats.find((x) => x.id === s.id);
        if (stat) row[s.id] = m.get(stat);
      }
      return row;
    });

  const stale = points != null && (ranVersion !== configVersion || ranCount !== strategies.length);
  const paramChanged = points != null && ranParam != null && ranParam.id !== paramId;

  /** Y range is exactly the data's min and max, so small differences fill the chart instead of hugging zero. */
  const yDomain = (rows: Record<string, number>[], keys: string[]): [number, number] => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of rows) {
      for (const k of keys) {
        const v = row[k];
        if (typeof v === "number" && Number.isFinite(v)) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
    if (hi === lo) return [lo - 1, hi + 1];
    return [lo, hi];
  };

  const chart = (m: Metric, swept: SweepParam, height: number) => {
    const rows = ranParam ? buildData(m) : [];
    const domain = yDomain(
      rows,
      strategies.map((s) => s.id),
    );
    return (
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: 0, right: 12, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
            <XAxis dataKey="value" type="number" domain={[swept.min, swept.max]} tickFormatter={swept.format} fontSize={11} />
            <YAxis fontSize={11} tickFormatter={m.format} width={52} domain={domain} />
            <Tooltip contentStyle={{ fontSize: 12 }} labelFormatter={(v) => `${swept.label}: ${swept.format(Number(v))}`} />
            {height > 200 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {strategies.map((s, i) => (
              <Line key={s.id} dataKey={s.id} name={s.name} stroke={PALETTE[i % PALETTE.length]} dot={height > 200} strokeWidth={1.75} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Parameter sweep</CardTitle>
        <CardDescription>
          Move one parameter across a range and re-run the whole showdown at each value (same matches, same seeds, so only the
          parameter changes). Each point is a full batch averaged the same way as a normal run, with one line per strategy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Parameter</span>
            <Select value={paramId} onValueChange={(v) => v && setParamId(v)}>
              <SelectTrigger className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Robot (both robots)</SelectLabel>
                  {SWEEP_PARAMS.filter((p) => p.target === "profile").map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Game assumptions</SelectLabel>
                  {SWEEP_PARAMS.filter((p) => p.target === "settings").map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Values</span>
            <Select value={String(steps)} onValueChange={(v) => v && setSteps(Number(v))}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Matches per pairing</span>
            <Select value={String(matchesPerPair)} onValueChange={(v) => v && setMatchesPerPair(Number(v))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PER_PAIR_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {running ? (
            <Button variant="outline" onClick={cancel} className="max-sm:h-10 max-sm:w-full">
              <X /> Cancel
            </Button>
          ) : (
            <Button onClick={run} disabled={strategies.length < 2} className="max-sm:h-10 max-sm:w-full">
              <Play /> Run sweep
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>Current {param.format(current)} →</span>
          {values.map((v) => (
            <span key={v} className="rounded-full border px-2 py-0.5 tabular-nums">
              {param.format(v)}
            </span>
          ))}
          <span className="ml-1">· {totalMatches.toLocaleString()} matches total</span>
        </div>

        {strategies.length < 2 && <p className="text-xs text-destructive">Pick at least two strategies above.</p>}
        {stale && !running && <Badge variant="outline" className="border-amber-500 text-amber-600">Sliders changed, rerun to update</Badge>}
        {paramChanged && !running && (
          <p className="text-xs text-muted-foreground">Showing the last sweep of {ranParam?.label}. Press Run sweep to chart {param.label}.</p>
        )}
        {running && <Progress value={progress * 100} />}
        {error && <p className="text-sm text-destructive">Sweep failed: {error}</p>}

        {points && ranParam && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Metric</span>
                <Select value={metricId} onValueChange={(v) => v && setMetricId(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRICS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Show all metrics
                <Switch checked={showAll} onCheckedChange={setShowAll} />
              </div>
            </div>

            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-sm">
                  {metric.label} vs {ranParam.label}
                </CardTitle>
                <CardDescription>Each point is one full showdown batch at that value, averaged over all matches.</CardDescription>
              </CardHeader>
              <CardContent>{chart(metric, ranParam, 340)}</CardContent>
            </Card>

            {showAll && (
              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                {METRICS.map((m) => (
                  <Card key={m.id} size="sm">
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {m.label} vs {ranParam.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>{chart(m, ranParam, 180)}</CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}