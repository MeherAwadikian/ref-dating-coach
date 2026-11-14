# Wingman (app)

On-device dating-conversation copilot. One codebase → **PWA** (Cloudflare Pages) and **native
iOS** (Capacitor → TestFlight). Clean-room; contains no third-party code or assets.

## Stack
- Vite + React + TypeScript
- `vite-plugin-pwa` (installable, offline service worker)
- Capacitor (iOS wrapper)
- Zero-dependency icon generator (`scripts/generate-icons.mjs`)

## Screens
- **Coach** — paste a message, get three replies in different tones (on-device).
- **Openers** — tone-picked icebreakers, tap to copy.
- **Profile** — transparent bio score + concrete fixes.
- **Practice** — a safe simulated match to rehearse against.

## Intelligence
Real AI runs server-side in a Cloudflare Pages Function ([`functions/api/ai.ts`](functions/api/ai.ts))
that calls **OpenRouter** — the API key never touches the client. [`src/engine.ts`](src/engine.ts)
calls `/api/ai` first and transparently falls back to an on-device, rule-based engine when
offline or unconfigured. Default model is free (`nvidia/nemotron-3.5-super-vl:free`). See
[`../DEPLOY.md`](../DEPLOY.md) for the one env var to set.

## Develop
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # -> dist/
npm run preview
npm run icons      # regenerate app icons
```

## Deploy
See [`../DEPLOY.md`](../DEPLOY.md) for the web (Cloudflare Pages) and iOS (TestFlight) pipelines
and the exact secrets each needs.
