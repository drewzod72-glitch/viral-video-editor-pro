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
- **AI features are 100% client-side (BYOK)**: video analysis, the Co-Pilot, cut detection, and the Booster Studio all call Groq directly from the browser/device using a key the user pastes into the in-app Settings modal (`src/components/ApiKeySettingsModal.tsx`, `src/utils/apiKeyStore.ts`, `src/utils/groqClient.ts`). The old server routes (`/api/analyze-video`, `/api/copilot-optimize`, `/api/detect-cuts`) and `getGeminiClient()` in `server.ts` have been removed. There is no shared or server-side `GEMINI_API_KEY` anywhere in the codebase.
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
3. **Music Mixer** — 9 verified royalty-free tracks (`public/audio/track-1.mp3` … `track-9.mp3`), catalogued as 9 Hype + 1 Lofi + 1 Cinematic entries in `src/data.ts`. The former 30-track catalog was trimmed in v1.3.0: 13 of those files were actually HTML error pages saved with .mp3 names (silent tracks) and the rest never existed. Add new tracks as real MP3s + a `FREE_MUSIC_TRACKS` entry.
4. **FFmpeg HD Render Pipeline** (`server.ts`, Render-hosted) — subtitle burn-in, LUT-style color grading, background audio mixing, smart-cut/transition splicing.
5. **Virality Scorecard & Booster Studio** — the score is computed from real project data (`src/utils/viralityScore.ts`), never hardcoded. Booster runs client-side (BYOK).
6. **Interactive Captions & Highlight Splicer** — drag/split/edit word-level subtitles; AI-assisted smart cut detection.

## 🧠 AI models (Groq — BYOK)

The client (`src/utils/groqClient.ts`) calls Groq with the user's own key. As of v1.3.0 the model list is `qwen/qwen3.6-27b`, `openai/gpt-oss-20b`, `meta-llama/llama-4-scout-17b-16e-instruct` — Groq shuts down `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` on 2026-08-16, so do NOT reintroduce them. When every model fails, the app reports failure honestly ("manual mode") — no fabricated subtitles, no fake 99 score.

## 🔒 Backend security posture

- The two proxy endpoints (`/api/music-proxy`, `/api/download-proxy`) are SSRF-hardened: https-only, hostname allowlist (`PROXY_ALLOWED_HOSTS` env var extends it), and a DNS-level private/loopback/metadata IP block (`validateProxyUrl` in `server.ts`). Do not remove that guard.
- The backend intentionally has no auth: it is a stateless render API. If it grows beyond that, add auth before rate limiting becomes your only defense.

---

## 📦 Deployment

### Frontend (Netlify)
`netlify.toml` sets the build command to `vite build` only (skips the irrelevant server-bundling step) and adds a SPA routing fallback. No further config needed for a standard deploy.

### Backend (Render)
`render.yaml` is a ready-to-use Blueprint: `npm install && npm run build:server`, `npm start`, free tier, health check on `/`. `build:server` compiles `server.ts` to CommonJS in `dist-server/` and writes a `{"type":"commonjs"}` marker there so Node loads it correctly under the repo's `"type": "module"` (this was broken for several versions — a CJS file was being loaded as ESM and crashed on boot). If the backend ever has no built frontend at `dist/` (the normal case on Render), it serves a JSON health check at `/` instead of crashing on ENOENT. Note Render's free tier spins down after ~15 minutes idle — the first request after a quiet period will be slow (cold start + FFmpeg on shared CPU), which is expected, not a bug.

### Connecting them
Set `VITE_API_BASE_URL` on the Netlify deploy to the Render service's URL. CORS on the backend already reflects any request origin, so no additional CORS config is needed for this split.

---

## 📐 Development & Maintenance Rules
- **Compile check**: always run `npm run build` and `npm run build:server` before proposing or committing changes — both must exit 0.
- **Port binding**: `server.ts` must keep binding to `process.env.PORT || 3000` — never hardcode a port again; Render (and most hosts) assign their own and health-check that exact port.
- **Dependency Guard**: don't introduce client-side packages incompatible with standard browser runtimes, Capacitor WebViews, or the current build tooling.
- **Known accepted limitation**: preset video templates (not custom uploads) get text-only analysis, not multimodal video analysis — fetching their third-party hosted URLs cross-origin into the browser for byte-level access is CORS-fragile in a way server-side downloading wasn't. Custom uploads get full multimodal analysis since the browser already holds the File object directly. This is a deliberate tradeoff of the BYOK/client-side architecture, not an oversight — don't "fix" it by re-adding a server-side AI proxy without reconsidering the tradeoff first.
