# Job Tracker

A personal job-application tracker for Android — track every application through
your pipeline, see stats, and keep an editable status timeline per application.

Built as a **Capacitor** app: a React + Vite web app wrapped in a thin native
Android shell, with **Supabase** for auth and data. Ships as a sideloaded APK
(no Play Store) and updates itself via **GitHub Releases**.

---

## Features

- **Email + password auth** (Supabase) — your data is private per user via Row Level Security.
- **Applications list** — company, role, salary, status pill, date; deterministic colored avatars.
- **Multi-select status filter** with live counts.
- **Stats** — totals, "in progress", and a per-status breakdown with bars.
- **Application details** with a deliberate two-step **status changer** and an **editable status timeline** (history is always sorted by date; the current status is the latest-dated entry).
- **Add / edit / delete** with sources (Djinni, DOU, LinkedIn, Telegram, custom), notes, contact (tap to copy / email), job link.
- **Salary privacy** toggle (masks all salaries; remembered across launches).
- **In-app update check** — on launch, compares the latest GitHub Release tag to the installed version and shows an "Update available" banner.
- Dark UI, bundled fonts (Manrope + Space Grotesk), offline-capable shell, safe-area aware.

## Tech stack

| Layer | Tech |
|---|---|
| UI | React 19 + Vite |
| Native wrapper | Capacitor 8 (Android) |
| Backend | Supabase (Postgres + Auth + RLS) |
| Build/release | Gradle, GitHub Actions |

---

## Getting started (development)

**Prerequisites:** Node 18+, JDK 21 (Android builds), Android Studio + SDK.

```bash
npm install
```

### 1. Configure Supabase
Open `src/App.jsx` and set your project URL and **publishable** key:

```js
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_...";   // publishable key only — never the secret key
```

In Supabase:
- **Authentication → Providers → Email** — enable it (turn *Confirm email* off for instant sign-in).
- **SQL Editor** — run [`supabase/schema.sql`](supabase/schema.sql) to create the `applications` table with Row Level Security.

> The publishable key is safe to ship in the client; RLS is what protects data.
> The `sb_secret_…` key must never be placed in the app.

### 2. Run the web app
```bash
npm run dev        # Vite dev server in the browser
```

### 3. Run on Android
```bash
npm run sync       # vite build + copy web assets into android/
npx cap open android
```
Then Run from Android Studio (or `./gradlew assembleDebug` and install the APK).

---

## Building an APK

```bash
# Debug (for the emulator / quick sideload)
npm run sync && cd android && ./gradlew assembleDebug
#   → android/app/build/outputs/apk/debug/app-debug.apk

# Signed release (production)
npm run sync && cd android && ./gradlew assembleRelease
#   → android/app/build/outputs/apk/release/app-release.apk
```

Release signing reads `android/keystore.properties` (git-ignored). Create the
keystore once and point `keystore.properties` at it:

```bash
keytool -genkeypair -v -keystore jobtracker-release.keystore -alias jobtracker \
  -keyalg RSA -keysize 2048 -validity 10000
cp android/keystore.properties.example android/keystore.properties   # then fill in the password
```

---

## Releasing updates (OTA via GitHub Releases)

`main` is the production branch. Versioning is **semver** (`major.minor.patch`),
defined in `src/version.js` (`APP_VERSION`). The integer Android `versionCode`
is derived as `major*10000 + minor*100 + patch`.

To ship a new version:
1. Bump `APP_VERSION` in `src/version.js` (e.g. `1.0.1`).
2. Commit and push to `main`.

On every push to `main`, the [release workflow](.github/workflows/release.yml):
1. reads the version from `src/version.js` and stamps `build.gradle`,
2. builds and **signs** the release APK,
3. publishes / updates the GitHub Release `vX.Y.Z` (and uploads the APK as a run artifact).

On next launch, phones on an older version show an **"Update available"** banner
that opens the new APK to install.

### Branches / channels

| Branch | Build | appId | Name | Release |
|---|---|---|---|---|
| `main` | production | `com.jobtracker.app` | Job Tracker | `vX.Y.Z` |
| `develop` | dev / WIP | `com.jobtracker.app.dev` | Job Tracker Dev | rolling pre-release `develop` |

Different appIds mean the **dev and prod apps install side by side** on one phone.
Push to `develop` to publish a fresh dev APK (the `develop` pre-release); push to
`main` for a production release. The dev build has the in-app update banner
disabled (it points at prod releases).

### Required GitHub secrets
Set these in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | base64 of your `jobtracker-release.keystore` |
| `KEYSTORE_PASSWORD` | the keystore password |

And set `GITHUB_REPO` in `src/App.jsx` to your `owner/repo` so the app knows
where to check for releases.

---

## Project structure

```
src/                 React app (App.jsx = all screens, version.js)
index.html           Vite entry
supabase/schema.sql  Database table + RLS policies
android/             Capacitor native Android project
.github/workflows/   release.yml — build + sign + publish APK on tag
capacitor.config.json
```

## Notes

- **App ID:** `com.jobtracker.app` · **App name:** Job Tracker
- This is a personal/sideload app — not published to the Play Store.
