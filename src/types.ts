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
}

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
}

export const DEFAULT_SETTINGS: Settings = {
  weightUnit: 'kg',
  distanceUnit: 'km',
  defaultRest: 90,
  sound: true,
  keepAwake: true,
  showRpe: false,
};
