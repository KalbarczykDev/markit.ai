# Markit.ai presentation worker

A standalone, dependency-free slide deck for the current Markit.ai product story. It is isolated from the main application and deploys as its own Cloudflare Worker.

## Present

- Use **Next** / **Back**, the arrow keys, Page Up / Page Down, or Space.
- Swipe horizontally on a touch device.
- Use Home / End to jump to the first / last slide.
- Use the top-right control for fullscreen mode.
- Deep-link to a slide with its hash, for example `#5`.

## Run locally

From the repository root:

```bash
bunx wrangler dev --config presentation/wrangler.toml
```

## Deploy

Cloudflare credentials stay in the ignored root `.env` file. Load them into the process without copying them into this folder:

```bash
set -a
source .env
set +a
bunx wrangler deploy --config presentation/wrangler.toml
```

The worker name is `markit-ai-presentation`.

## Files

- `worker.ts` adds caching and security headers around static asset responses.
- `public/index.html` contains the presentation content.
- `public/styles.css` contains the responsive visual system.
- `public/deck.js` handles navigation, fullscreen, keyboard controls, and touch gestures.
