# CLAUDE.md

[`AGENTS.md`](./AGENTS.md) is the single source of truth for this repository's stack, commands, conventions, verification gate, and deployment workflow.

## Operational notes

- Use Bun for all package and script operations.
- Type-aware Oxlint is the lint and type-analysis authority. Never run `tsc` or `tsc --noEmit` as a project gate.
- HeroUI is v3 only. Import from `@heroui/react`, use compound v3 APIs where applicable, and use `onPress` for interactions.
- The production target is the Cloudflare Worker `markit-ai` in account `90c76061632cca916b79973127d31e87`.
- The Vite Cloudflare build emits the deployment config at `dist/server/wrangler.json`.
- The product UI is one reactive voice orb. Audio streams through `/api/realtime` over WebSockets to OpenAI `gpt-realtime-2.1`.
- `OPENAI_API_KEY` must be configured as a Cloudflare Worker secret and must never be exposed to the browser.
- API tokens and global keys are runtime credentials. Never echo them, store them in these docs, add them to source, or commit them.

## Completion workflow

1. Run `bun run fmt` when source or docs change.
2. Run `bun run verify` and fix every failure.
3. Deploy when requested and verify the live response.
4. Commit only task files with a Conventional Commit message.
5. Push to `origin main` when requested or already authorized by the task.
