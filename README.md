<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Auto Viral Video Editor

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

That's it — you no longer need to set a `GEMINI_API_KEY` anywhere. Every AI
feature (video analysis, Co-Pilot, cut detection, the Booster Studio) runs
directly from the browser/device using a key each user pastes into the
in-app Settings modal. See `AGENTS.md` for the full architecture, and
`.env.example` for the one setting that does still sometimes matter
(`VITE_API_BASE_URL`, only needed once you deploy the frontend and backend
to separate hosts, or build the native app).

## Deploying

- **Frontend** → Netlify. See `netlify.toml`.
- **Backend** (video render/export only) → Render. See `render.yaml`.
- **Fonts**: drop the 7 files listed in `fonts/README.md` into `/fonts`
  before deploying the backend — captions won't match the editor preview
  without them.
- **Native (iOS/Android)**: `capacitor.config.ts` and the `@capacitor/*`
  dependencies are already in place. See `AGENTS.md` for the current
  status and what's left to do there.
