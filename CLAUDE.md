# CLAUDE.md

[`AGENTS.md`](./AGENTS.md) is the single source of truth for this repository's product contract, architecture, stack, commands, conventions, verification gate, and deployment workflow.

## Product contract

- `markit.ai` is a voice-first AI purchase agent, not only a product search assistant. The ideal flow is prompt -> material visual clarification when needed -> verified offer -> policy decision -> simulated purchase -> merchant receipt, decision receipt, and Wallet-compatible pass.
- AI interprets intent, ambiguity, and alternatives. A deterministic server-side policy engine decides whether money may move. Never let an LLM override hard product criteria, the final all-in cap, seller restrictions, delivery requirements, or mandate limits.
- Canonical decisions are `REJECT`, `WAIT_AND_MONITOR`, `PROPOSE_ALTERNATIVES`, `ASK_USER`, `READY_FOR_APPROVAL`, and `AUTO_BUY`.
- A purchase request becomes a typed `PurchaseBrief`. Classify criteria as hard, soft, or unknown. A failed hard criterion cannot be rescued by a high aggregate fit score.
- Before the first search, ask at most one category-critical spoken question. Before checkout, gather any remaining material unknowns in one grouped visual clarification and mandate-confirmation step. A request to proceed permits discovery, not an unsafe purchase.
- If no exact eligible offer exists, ask how soon the product is needed and whether an exact match is mandatory. Wait and monitor when the user can wait; otherwise propose only alternatives that relax explicitly flexible attributes and still satisfy the cap and hard deadline.
- The price cap always means the verified final payable amount: item price minus valid discounts plus shipping, taxes, duties, marketplace fees, payment fees, FX cost, and mandatory charges. Even a one-cent overage is `REJECT`.
- Keep `estimatedLandedCost` separate from `verifiedCheckoutTotal`. Use decimal-safe money arithmetic, ISO currencies, and a final checkout revalidation before authorization.
- Search by delivery destination: local and domestic official sellers first, then verified resellers, regional sellers, and independently established international merchants. Unknown or risky merchants never qualify for autonomous purchasing.
- Seller reliability on product cards is an evidence-completeness heuristic, not a certification. Suspected counterfeit, fraud, missing identity, insecure payment, absent buyer protection, misleading terms, or manipulated reputation evidence are hard blockers.
- Delivery promises are estimates with confidence. A hard deadline must pass the configured confidence threshold; otherwise ask or reject.
- A `PurchaseMandate` is explicit, versioned, revocable, scoped, and expiring. Changing a hard criterion, cap, seller scope, deadline, quantity, or autonomy level requires renewed consent.
- The payment layer accepts only a short-lived `PurchaseAuthorizationEnvelope` bound to the mandate, candidate, merchant, product fingerprint, quantity, verified amount, currency, seller tier, delivery commitment, reason codes, expiry, and idempotency key.
- The current demo uses the deterministic localized mock catalog plus deterministic checkout, payment, and eval data. Never describe mock offers as live and never claim that real money moved.
- After success, create both a `MerchantReceipt` and a `DecisionReceipt`. The latter records evidence, calculations, applied rules, reason codes, and timestamps, not hidden chain-of-thought. Expose the result through Apple Wallet, Google Wallet, or a clearly labelled Wallet-compatible demo card.

## Operational notes

- Use Bun for all package and script operations. GitHub Actions installs the latest Bun canary and uses `bun install --frozen-lockfile`.
- Type-aware Oxlint is the lint and type-analysis authority. Never run `tsc` or `tsc --noEmit` as a project gate.
- HeroUI is v3 only. Import from `@heroui/react`, use compound v3 APIs where applicable, and use `onPress` for interactions.
- The production target is the Cloudflare Worker `markit-ai` in account `90c76061632cca916b79973127d31e87`.
- The Vite Cloudflare build emits the deployment config at `dist/server/wrangler.json`.
- The primary UI is the reactive voice orb and compact status indicator. Product results use the right-hand desktop panel or controlled mobile Drawer. Material clarification and mandate confirmation use one grouped accessible modal or sheet; purchase progress and receipts reuse the controlled secondary surface.
- `src/product-agent.ts` owns the trusted ecommerce prompt, typed tools, input validation, discovery orchestration, and result sanitization. It does not authorize payments.
- `src/product-analysis.ts` independently audits each listing with `gpt-5.6-luna` and streams per-card `markit.analysis` events. Audits never block the voice reply, stale generations are dropped, and the voice model must never claim audit verdicts it cannot see.
- Current product claims must be grounded in sanitized `search_products` results from `src/mock-product-catalog.ts` or other explicitly labelled deterministic fixtures. Never describe mock data as live or currently verified.
- The model controls product-card visibility through `control_product_display` and `markit.products`. New clarification, mandate, purchase, and receipt UI must use typed server events and controlled HeroUI components, never model-generated HTML.
- `OPENAI_API_KEY` must be configured as a Cloudflare Worker secret and must never be exposed to the browser.
- API tokens, payment credentials, and global keys are runtime credentials. Never echo them, store them in these docs, add them to source, or commit them.
- Zero-tolerance purchase invariants are no hard-cap violations, no wrong-hard-attribute autonomous purchases, no blocked-seller autonomous purchases, and no duplicate autonomous purchases.

## Completion workflow

1. Run `bun run fmt` when source or docs change.
2. Run `bun run verify` and fix every failure.
3. Commit only task files with a Conventional Commit message.
4. Push the completed task commit without waiting for a separate deployment request. `.github/workflows/deploy.yml` verifies and deploys the production Worker automatically.
5. Check the workflow and live response when CI/CD behavior changes or a deployment failure is reported.
