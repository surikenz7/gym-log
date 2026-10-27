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
    function signedIn() { return request.auth != null; }
    function me() { return request.auth.uid; }
    function isPrivate(uid) {
      return get(/databases/$(database)/documents/users/$(uid)).data.get('private', false) == true;
    }
    function approved(uid) {
      let f = /databases/$(database)/documents/users/$(uid)/followers/$(request.auth.uid);
      return exists(f) && get(f).data.status == 'accepted';
    }
    function canSee(uid) { return signedIn() && (me() == uid || !isPrivate(uid) || approved(uid)); }

    match /users/{uid} {
      // public profile card (name, picture, level, rank) — like Instagram, visible even if private
      allow read: if signedIn();
      allow write: if signedIn() && me() == uid;

      // workouts and routines: public profiles → everyone signed in, private → approved followers
      match /workouts/{id} {
        allow read: if canSee(uid);
        allow write: if signedIn() && me() == uid;
      }
      match /routines/{id} {
        allow read: if canSee(uid);
        allow write: if signedIn() && me() == uid;
      }
      // measurements, settings, custom exercises: only you
      match /private/{id} {
        allow read, write: if signedIn() && me() == uid;
      }
      // followers / follow requests
      match /followers/{fid} {
        allow read: if signedIn();
        allow create: if signedIn() && me() == fid && (request.resource.data.status == 'pending' || !isPrivate(uid));
        allow update: if signedIn() && me() == uid;
        allow delete: if signedIn() && (me() == uid || me() == fid);
      }
      // activity: tags, new followers, accepted requests
      match /inbox/{id} {
        allow read, update, delete: if signedIn() && me() == uid;
        allow create: if signedIn() && request.resource.data.from == me();
      }
    }

    // direct messages and snaps between two people
    match /chats/{cid} {
      allow read: if signedIn() && (resource == null || me() in resource.data.members);
      allow create: if signedIn() && me() in request.resource.data.members && request.resource.data.members.size() == 2;
      allow update: if signedIn() && me() in resource.data.members;
      match /messages/{mid} {
        allow read, update, delete: if signedIn() && me() in get(/databases/$(database)/documents/chats/$(cid)).data.members;
        allow create: if signedIn() && request.resource.data.from == me()
          && me() in get(/databases/$(database)/documents/chats/$(cid)).data.members;
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
