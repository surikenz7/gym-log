# Gym Log

A free, offline-first workout tracker in the spirit of Hevy: unlimited routines, set logging
(weight/reps, bodyweight, time, distance), warm-up/drop/failure sets, supersets, rest timer,
personal records, progress charts, and Hevy CSV import. No account, no server: data lives on the device.

Installed on iPhone as a PWA: open the site in Safari → Share → **Add to Home Screen**.

## Development

```sh
npm install
npm run dev        # http://localhost:5173/gym-log/
npm test           # unit tests (Hevy import, units, PR math)
npm run build      # production build in dist/
npm run exercises  # regenerate src/data from free-exercise-db
node scripts/icons.mjs  # regenerate PNG icons from public/favicon.svg
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`
(repo Settings → Pages → Source: **GitHub Actions**). The Vite `base` is `/gym-log/`, so the
repository must be named `gym-log` (or change `base` in `vite.config.ts`).

## Data

- Storage: IndexedDB via Dexie (`src/db/db.ts`). Weights are stored in kg, distances in meters, times in seconds.
- Backup: Profile → Settings → Export backup (JSON) / Restore from backup.
- Exercise library: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain),
  with Hevy-style names for ~100 common exercises (`scripts/build-exercises.mjs`).
