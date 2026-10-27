export type ExerciseType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'weighted_bodyweight'
  | 'assisted_bodyweight'
  | 'duration'
  | 'distance_duration'
  | 'weight_distance'
  | 'weight_duration';

export interface Exercise {
  id: string;
  name: string;
  muscle: string;
  secondary: string[];
  equipment: string;
  type: ExerciseType;
  img?: string;
  alt?: string;
  popular?: boolean;
  stretch?: boolean;
  custom?: boolean;
  /** how the weight is logged for dumbbell / cable exercises (affects ranks) */
  load?: LoadSetup;
}

export interface LoadSetup {
  /** 'one' = weight of one dumbbell / one handle, 'both' = both sides added together */
  side?: 'one' | 'both';
  /** cable pulley ratio: 2 means the stack feels half as heavy (2:1) */
  pulley?: number;
}

export type SetType = 'normal' | 'warmup' | 'failure' | 'drop';

export interface WSet {
  id: string;
  type: SetType;
  /** kg (always stored metric) */
  weight?: number | null;
  reps?: number | null;
  /** seconds */
  duration?: number | null;
  /** meters */
  distance?: number | null;
  rpe?: number | null;
  done: boolean;
  /** active workout only: routine target / previous values shown as placeholders */
  ph?: Partial<Pick<WSet, 'weight' | 'reps' | 'duration' | 'distance'>>;
}

export interface WExercise {
  id: string;
  exerciseId: string;
  supersetId?: string | null;
  notes?: string;
  /** rest seconds; null/undefined = use default from settings */
  restSec?: number | null;
  sets: WSet[];
}

export interface Workout {
  id: string;
  name: string;
  routineId?: string | null;
  start: number;
  end: number;
  notes?: string;
  exercises: WExercise[];
  /** derived, for indexing */
  exerciseIds: string[];
  source?: 'hevy';
  /** small JPEG data URLs */
  photos?: string[];
  /** friends tagged in this workout */
  tagged?: { uid: string; nick: string }[];
  /** how satisfied the lifter was, 1–10 */
  rating?: number | null;
}

export const MEASURE_FIELDS = ['weight', 'bodyFat', 'waist', 'chest', 'hips', 'shoulders', 'arms', 'thighs', 'calves', 'neck'] as const;
export type MeasureField = (typeof MEASURE_FIELDS)[number];

/** Body measurement entry. Weight in kg, lengths in cm, body fat in %. */
export type Measure = { id: string; date: number } & Partial<Record<MeasureField, number | null>>;

export interface Routine {
  id: string;
  name: string;
  folderId?: string | null;
  order: number;
  notes?: string;
  exercises: WExercise[];
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
}

export interface ActiveWorkout {
  workout: Omit<Workout, 'end' | 'exerciseIds'>;
  rest: { endAt: number; duration: number } | null;
}

export interface Settings {
  weightUnit: 'kg' | 'lbs';
  distanceUnit: 'km' | 'mi';
  defaultRest: number;
  sound: boolean;
  keepAwake: boolean;
  showRpe: boolean;
  haptics: boolean;
  name: string;
  /** profile picture as a small JPEG data URL */
  avatar?: string | null;
  /** equipped avatar decoration */
  deco?: string | null;
  /** decorations unlocked so far (kept even if a rank later drops) */
  decos?: string[];
  /** used for strength ranks */
  sex?: 'male' | 'female' | null;
  theme: ThemeId;
  /** overall look: typography, shapes and decoration */
  style: StyleId;
  /** light / dark surfaces */
  mode: ModeId;
  textSize?: 'sm' | 'md' | 'lg';
  /** coloured glow at the top of pages */
  glow?: boolean;
  /** film grain: auto = only in the Raw style */
  grain?: 'auto' | 'on' | 'off';
  /** labels under the tab-bar icons */
  tabLabels?: boolean;
  /** what the Home screen says at the top */
  headline?: 'greeting' | 'motto' | 'date';
  motto?: string;
  /** confetti and fanfare sounds */
  celebrations?: boolean;
  /** calmer UI: fewer and shorter animations */
  reduceMotion?: boolean;
  /** profile needs approval to follow */
  privateProfile?: boolean;
  /** UI language ('auto' = phone language) */
  lang?: string;
  /** chose to use the app without an account */
  guest?: boolean;
  /** finished the welcome / setup flow */
  onboarded?: boolean;
  /** has shared a routine (unlocks a decoration) */
  shared?: boolean;
}

export type StyleId = 'raw' | 'elegant' | 'minimal' | 'playful' | 'cyber' | 'frost' | 'tactical' | 'brutal' | 'terminal';
export type ModeId = 'dark' | 'amoled' | 'dim' | 'light';

export type ThemeId = 'blood' | 'inferno' | 'gold' | 'toxic' | 'steel' | 'cobalt' | 'venom' | 'pump' | 'ocean' | 'mint' | 'royal' | 'sunset' | 'forest' | 'ice' | 'mono' | 'coffee';

export const DEFAULT_SETTINGS: Settings = {
  weightUnit: 'kg',
  distanceUnit: 'km',
  defaultRest: 90,
  sound: true,
  keepAwake: true,
  showRpe: false,
  haptics: true,
  name: '',
  avatar: null,
  sex: null,
  theme: 'blood',
  style: 'raw',
  mode: 'dark',
};
