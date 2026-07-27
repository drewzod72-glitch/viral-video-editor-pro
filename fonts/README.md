# Bundled fonts

`server.ts` checks this folder first for every font it needs — the
5 caption-style fonts, plus the base subtitle font and the emoji/symbol
font — before falling back to a network download. Drop these files in
here with these EXACT names (case-sensitive):

| File name                  | Used for | Status |
|-----------------------------|----------|--------|
| `Roboto-Bold.ttf`           | Default/base subtitle font | ✅ you have this |
| `SpaceGrotesk-Bold.ttf`     | MrBeast caption style | ✅ you have this |
| `Oswald-Bold.ttf`           | Hormozi caption style | ✅ you have this |
| `Inter-Medium.ttf`          | Minimalist caption style | ⚠️ replaces the Inter-Bold you sent earlier — see below |
| `Outfit-Bold.ttf`           | Comic caption style | ⚠️ still missing — see below |
| `JetBrainsMono-Bold.ttf`    | Impact caption style | ✅ you have this |
| `DejaVuSans-Bold.ttf`       | Emoji/symbol glyphs (so 🔥😱👑 etc. render instead of blank boxes) | ✅ you have this |

## Update: minimalist needs Inter Medium (500), not Inter Bold

The editor preview renders the "minimalist" caption style noticeably
lighter than the other 4 styles on purpose (font-weight 500 vs 900,
matching its "clean, quiet" visual identity). The `Inter-Bold.ttf` you
sent earlier would export heavier/bolder than the preview shows.

**To get the right file:** go to https://fonts.google.com/specimen/Inter,
download the family, and pull `Inter-Medium.ttf` out of the `static/`
folder in the zip — same process as before, just grab the Medium weight
file instead of Bold this time. I'm intentionally not giving you a
direct gstatic.com link for this one: while researching it I found
Google's own `google/fonts` GitHub repo for Inter appears to have moved
to variable-font-only distribution recently (no static per-weight files
listed in the repo anymore), which means I can't fully confirm a raw
download link will still work by the time you click it. The Google
Fonts *website* download (link above) is the reliable path regardless of
that backend change.

## About the hormozi/Oswald decision

The client preview's "Hormozi" style originally used CSS font-family
"Impact" — a proprietary system font not available on Google Fonts. Your
list uses **Oswald Bold** for this style instead, which is a fine,
freely-licensed substitute. The app now uses Oswald consistently in both
places, so the editor preview and the exported video match each other:
- `src/utils/captionStyleConfig.ts` — bundled font file name
- `src/index.css` — preview font-family + the Google Fonts `@import`
  (added Oswald, which wasn't being loaded before)

## Still needed: Outfit Bold (comic style)

Your list is missing a font for the "comic" caption style. Unlike
Impact, this one has no licensing issue — it's freely available:

**Outfit Bold direct link:**
`https://fonts.gstatic.com/s/outfit/v11/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC0DYRhw2A.ttf`

Grab that one too and you'll have all 7 files this app actually uses.
Until then, the "comic" caption style will fall back to Roboto in
exported videos — the app will still work, it just won't look like the
Outfit font shown in the editor preview for that one style.

## Why Roboto + DejaVu matter too

These aren't just fallbacks — they were already wired into the render
pipeline for every single export:
- **Roboto-Bold.ttf** is the base font used whenever a caption style's
  own font can't be resolved.
- **DejaVuSans-Bold.ttf** specifically renders emoji/symbol characters
  in burned-in captions — Latin-only bold fonts like the ones above
  typically contain no emoji glyphs at all, so without this, emoji in
  captions could render as blank "tofu" boxes in the exported video.

Previously, both were only ever fetched from the network at render
time, with no local copy checked first — the same class of bug the 5
caption fonts had. That's now fixed the same way: bundled file first,
network download only as a last resort.

## Deployment note

Make sure this `fonts/` folder is actually copied into your deployed
build output (next to `dist/server.cjs`), not left behind by your build
script — `server.ts` resolves the path as `path.join(__dirname, 'fonts')`,
i.e. relative to wherever the compiled server file ends up running from.
