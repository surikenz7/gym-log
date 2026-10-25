// Builds src/data/exercises.json + src/data/instructions.json from free-exercise-db (public domain).
// Usage: node scripts/build-exercises.mjs   (downloads the source if scripts/raw-exercises.json is missing)
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const rawPath = path.resolve('scripts/raw-exercises.json');
if (!fs.existsSync(rawPath)) {
  const res = await fetch(SRC);
  fs.writeFileSync(rawPath, await res.text());
}
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));

const MUSCLE = {
  abdominals: 'Abs', hamstrings: 'Hamstrings', adductors: 'Adductors', quadriceps: 'Quadriceps',
  biceps: 'Biceps', shoulders: 'Shoulders', chest: 'Chest', 'middle back': 'Upper Back',
  calves: 'Calves', glutes: 'Glutes', 'lower back': 'Lower Back', lats: 'Lats', triceps: 'Triceps',
  traps: 'Traps', forearms: 'Forearms', neck: 'Neck', abductors: 'Abductors',
};
const EQUIP = {
  'body only': 'None', machine: 'Machine', other: 'Other', 'foam roll': 'Foam Roller', kettlebells: 'Kettlebell',
  dumbbell: 'Dumbbell', cable: 'Cable', barbell: 'Barbell', bands: 'Resistance Band',
  'medicine ball': 'Medicine Ball', 'exercise ball': 'Exercise Ball', 'e-z curl bar': 'EZ Bar',
};

// Hevy-style names for the most common exercises (also used to match Hevy CSV imports).
const POPULAR = {
  'Barbell_Bench_Press_-_Medium_Grip': 'Bench Press (Barbell)',
  Dumbbell_Bench_Press: 'Bench Press (Dumbbell)',
  'Barbell_Incline_Bench_Press_-_Medium_Grip': 'Incline Bench Press (Barbell)',
  Incline_Dumbbell_Press: 'Incline Bench Press (Dumbbell)',
  Decline_Barbell_Bench_Press: 'Decline Bench Press (Barbell)',
  Smith_Machine_Bench_Press: 'Bench Press (Smith Machine)',
  Smith_Machine_Incline_Bench_Press: 'Incline Bench Press (Smith Machine)',
  'Close-Grip_Barbell_Bench_Press': 'Bench Press - Close Grip (Barbell)',
  Machine_Bench_Press: 'Chest Press (Machine)',
  Leverage_Incline_Chest_Press: 'Incline Chest Press (Machine)',
  Dumbbell_Flyes: 'Chest Fly (Dumbbell)',
  Butterfly: 'Butterfly (Pec Deck)',
  Cable_Crossover: 'Cable Fly Crossovers',
  'Dips_-_Chest_Version': 'Chest Dip',
  Pushups: 'Push Up',
  Barbell_Squat: 'Squat (Barbell)',
  Front_Barbell_Squat: 'Front Squat',
  Goblet_Squat: 'Goblet Squat',
  Hack_Squat: 'Hack Squat (Machine)',
  Smith_Machine_Squat: 'Squat (Smith Machine)',
  Leg_Press: 'Leg Press (Machine)',
  Barbell_Deadlift: 'Deadlift (Barbell)',
  Romanian_Deadlift: 'Romanian Deadlift (Barbell)',
  'Stiff-Legged_Dumbbell_Deadlift': 'Romanian Deadlift (Dumbbell)',
  Sumo_Deadlift: 'Sumo Deadlift',
  Trap_Bar_Deadlift: 'Trap Bar Deadlift',
  Barbell_Hip_Thrust: 'Hip Thrust (Barbell)',
  Barbell_Glute_Bridge: 'Glute Bridge',
  Dumbbell_Lunges: 'Lunge (Dumbbell)',
  Barbell_Lunge: 'Lunge (Barbell)',
  Bodyweight_Walking_Lunge: 'Walking Lunge',
  Split_Squat_with_Dumbbells: 'Split Squat (Dumbbell)',
  Leg_Extensions: 'Leg Extension (Machine)',
  Lying_Leg_Curls: 'Lying Leg Curl (Machine)',
  Seated_Leg_Curl: 'Seated Leg Curl (Machine)',
  Standing_Calf_Raises: 'Standing Calf Raise (Machine)',
  Seated_Calf_Raise: 'Seated Calf Raise',
  Thigh_Adductor: 'Hip Adduction (Machine)',
  Thigh_Abductor: 'Hip Abduction (Machine)',
  Good_Morning: 'Good Morning (Barbell)',
  Hyperextensions_Back_Extensions: 'Back Extension (Hyperextension)',
  'Wide-Grip_Lat_Pulldown': 'Lat Pulldown (Cable)',
  'Close-Grip_Front_Lat_Pulldown': 'Lat Pulldown - Close Grip (Cable)',
  Seated_Cable_Rows: 'Seated Cable Row - V Grip (Cable)',
  Bent_Over_Barbell_Row: 'Bent Over Row (Barbell)',
  'One-Arm_Dumbbell_Row': 'Dumbbell Row',
  'T-Bar_Row_with_Handle': 'T Bar Row',
  Leverage_Iso_Row: 'Seated Row (Machine)',
  Pullups: 'Pull Up',
  'Chin-Up': 'Chin Up',
  'Band_Assisted_Pull-Up': 'Pull Up (Assisted)',
  'Straight-Arm_Pulldown': 'Straight Arm Lat Pulldown (Cable)',
  Face_Pull: 'Face Pull',
  Standing_Military_Press: 'Overhead Press (Barbell)',
  Seated_Barbell_Military_Press: 'Seated Overhead Press (Barbell)',
  Dumbbell_Shoulder_Press: 'Shoulder Press (Dumbbell)',
  Machine_Shoulder_Military_Press: 'Shoulder Press (Machine)',
  Arnold_Dumbbell_Press: 'Arnold Press (Dumbbell)',
  Side_Lateral_Raise: 'Lateral Raise (Dumbbell)',
  Cable_Seated_Lateral_Raise: 'Lateral Raise (Cable)',
  Front_Dumbbell_Raise: 'Front Raise (Dumbbell)',
  Reverse_Machine_Flyes: 'Rear Delt Reverse Fly (Machine)',
  Reverse_Flyes: 'Rear Delt Reverse Fly (Dumbbell)',
  Upright_Barbell_Row: 'Upright Row (Barbell)',
  Barbell_Shrug: 'Shrug (Barbell)',
  Dumbbell_Shrug: 'Shrug (Dumbbell)',
  Barbell_Curl: 'Bicep Curl (Barbell)',
  Dumbbell_Bicep_Curl: 'Bicep Curl (Dumbbell)',
  Standing_Biceps_Cable_Curl: 'Bicep Curl (Cable)',
  'EZ-Bar_Curl': 'EZ Bar Biceps Curl',
  Hammer_Curls: 'Hammer Curl (Dumbbell)',
  Preacher_Curl: 'Preacher Curl (Barbell)',
  Machine_Preacher_Curls: 'Preacher Curl (Machine)',
  Concentration_Curls: 'Concentration Curl',
  Incline_Dumbbell_Curl: 'Seated Incline Curl (Dumbbell)',
  Triceps_Pushdown: 'Triceps Pushdown',
  'Triceps_Pushdown_-_Rope_Attachment': 'Triceps Rope Pushdown',
  Cable_Rope_Overhead_Triceps_Extension: 'Overhead Triceps Extension (Cable)',
  Standing_Dumbbell_Triceps_Extension: 'Overhead Triceps Extension (Dumbbell)',
  'EZ-Bar_Skullcrusher': 'Skullcrusher (Barbell)',
  'Dips_-_Triceps_Version': 'Triceps Dip',
  Tricep_Dumbbell_Kickback: 'Triceps Kickback (Dumbbell)',
  Crunches: 'Crunch',
  Cable_Crunch: 'Cable Crunch',
  Hanging_Leg_Raise: 'Hanging Leg Raise',
  Russian_Twist: 'Russian Twist (Weighted)',
  Ab_Roller: 'Ab Wheel',
  Plank: 'Plank',
  Ab_Crunch_Machine: 'Crunch (Machine)',
  'One-Arm_Kettlebell_Swings': 'Kettlebell Swing',
  Running_Treadmill: 'Treadmill',
  Bicycling_Stationary: 'Cycling',
  Rowing_Stationary: 'Rowing Machine',
  Elliptical_Trainer: 'Elliptical Trainer',
  Stairmaster: 'Stair Machine',
  Rope_Jumping: 'Jump Rope',
  Farmers_Walk: "Farmer's Walk",
};

const WEIGHTED_BW = new Set(['Pullups', 'Chin-Up', 'Dips_-_Chest_Version', 'Dips_-_Triceps_Version', 'Parallel_Bar_Dip', 'Muscle_Up', 'Hanging_Leg_Raise']);
const DURATION = new Set(['Plank', 'Rope_Jumping', 'Stairmaster', 'Battling_Ropes', 'Superman']);

function typeFor(e) {
  if (DURATION.has(e.id)) return 'duration';
  if (/assisted/i.test(e.name)) return 'assisted_bodyweight';
  if (WEIGHTED_BW.has(e.id)) return 'weighted_bodyweight';
  if (e.category === 'cardio') return 'distance_duration';
  if (e.category === 'stretching' || e.equipment === 'foam roll') return 'duration';
  if (e.category === 'strongman' && /walk|carry|drag|yoke|sled push|prowler/i.test(e.name)) return 'weight_distance';
  if (e.force === 'static' && (e.equipment === 'body only' || !e.equipment)) return 'duration';
  if (e.equipment === 'body only' || (!e.equipment && e.category !== 'strength')) return 'bodyweight_reps';
  return 'weight_reps';
}

const exercises = [];
const instructions = {};
for (const e of raw) {
  const hevy = POPULAR[e.id];
  const out = {
    id: e.id,
    name: hevy ?? e.name,
    muscle: e.category === 'cardio' ? 'Cardio' : MUSCLE[e.primaryMuscles[0]] ?? 'Other',
    secondary: [...e.primaryMuscles.slice(1), ...e.secondaryMuscles].map((m) => MUSCLE[m]).filter(Boolean),
    equipment: /smith/i.test(e.name) ? 'Smith Machine' : EQUIP[e.equipment] ?? 'None',
    type: typeFor(e),
    img: e.images.length ? e.images[0].split('/')[0] : undefined,
  };
  if (hevy) {
    out.alt = e.name;
    out.popular = true;
  }
  if (e.category === 'stretching') out.stretch = true;
  exercises.push(out);
  instructions[e.id] = e.instructions;
}

// Common gym exercises missing from the source DB (no images).
const EXTRA = [
  ['x_bulgarian_split_squat', 'Bulgarian Split Squat', 'Quadriceps', ['Glutes', 'Hamstrings'], 'Dumbbell', 'weight_reps'],
  ['x_pendlay_row', 'Pendlay Row (Barbell)', 'Upper Back', ['Lats', 'Biceps'], 'Barbell', 'weight_reps'],
  ['x_hip_thrust_machine', 'Hip Thrust (Machine)', 'Glutes', ['Hamstrings'], 'Machine', 'weight_reps'],
  ['x_burpee', 'Burpee', 'Cardio', ['Chest', 'Quadriceps'], 'None', 'bodyweight_reps'],
  ['x_jumping_jack', 'Jumping Jack', 'Cardio', [], 'None', 'bodyweight_reps'],
  ['x_side_plank', 'Side Plank', 'Abs', [], 'None', 'duration'],
  ['x_wall_sit', 'Wall Sit', 'Quadriceps', ['Glutes'], 'None', 'duration'],
  ['x_dead_hang', 'Dead Hang', 'Forearms', ['Lats'], 'None', 'duration'],
  ['x_incline_walk', 'Incline Walk (Treadmill)', 'Cardio', [], 'Machine', 'distance_duration'],
  ['x_running', 'Running', 'Cardio', [], 'None', 'distance_duration'],
  ['x_cable_row_wide', 'Seated Cable Row - Bar Grip (Cable)', 'Upper Back', ['Lats', 'Biceps'], 'Cable', 'weight_reps'],
  ['x_leg_raise_lying', 'Lying Leg Raise', 'Abs', [], 'None', 'bodyweight_reps'],
  ['x_preacher_db', 'Preacher Curl (Dumbbell)', 'Biceps', [], 'Dumbbell', 'weight_reps'],
  ['x_reverse_lunge', 'Reverse Lunge (Dumbbell)', 'Quadriceps', ['Glutes'], 'Dumbbell', 'weight_reps'],
  ['x_cable_kickback', 'Glute Kickback (Cable)', 'Glutes', ['Hamstrings'], 'Cable', 'weight_reps'],
];
for (const [id, name, muscle, secondary, equipment, type] of EXTRA) {
  exercises.push({ id, name, muscle, secondary, equipment, type, popular: true });
}

exercises.sort((a, b) => a.name.localeCompare(b.name));
fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/exercises.json', JSON.stringify(exercises));
fs.writeFileSync('src/data/instructions.json', JSON.stringify(instructions));
const counts = {};
exercises.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));
console.log(`${exercises.length} exercises`, counts);
const missing = Object.keys(POPULAR).filter((id) => !raw.some((e) => e.id === id));
if (missing.length) console.warn('Missing POPULAR ids:', missing);
