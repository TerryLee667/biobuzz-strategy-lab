/**
 * The numeric bounds of every slider in the robot and game editors, in one place.
 *
 * The editors read min/max/step from here, and the parameter sweep builds its value lists from the
 * same numbers, so a sweep can never quietly drift away from the range the slider allows. Labels and
 * formats live here too so the sweep can display a parameter without the editor.
 */

export interface NumField {
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const secs = (v: number) => `${v.toFixed(2)} s`;

/** Numeric RobotProfile fields, mirroring the sliders in profile-editor.tsx. */
export const PROFILE_FIELDS: Record<
  | "widthIn"
  | "lengthIn"
  | "heightIn"
  | "weightLb"
  | "acceleration"
  | "intakeWidth"
  | "capacity"
  | "shotSpeed"
  | "launchHeightIn"
  | "driveSpeed"
  | "intakeTime"
  | "launchTime"
  | "alignTime"
  | "flowerTime"
  | "launchRange"
  | "pollenAccuracy"
  | "nectarAccuracy"
  | "flowerAccuracy"
  | "autoReliability"
  | "autoSpeed",
  NumField
> = {
  widthIn: { label: "Width", min: 10, max: 18, step: 0.5, format: (v) => `${v.toFixed(1)} in` },
  lengthIn: { label: "Length", min: 10, max: 18, step: 0.5, format: (v) => `${v.toFixed(1)} in` },
  heightIn: { label: "Height when extended", min: 12, max: 29, step: 1, format: (v) => `${v.toFixed(0)} in` },
  weightLb: { label: "Weight", min: 8, max: 42, step: 1, format: (v) => `${v.toFixed(0)} lb` },
  acceleration: { label: "Acceleration", min: 2, max: 20, step: 0.5, format: (v) => `${v.toFixed(1)} ft/s²` },
  intakeWidth: { label: "Intake width", min: 0.25, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}% of front` },
  capacity: { label: "Carry capacity", min: 1, max: 4, step: 1, format: (v) => `${v.toFixed(0)} elements` },
  shotSpeed: { label: "Shot speed", min: 14, max: 40, step: 1, format: (v) => `${v.toFixed(0)} ft/s` },
  launchHeightIn: { label: "Launcher height", min: 8, max: 28, step: 0.5, format: (v) => `${v.toFixed(1)} in` },
  driveSpeed: { label: "Drive speed", min: 1.5, max: 10, step: 0.25, format: (v) => `${v.toFixed(2)} ft/s` },
  intakeTime: { label: "Intake time / element", min: 0.05, max: 1.5, step: 0.05, format: secs },
  launchTime: { label: "Launch time / element", min: 0.05, max: 2, step: 0.05, format: secs },
  alignTime: { label: "Align / aim per trip", min: 0, max: 3, step: 0.05, format: secs },
  flowerTime: { label: "FLOWER place time / element", min: 0.3, max: 5, step: 0.1, format: secs },
  launchRange: { label: "Launch range", min: 2.5, max: 10, step: 0.25, format: (v) => `${v.toFixed(2)} ft` },
  pollenAccuracy: { label: "POLLEN launch accuracy", min: 0.2, max: 1, step: 0.01, format: pct },
  nectarAccuracy: { label: "NECTAR launch accuracy", min: 0.2, max: 1, step: 0.01, format: pct },
  flowerAccuracy: { label: "FLOWER placement accuracy", min: 0.2, max: 1, step: 0.01, format: pct },
  autoReliability: { label: "AUTO reliability", min: 0, max: 1, step: 0.01, format: pct },
  autoSpeed: { label: "AUTO speed vs TELEOP", min: 0.2, max: 1, step: 0.05, format: pct },
};

/** Numeric GameSettings fields, mirroring the sliders in profile-editor.tsx. */
export const SETTINGS_FIELDS: Record<
  "tipThreshold" | "tipVariance" | "nectarWeight" | "flowerCapacity" | "defenseEffect" | "blockChance" | "tipSpinTime" | "cellHeight" | "ballFriction",
  NumField
> = {
  tipThreshold: { label: "Tip threshold (POLLEN units)", min: 4, max: 12, step: 0.1, format: (v) => v.toFixed(1) },
  tipVariance: { label: "Tip threshold variance", min: 0, max: 1.5, step: 0.05, format: (v) => `±${v.toFixed(2)}` },
  nectarWeight: { label: "NECTAR weight (POLLEN units)", min: 1, max: 3, step: 0.01, format: (v) => v.toFixed(2) },
  flowerCapacity: { label: "Scoring volume capacity", min: 2, max: 10, step: 1, format: (v) => `${v} elements` },
  defenseEffect: { label: "Defense push effect", min: 0, max: 0.9, step: 0.05, format: pct },
  blockChance: { label: "Blocked shot knocked down", min: 0, max: 1, step: 0.05, format: pct },
  tipSpinTime: { label: "HIVE spin before it dumps", min: 0.2, max: 2.5, step: 0.1, format: secs },
  cellHeight: { label: "CELL drop height", min: 1, max: 6, step: 0.1, format: (v) => `${v.toFixed(1)} ft` },
  ballFriction: { label: "Tile friction", min: 0.5, max: 8, step: 0.1, format: (v) => `${v.toFixed(1)} ft/s²` },
};