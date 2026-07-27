# Auto Viral Video Editor - Production Launch Guide

This document captures the rules, feature set, architecture, and deployment procedures for the **Auto Viral Video Editor**. It exists so future work on this repo doesn't drift from what's actually true — if you change something described here, update this file in the same change.

---

## 🚀 Core Philosophy
1. **Mobile-first, cross-platform**: the target is Netlify (web) + Render (backend) today, with a genuine Capacitor iOS/Android release as the near-term goal. Layout and interaction decisions should be evaluated on a real phone viewport first, not assumed to "also work" on mobile after being built for desktop.
2. **Strict Compile & Lint Compliance**: the app compiles successfully (`npm run build` / `tsc --noEmit`) with zero syntax, TypeScript, or type-safety errors.
3. **No silent fake fallbacks.** If an AI call, a render, or a network request fails, the user sees an honest error — never a locally-fabricated result presented as if it came from the real pipeline. This was a repeated bug class in earlier versions of this app (a fake "boosted" project on Gemini failure, canned local subtitles presented as AI-optimized, silent stock-footage substitution when a source video failed to download) and every instance found has been removed. Do not reintroduce this pattern for the sake of "always showing success."
4. **Preview = export, always.** Every visual property of a caption style (font, size, color, position) lives in exactly one place — `src/utils/captionStyleConfig.ts` — imported by both the browser preview (`src/types.ts` → `getCaptionStyles`) and the server-side FFmpeg renderer (`server.ts` → `getFFmpegCaptionConfig`). Never hardcode a caption style number in only one of those two places.

---

## 🏗️ Architecture (current, as of this doc)

- **Frontend**: Vite + React, deployed to **Netlify**. Netlify builds and serves the static frontend only — it does not run `server.ts` (Netlify Functions and a persistent Express app are different execution models; see `netlify.toml`).
- **Backend**: `server.ts` — Express + FFmpeg, deployed separately to **Render** (`render.yaml`). Handles exactly one thing: `/api/render-project`, the actual video export (captions/color-grade/music/transitions burned into a final MP4). Binds to `process.env.PORT` (Render-assigned), not a hardcoded port.
- **AI features are 100% client-side (BYOK)**: video analysis, the Co-Pilot, cut detection, and the Booster Studio all call Gemini directly from the browser/device using a key the user pastes into the in-app Settings modal (`src/components/ApiKeySettingsModal.tsx`, `src/utils/apiKeyStore.ts`, `src/utils/geminiClient.ts`). There is no shared or server-side `GEMINI_API_KEY` anymore — do not reintroduce one. The old server routes (`/api/analyze-video`, `/api/copilot-optimize`, `/api/detect-cuts`) and `getGeminiClient()` in `server.ts` are unused dead code, kept only for reference; safe to delete once you're confident nothing still points at them.
- **Native (Capacitor)**: not yet built, but the codebase is prepared for it — `capacitor.config.ts` exists, `@capacitor/*` deps are in `package.json`, and `src/utils/download.ts` already branches on `Capacitor.isNativePlatform()` to use `@capacitor/filesystem` + `@capacitor/share` instead of the web Share API. When you actually run `npx cap add ios/android`, set `VITE_API_BASE_URL` to the deployed Render URL (see `.env.example`) — a native shell has no "same origin" to fall back to.

---

## 🎨 Caption fonts

Five caption styles, each needs a real bundled font in `/fonts` (see `fonts/README.md` for the exact file list and current status). Bundled-local-file-first, network download only as a last resort — never make font resolution network-dependent as the primary path again (it was, originally, for every style; that was a real reliability bug).

Two deliberate substitutions worth knowing if you touch this again:
- **hormozi** uses **Oswald Bold**, not "Impact" — Impact is a proprietary system font with no free redistributable source.
- **minimalist** uses **Inter Medium (500)**, not Bold — this style is intentionally lighter-weight than the other four; check `VideoPlayerWorkspace.tsx`'s `renderStyledText` if you ever change this, since the preview's `fontWeight` there must stay in sync with whatever weight is bundled.

---

## 🛠️ Feature Set Overview

1. **Niche Pacing Analysis & Archetypes** — cooking, unboxing, sales/e-commerce, pets, fitness/motivation, general. AI-generated hooks, detail callouts, ending CTAs.
2. **Cinematic Caption Overlay Engine** — MrBeast, Hormozi, Minimalist, Comic, Impact styles (see fonts section above).
3. **Multi-Track Audio Mixer** — 10 royalty-free tracks, client/server volume control, automated ducking during speech.
4. **FFmpeg HD Render Pipeline** (`server.ts`, Render-hosted) — subtitle burn-in, LUT-style color grading, background audio mixing, smart-cut/transition splicing.
5. **Virality Scorecard & Booster Studio** — Gemini-driven analysis and creator-archetype restyling, entirely client-side now (BYOK).
6. **Interactive Captions & Highlight Splicer** — drag/split/edit word-level subtitles; AI-assisted smart cut detection.

---

## 📦 Deployment

### Frontend (Netlify)
`netlify.toml` sets the build command to `vite build` only (skips the irrelevant server-bundling step) and adds a SPA routing fallback. No further config needed for a standard deploy.

### Backend (Render)
`render.yaml` is a ready-to-use Blueprint: `npm install && npm run build:server`, `npm start`, free tier, health check on `/`. Note Render's free tier spins down after ~15 minutes idle — the first request after a quiet period will be slow (cold start + FFmpeg on shared CPU), which is expected, not a bug.

### Connecting them
Set `VITE_API_BASE_URL` on the Netlify deploy to the Render service's URL. CORS on the backend already reflects any request origin, so no additional CORS config is needed for this split.

---

## 📐 Development & Maintenance Rules
- **Linter Check**: always run `npm run lint` (`tsc --noEmit`) before proposing or committing changes.
- **Port binding**: `server.ts` must keep binding to `process.env.PORT || 3000` — never hardcode a port again; Render (and most hosts) assign their own and health-check that exact port.
- **Dependency Guard**: don't introduce client-side packages incompatible with standard browser runtimes, Capacitor WebViews, or the current build tooling.
- **Known accepted limitation**: preset video templates (not custom uploads) get text-only Gemini analysis, not multimodal video analysis — fetching their third-party hosted URLs cross-origin into the browser for byte-level access is CORS-fragile in a way server-side downloading wasn't. Custom uploads get full multimodal analysis since the browser already holds the File object directly. This is a deliberate tradeoff of the BYOK/client-side architecture, not an oversight — don't "fix" it by re-adding a server-side AI proxy without reconsidering the tradeoff first.
