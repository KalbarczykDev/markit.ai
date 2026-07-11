# AGENTS.md

Guidance for AI agents working in this repository. This file is the single source of truth; `CLAUDE.md` defers to it.

## Project

`markit.ai` is a realtime voice assistant built on this frontend foundation:

- Bun package manager and task runner
- Vite 8
- React 19 with React Compiler
- TanStack Start and TanStack Router for SSR and file-based routing
- HeroUI v3 for accessible UI primitives
- Tailwind CSS v4
- TypeScript in strict mode
- Oxfmt and type-aware Oxlint
- Cloudflare Workers via `@cloudflare/vite-plugin` and Wrangler

The app is a single package. Routes live in `src/routes`, the router is in `src/router.tsx`, and the Cloudflare Worker entry is `src/server.ts`.

## Commands

Run commands from the repository root.

| Task                          | Command                   |
| ----------------------------- | ------------------------- |
| Install                       | `bun install`             |
| Develop                       | `bun run dev`             |
| Build                         | `bun run build`           |
| Type-aware lint and type gate | `bun run lint:type-aware` |
| Format                        | `bun run fmt`             |
| Full verification             | `bun run verify`          |
| Deploy manually               | `bun run deploy`          |

## Required gate

`bun run verify` must pass before a commit or deployment. It runs formatting, type-aware Oxlint, and the production build.

Use `bun oxlint --type-aware` as the source of truth for linting and type analysis. Do not substitute `tsc` or `tsc --noEmit`.

## Conventions

- Use Bun, not npm, pnpm, or yarn.
- Use strict TypeScript. Avoid `any` and unsafe casts.
- Use file-based TanStack routes in `src/routes`.
- Prefer HeroUI v3 components over recreating accessible controls. Import from `@heroui/react`; do not use HeroUI v2 packages or patterns.
- HeroUI interactions use `onPress`, not `onClick`.
- Keep `resolve.dedupe: ['react', 'react-dom']` in Vite. A single React copy is required by React Aria overlays.
- Use Tailwind v4 and the design tokens in `src/index.css`.
- The interface is intentionally a single voice orb. Do not add visible navigation, copy, cards, or conventional controls unless explicitly requested.
- Voice transport uses the same-origin `/api/realtime` WebSocket proxy to OpenAI's `gpt-realtime-2.1` model. Keep the API key server-side as the `OPENAI_API_KEY` Worker secret.
- Microphone audio is mono PCM16 at 24 kHz. Preserve server VAD, interruption handling, and streamed audio playback.
- Keep secrets out of source, docs, Git, and command output. Local secrets belong in ignored `.env` or `.dev.vars` files; production secrets belong in Cloudflare Worker secrets.
- Do not commit generated build output (`dist`) or dependencies (`node_modules`).

## Deployment

The Worker is named `markit-ai` and configured in `wrangler.toml`. `bun run build` emits `dist/server/wrangler.json`; deploy that generated configuration with Wrangler.

For manual deployment, provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through the process environment. Never write credentials into tracked files.

When a task includes deployment and `bun run verify` is green, deploy, verify the live URL, then commit and push only the files changed for the task.

## UI work

For any task that designs, implements, or reviews frontend UI, read and follow [`skills/refine-ui/SKILL.md`](skills/refine-ui/SKILL.md) before making changes. Use its review checklist before handoff.

Keep the licensed Refactoring UI source files in `/Users/oskalbarczyk/Downloads/Refactoring_UI`; never copy or commit the full source materials into this repository.
