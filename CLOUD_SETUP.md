# Cloud accounts (Firebase) — one-time setup

Accounts, cloud backup and friends use a free Firebase project (Spark plan, no card needed).

## 1. Create the project
1. Go to https://console.firebase.google.com and sign in with a Google account.
2. **Create a project** → name it `gym-log` → you can switch Google Analytics **off** → Create.

## 2. Turn on nickname + password login
1. Left menu **Build → Authentication → Get started**.
2. **Sign-in method → Email/Password → Enable** (only the first switch) → Save.
   The app turns a nickname into a login like `nick@users.gym-log.app`; no real email is used.

## 3. Create the database
1. **Build → Firestore Database → Create database**.
2. Pick a location close to you (e.g. `eur3 (europe-west)`), start in **production mode**.
3. Open the **Rules** tab, replace everything with the rules below, **Publish**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // public profile: signed-in users can see it, only you can change it
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;

      // workouts and routines are visible to signed-in friends
      match /workouts/{id} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && request.auth.uid == uid;
      }
      match /routines/{id} {
        allow read: if request.auth != null;
        allow write: if request.auth != null && request.auth.uid == uid;
      }
      // measurements, settings, custom exercises: only you
      match /private/{id} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

## 4. Register the web app and copy its settings
1. Project overview (⚙️ next to it) → **Project settings** → **Your apps** → the **`</>`** (Web) icon.
2. Nickname `gym-log`, don't tick Hosting → **Register app**.
3. You'll see `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`.
   Copy those values into `src/cloud/config.ts` (or send them to whoever maintains the app).
   They identify the project and are safe to publish; the rules above protect the data.

## 5. Allow the site
**Authentication → Settings → Authorized domains → Add domain** → `surikenz7.github.io`.

Push the change; after the update the app shows **Settings → Account → Create account**.

Free plan limits (plenty for a group of friends): 50,000 document reads and 20,000 writes per day, 1 GB stored.
