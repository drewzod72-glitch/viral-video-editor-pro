# Design System — viral-video-editor-pro

Generated from UI/UX Pro Max skill with product-specific inputs.

## Product Context
- **Type:** Creator Tool / SaaS
- **Description:** Mobile-first AI video editing app: upload video, AI captions/highlights via BYOK Groq, caption styling, background music selection, render/export.
- **Stack:** React, Tailwind CSS
- **Audience:** Content creators, social media users, mobile-first, fast-paced, not necessarily technical
- **Keywords:** bold, fast, modern, energetic, mobile-native, creator-focused

## Pattern
- **Name:** Hero-Centric Design
- **Conversion Focus:** One primary CTA. Let the hero dominate the initial viewport without hiding the next content cue. Use a static hero and non-pulsing CTA when reduced motion is requested; provide video controls. Pause hero media offscreen/hidden and keep the final hero message and CTA static under reduced motion.
- **CTA Placement:** Hero dominant (center/bottom) + Sticky nav CTA
- **Color Strategy:** Hero: High-impact visual. Minimal text. Verify CTA label text against the button fill at 4.5:1 minimum; use 7:1 only for an explicit AAA normal-text target.
- **Sections:** Full-bleed Hero (headline + visual) > Single value prop strip > Key benefit or proof > Primary CTA

## Style
- **Name:** Dark Mode (OLED)
- **Mode Support:** Light not-recommended | Dark supported
- **Keywords:** Dark theme, low light, high contrast, deep black, midnight blue, eye-friendly, OLED, night mode, power efficient
- **Best For:** Night-mode apps, coding platforms, entertainment, eye-strain prevention, OLED devices, low-light
- **Performance:** cost:low|drivers:none | **Accessibility:** risk:low|requires:contrast-text-4.5,keyboard,visible-focus,reduced-motion

## Colors
| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#EC4899` | `--color-primary` |
| On Primary | `#000000` | `--color-on-primary` |
| Secondary | `#DB2777` | `--color-secondary` |
| On Secondary | `#FFFFFF` | `--color-on-secondary` |
| Accent/CTA | `#2563EB` | `--color-accent` |
| On Accent/CTA | `#FFFFFF` | `--color-on-accent` |
| Background | `#0F172A` | `--color-background` |
| Foreground | `#FFFFFF` | `--color-foreground` |
| Card | `#192134` | `--color-card` |
| Card Foreground | `#FFFFFF` | `--color-card-foreground` |
| Muted | `#201A32` | `--color-muted` |
| Muted Foreground | `#94A3B8` | `--color-muted-foreground` |
| Border | `rgba(255,255,255,0.08)` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#EC4899` | `--color-ring` |

*Notes: Video pink on dark + timeline blue*

## Typography
- **Heading:** Inter
- **Body:** Inter
- **Mood:** dark, cinematic, technical, precision, clean, premium, developer, professional, high-end utility
- **Best For:** Developer tools, fintech/trading, AI dashboards, streaming platforms, high-end productivity apps
- **Google Fonts:** https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap
- **CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
```

## Key Effects
Minimal glow (text-shadow: 0 0 10px), dark-to-light transitions, low white emission, high readability, visible focus

## Avoid (Anti-patterns)
- Pure white backgrounds
- Emojis as icons (use SVG: Heroicons/Lucide)
- Raw hex in components (use semantic tokens)
- Mixing flat & skeuomorphic randomly

## Pre-Delivery Checklist
- [ ] No emojis as icons (use SVG: Heroicons/Lucide)
- [ ] cursor-pointer on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
