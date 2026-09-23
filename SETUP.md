# MoneyLens — Setup & Build Guide

Everything needed to install, configure, run, and build the app from scratch.
Pair this with [ARCHITECTURE.md](ARCHITECTURE.md) (how it's wired) and
[FEATURES.md](FEATURES.md) (what it does).

---

## 1. Prerequisites
- **Node.js 18.18+** (Node 20 LTS recommended — `@types/node` is pinned to v20).
- **npm** (a `package-lock.json` is committed; use npm for reproducible installs).
- A **Firebase project** (free Spark plan is enough) with Email/Password + Google
  auth and Cloud Firestore enabled.

> ⚠️ **Non-standard Next.js.** Per `AGENTS.md`, this repo runs **Next.js 16.2.9**
> with **React 19** and breaking changes vs. older Next. Always check
> `node_modules/next/dist/docs/` before changing framework-level code. Do **not**
> assume App Router APIs behave like Next 13–15.

---

## 2. Tech Stack (exact versions from `package.json`)

### Runtime dependencies
| Package | Version | Role |
|---|---|---|
| `next` | 16.2.9 | App Router framework (RSC + client components). |
| `react` / `react-dom` | 19.2.4 | UI runtime. |
| `firebase` | ^10.12.0 | Auth + Firestore cloud sync. |
| `recharts` | ^2.12.7 | Charts (analytics, comparison, mood, what-if). |
| `lucide-react` | ^0.400.0 | Icon set. |
| `framer-motion` | ^11.2.10 | Animations. |
| `sonner` | ^2.0.7 | Toast notifications (`<Toaster/>` in root layout). |
| `nextjs-toploader` | ^3.9.17 | Top progress bar on route changes. |
| `dexie` | ^4.0.8 | IndexedDB wrapper (available for local persistence). |

### Dev dependencies
| Package | Version | Role |
|---|---|---|
| `typescript` | ^5 | Types (strict mode on). |
| `tailwindcss` + `@tailwindcss/postcss` | ^4 | Styling (Tailwind v4, PostCSS plugin). |
| `tw-animate-css` | ^1.4.0 | Tailwind animation utilities. |
| `eslint` + `eslint-config-next` | ^9 / 16.2.9 | Linting. |
| `@types/node`, `@types/react`, `@types/react-dom` | ^20 / ^19 / ^19 | Type defs. |
| `postcss` | ^8 | CSS pipeline. |

---

## 3. Install

```bash
npm install
```

---

## 4. Firebase Configuration (required to run)

The app reads Firebase config from **`NEXT_PUBLIC_`** env vars in
`src/config/firebase.ts`. Create a **`.env.local`** at the project root:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:abcdef
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

Get these values from **Firebase Console → Project settings → Your apps → Web app**.

### Support contact (optional)

The Help page's WhatsApp and Call buttons dial whatever number this is set to,
in E.164 format:

```bash
NEXT_PUBLIC_SUPPORT_PHONE=+911234567890
```

Leave it unset and the two contact cards are hidden — the FAQs still render. It
is deliberately not defaulted: a placeholder number here is a live link that
sends real users to a stranger.

Like all `NEXT_PUBLIC_` values it is baked in at build time, so changing it
requires a rebuild.

### In the Firebase console, enable:
1. **Authentication → Sign-in method** → enable **Email/Password** and **Google**.
2. **Firestore Database** → create a database (production or test mode).
3. **Firestore security rules** — lock data to its owner. Each user only ever
   touches `users/{uid}/...`:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

> The client uses Firestore **persistent multi-tab cache**
> (`persistentLocalCache` + `persistentMultipleTabManager`) so data is available
> offline and synced across tabs automatically.

---

## 5. Run / Build / Lint

```bash
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # run ESLint
```

### Testing on another device (LAN)
`next.config.ts` whitelists LAN dev origins via `allowedDevOrigins`
(currently `10.179.114.*`). Update that subnet to match your network, then open
`http://<your-LAN-ip>:3000` from a phone on the same Wi-Fi.

---

## 6. Path Aliases (`tsconfig.json`)
```jsonc
"paths": { "@/*": ["./src/*", "./*"] }
```
Import from `@/` instead of long relative paths, e.g.
`import { useTransactions } from "@/core/store/dataStore"`.

Other compiler settings of note: `strict: true`, `target: ES2020`,
`moduleResolution: bundler`, `jsx: react-jsx`, Next TS plugin enabled.

---

## 7. PWA (Progressive Web App)
- `public/manifest.json` is linked from the root layout metadata.
- `public/sw.js` is a service worker registered from `src/app/page.tsx`
  **only in production** (`NODE_ENV === "production"`) to avoid dev caching issues.
- `public/icon.svg` and other assets live in `public/`.
- Lessons content for the Academy is a static file:
  `public/assets/lessons/lessons.json`.

---

## 8. First-run behavior to expect
- `/` (splash) checks `localStorage`: no `user_session` → `/login`; `pin_hash`
  set → `/pin-lock`; otherwise → `/home`.
- On first dashboard mount, a one-time purge (`legacy_seed_cleared_v1`) wipes any
  legacy demo data so the app starts as a clean slate.
- Empty state is normal — all numbers are derived from transactions you add.

---

## 9. Project file inventory (root)
| File | Purpose |
|---|---|
| `next.config.ts` | Next config (LAN dev origins). |
| `tsconfig.json` | TypeScript + path aliases. |
| `postcss.config.mjs` | Tailwind v4 / PostCSS. |
| `eslint.config.mjs` | ESLint flat config. |
| `.env.local` | Firebase secrets (not committed). |
| `public/` | Static assets, PWA manifest, service worker, lessons JSON. |
| `src/` | Application code (see ARCHITECTURE.md). |
