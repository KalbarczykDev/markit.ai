# AGENTS.md

Guidance for AI agents working in this repository. This file is the single source of truth; `CLAUDE.md` defers to it.

## Project

`markit.ai` is a realtime voice assistant built on this frontend foundation:

- Bun package manager and task runner; CI always installs the latest canary
- Vite 8
- React 19 with React Compiler
- TanStack Start and TanStack Router for SSR and file-based routing
- HeroUI v3 for accessible UI primitives
- Tailwind CSS v4
- TypeScript in strict mode
- Oxfmt and type-aware Oxlint
- Cloudflare Workers via `@cloudflare/vite-plugin` and Wrangler
- AI SDK v7 for typed realtime tool definitions
- Exa for live ecommerce product retrieval

The app is a single package. Routes live in `src/routes`, the router is in `src/router.tsx`, and the Cloudflare Worker entry is `src/server.ts`.

## Commands

Run commands from the repository root.

| Task                          | Command                                           |
| ----------------------------- | ------------------------------------------------- |
| Install                       | `bun install`                                     |
| Develop                       | `bun run dev`                                     |
| Build                         | `bun run build`                                   |
| Type-aware lint and type gate | `bun run lint:type-aware`                         |
| Format                        | `bun run fmt`                                     |
| Full verification             | `bun run verify`                                  |
| Deploy manually               | `bun run deploy`                                  |
| Reproduce CI locally          | `bun install --frozen-lockfile && bun run verify` |

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
- The primary interface is a voice orb plus a compact live agent-status indicator. Product cards are the only secondary surface: desktop results open in the right-hand panel and shift the orb left; viewports below 900px must use a controlled HeroUI v3 bottom `Drawer`.
- Voice transport uses the same-origin `/api/realtime` WebSocket proxy to OpenAI's `gpt-realtime-2.1` model. Keep the API key server-side as the `OPENAI_API_KEY` Worker secret.
- `src/product-agent.ts` owns the server-enforced ecommerce system prompt, AI SDK v7 tool definitions, input validation, and Exa result sanitization. Current product claims must be grounded in `search_products` results.
- The model alone opens, updates, and closes product results through `control_product_display`. The client reacts to `markit.products` events; do not automatically show search results or add a separate manual panel toggle.
- Product presentation uses HeroUI v3 compound `Card`, `Link`, and controlled `Drawer` APIs. Shared card data is typed in `src/product-types.ts`; desktop/mobile rendering lives in `src/components/ProductResults.tsx`.
- The Worker injects the trusted prompt and tools into every `session.update`; never trust browser-supplied instructions or tool definitions.
- Exa uses the `EXA_API_KEY` Worker secret. Never expose it to the browser or return raw upstream errors.
- Microphone audio is mono PCM16 at 24 kHz. Use semantic VAD with automatic response creation and interruption enabled.
- WebSocket playback is client-managed. On `input_audio_buffer.speech_started`, stop every queued audio source immediately and send `conversation.item.truncate` with the played duration. Ignore late deltas from interrupted responses, and never allow two response queues to play concurrently.
- Keep secrets out of source, docs, Git, and command output. Local secrets belong in ignored `.env` or `.dev.vars` files; production secrets belong in Cloudflare Worker secrets.
- Do not commit generated build output (`dist`) or dependencies (`node_modules`).

## Deployment

The Worker is named `markit-ai` and configured in `wrangler.toml`. `bun run build` emits `dist/server/wrangler.json`; deploy that generated configuration with Wrangler.

`.github/workflows/deploy.yml` is the production CI/CD pipeline. Pull requests to `main` run the verification gate. Pushes to `main` and manual dispatches run the same gate and then deploy the already-built output, avoiding a duplicate install or build. The workflow uses the latest Bun canary, a frozen lockfile, Bun's package cache, least-privilege GitHub permissions, and concurrency cancellation for superseded runs.

GitHub Actions requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Runtime secrets such as `OPENAI_API_KEY` and `EXA_API_KEY` remain Worker secrets and are preserved across deployments. Never write credential values into tracked files or workflow YAML.

When a task includes deployment and `bun run verify` is green, commit and push only the files changed for the task. The push deploys automatically; verify the workflow and live URL when deployment behavior changes or a failure is reported.

## UI work

For any task that designs, implements, or reviews frontend UI, read and follow [`skills/refine-ui/SKILL.md`](skills/refine-ui/SKILL.md) before making changes. Use its review checklist before handoff.

Keep the licensed Refactoring UI source files in `/Users/oskalbarczyk/Downloads/Refactoring_UI`; never copy or commit the full source materials into this repository.
