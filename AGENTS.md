# AGENTS.md

Guidance for AI agents working in this repository. This file is the single source of truth; `CLAUDE.md` defers to it.

## Project

`markit.ai` is a realtime, voice-first AI purchase agent. The target experience is:

1. The shopper describes the desired outcome once in natural language.
2. The agent converts it into a structured purchase brief and asks only for material missing information, preferably in one visual clarification step.
3. The system validates the product, final payable price, seller, and delivery promise.
4. A deterministic policy engine returns a purchase decision.
5. When the confirmed mandate permits it, the system completes a simulated purchase and creates a merchant receipt, a decision receipt, and a Wallet-compatible pass or card.

The core product invariant is:

> AI interprets ambiguity and explains decisions. Deterministic policy decides whether money may move.

Never implement autonomous purchasing as a free-form model decision or as `if price < cap: buy()`. Model output may propose structured facts and actions, but it must not override hard product requirements, the final all-in price cap, seller restrictions, delivery requirements, or mandate limits.

The frontend and Worker foundation uses:

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
- Deterministic localized mock catalog for repeatable product discovery
- Deterministic mock merchant, checkout, payment, and evaluation data for demo-critical purchase flows

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

## Product architecture

The canonical flow is:

```text
User prompt
  -> PurchaseBrief
  -> optional grouped clarification
  -> confirmed PurchaseMandate
  -> candidate discovery or simulated price event
  -> product match + listing audit
  -> landed cost + seller trust + delivery confidence
  -> deterministic PurchaseDecision
  -> verified checkout quote
  -> PurchaseAuthorizationEnvelope
  -> simulated payment
  -> MerchantReceipt + DecisionReceipt + Wallet pass
```

Keep the authority boundaries explicit:

- `src/product-agent.ts` owns the trusted ecommerce prompt, AI SDK v7 tools, input validation, discovery orchestration, and result sanitization. It may interpret intent and control the product UI, but it is not the payment authority.
- `src/product-analysis.ts` owns independent, evidence-only listing audits. Audit output is advisory input; it is never sufficient on its own to authorize payment.
- Landed-cost math, policy decisions, mandate validation, final checkout verification, and duplicate protection must be deterministic and must not call an LLM.
- The Worker is the trusted boundary. The browser may render and collect user input, but it must not define policy, trusted prices, tool schemas, mandate state, or authorization results.
- Implement purchase-domain logic as strict, independently testable modules rather than adding all behavior to one large prompt.

Recommended module boundaries:

```text
src/purchase-types.ts       domain types, schemas, and reason codes
src/purchase-brief.ts       brief normalization and clarification state
src/product-matcher.ts      identifiers, attributes, aliases, and match evidence
src/landed-cost.ts          all-in price calculation
src/seller-policy.ts        seller tiers, evidence, and hard blockers
src/delivery-policy.ts      delivery estimate and deadline evaluation
src/purchase-policy.ts      deterministic decision and mandate gate
src/checkout-simulator.ts   deterministic final quote and payment result
src/receipts.ts             merchant and decision receipts
src/wallet.ts               Wallet pass or card payloads
src/eval/                    adversarial fixtures, ground truth, and metrics
```

Equivalent names are acceptable; the authority boundaries are not optional.

## Purchase brief and clarification

Every request must normalize into a typed `PurchaseBrief` with these logical sections:

- `product`: category, brand, model, variant, size, condition, quantity, and category-specific attributes
- `budget`: ISO currency and hard all-in cap
- `delivery`: destination, deadline, and whether the deadline is hard or soft
- `sellerPolicy`: allowed seller tiers and explicit exclusions
- `alternatives`: whether alternatives are allowed and which attributes may change
- `autonomy`: whether auto-buy is permitted, maximum order count, and expiry

Classify each criterion as:

- `HARD`: must pass exactly
- `SOFT`: preferred and relaxable only with user permission
- `UNKNOWN`: unresolved and material only when it can change eligibility or authorization

A high aggregate fit score must never compensate for a failed hard requirement. A cheaper listing with the wrong size, model, compatibility, variant, condition, or another hard mismatch is not eligible.

Explicit budgets are always hard. Treat the shopper's stated amount as the maximum final payable amount unless they explicitly say otherwise.

Ask only when missing information can materially change the product, authorization, final price, seller eligibility, or delivery outcome.

- Before the first search, ask at most one concise category-critical spoken question, such as shoe size, apparel size, compatibility, or destination.
- If the shopper says to proceed or has no preference, start discovery immediately and do not repeat the declined question.
- Proceeding with discovery does not authorize a purchase with unresolved hard requirements.
- Before checkout, collect all remaining material unknowns in one grouped visual clarification and mandate-confirmation surface. Prefer chips, segmented controls, selects, and toggles over a long conversational interview.
- Show hard requirements, soft preferences, and assumptions explicitly.
- Do not ask the same question twice after it has been answered or declined.
- A user override updates the structured brief or creates a new mandate version; it must not silently broaden future purchases.

Typical material clarifications include size, compatibility, exact variant, new versus used or refurbished, hard delivery deadline, reseller acceptance, and which alternative attributes may change.

## No exact offer under the cap

When no exact eligible offer exists, do not immediately ask the shopper to raise the budget and do not silently relax product criteria.

Collect two decisions, ideally in the same visual step:

1. How soon is the product needed?
2. Is an exact match required, or may specific attributes change?

Then return one of these states:

- `WAIT_AND_MONITOR`: an exact match is required and the shopper can wait. Monitor deterministic restock, price, FX, or sale events until the mandate expires.
- `PROPOSE_ALTERNATIVES`: alternatives are allowed. Relax only explicitly flexible attributes while preserving every hard requirement, the all-in cap, and any hard deadline.
- `REJECT`: no candidate can satisfy the hard rules and no permitted recovery path exists.

Restock and seasonal-discount forecasts are estimates, not promises. Store their evidence and confidence, label them as predictions, and never treat a forecast price as a current checkout price.

## Product matching and evidence

Use the strongest available evidence in this order:

1. Exact SKU, GTIN, EAN, MPN, or manufacturer identifier
2. Normalized brand, model, and variant
3. Category-critical attributes such as size, compatibility, capacity, material, or condition
4. Seeded aliases and merchant-specific naming
5. Fuzzy title similarity
6. Counterfeit, bait-listing, and contradictory-evidence signals

A match result must contain per-criterion pass or fail states, evidence, warnings, and overall confidence. The policy engine evaluates hard criteria independently from the confidence score.

Never present a likely counterfeit, bait listing, wrong variant, or materially incomplete listing as an exact match.

Current product claims, prices, discounts, stock, delivery costs, and seller evidence must be grounded in sanitized `search_products` results from `src/mock-product-catalog.ts` or in other explicitly labelled deterministic fixtures.

- The current product is intentionally mock-first. Do not add live scraping or make the demo depend on a real merchant checkout.
- Deterministic mock merchant and price-event data is the source of truth for discovery, payment decisions, checkout simulation, adversarial demos, and eval metrics.
- Never describe mock prices, sellers, stock, taxes, delivery estimates, reviews, or policies as live or currently verified.
- Preserve fixture and scenario provenance when data moves between discovery, policy, checkout, receipts, and evaluation.
- A search result is a discovery candidate, not an authorized purchase.
- If shipping, taxes, duties, fees, currency, or another mandatory price component is unknown, the candidate cannot reach `AUTO_BUY`.
- Independent listing audits may remain non-blocking for browsing, but a pending, failed, or unverified required check must never be treated as a pass by the purchase policy.

## Landed cost and hard price cap

The cap applies to the final amount payable, not the sticker price.

```text
landedCost =
    itemPrice
  - validDiscounts
  + shipping
  + taxes
  + customsDuties
  + marketplaceFees
  + paymentFees
  + fxCost
  + mandatoryServiceFees
```

Maintain two distinct amounts:

- `estimatedLandedCost`: used for discovery, comparison, and ranking
- `verifiedCheckoutTotal`: recalculated from the final checkout quote immediately before authorization

Rules:

- Represent money as integer minor units or with a decimal-safe money abstraction. Do not use binary floating-point for authorization comparisons.
- Every amount carries an ISO 4217 currency and an explicit conversion basis when FX is involved.
- Validate coupon applicability, expiry, minimum spend, and seller or product restrictions.
- Recalculate after address, shipping method, tax, coupon, merchant price, or FX changes.
- `verifiedCheckoutTotal > hardCap` always returns `REJECT`, including a one-cent overage.
- Unknown, mismatched-currency, or unverifiable final totals cannot reach `AUTO_BUY`.
- The model cannot reinterpret, round away, or make a “worth it” exception to the hard cap.
- Raising the cap requires explicit consent and a new mandate version.

## Seller and delivery policy

Prioritize markets and merchants using the delivery destination, not device GPS alone:

1. Local or same-city inventory
2. Domestic official or authorized sellers
3. Domestic platform-verified resellers
4. Regional official sellers and verified marketplaces
5. Independently established international merchants
6. Unknown or risky merchants, which are not eligible for autonomous purchasing

Seller tiers:

- `OFFICIAL`: brand, manufacturer, official store, or authorized distributor
- `VERIFIED_RESELLER`: identity-verified seller with buyer protection, meaningful transaction history, trackable delivery, and clear return terms
- `EXTERNALLY_TRUSTED`: independently established merchant with corroborated identity, reputation, protection, and policy evidence
- `UNKNOWN_OR_RISKY`: missing, contradictory, manipulated, or materially unsafe evidence

For deterministic demo data, `EXTERNALLY_TRUSTED` may require at least five independent reputation sources and 10,000 aggregate relevant user signals. This is an evidence threshold, not proof or certification.

The existing seller-reliability score is an evidence-completeness heuristic. Cards must show its basis and evidence level; neither the UI nor the voice model may call it a guarantee.

Hard seller blockers override every score:

- suspected counterfeit or fraud
- missing legal identity where required
- insecure or unsupported payment path
- no buyer protection for a marketplace reseller
- no trackable delivery for a physical product
- materially misleading listing information
- implausible pricing without credible evidence
- unacceptable return or refund terms for the category
- known fraud, sanctions, or merchant-risk flags
- manipulated or internally inconsistent reputation evidence

Delivery promises are estimates. Evaluate confirmed inventory, handling time, carrier service level, cut-off time, destination, weekends and holidays, customs risk, selected shipping method, and historical or simulated reliability.

Return an estimated arrival window, confidence, and whether each hard or soft deadline is satisfied.

- A hard deadline must pass the policy-configured confidence threshold or become `ASK_USER` or `REJECT`.
- A soft deadline may affect ranking but cannot override hard product, price, or seller rules.
- State “estimated delivery tomorrow by 12:00 with 87% confidence,” not “will arrive tomorrow,” when only an estimate is available.

## Purchase decisions

The deterministic policy engine returns exactly one decision plus structured reason codes and evidence references:

| Decision               | Meaning                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `REJECT`               | A hard product, price, seller, delivery, mandate, or safety rule failed                 |
| `WAIT_AND_MONITOR`     | No eligible exact offer exists now, but the confirmed brief permits waiting            |
| `PROPOSE_ALTERNATIVES` | Eligible alternatives exist within explicitly allowed flexibility                      |
| `ASK_USER`             | Material information is missing, ambiguous, changed, or borderline                     |
| `READY_FOR_APPROVAL`   | The offer is eligible, but the mandate requires one-tap human approval                  |
| `AUTO_BUY`             | Every hard gate passes and the active mandate explicitly permits autonomous purchasing |

The model may explain the result in natural language. It may not replace the decision, alter reason codes, or bypass a failed gate.

`AUTO_BUY` is allowed only when all of the following are true:

1. Every hard product criterion passes.
2. The final checkout quote is verified and does not exceed the hard cap.
3. The seller tier is allowed by the mandate and no hard blocker exists.
4. Product authenticity and listing-integrity risk are acceptable.
5. Every hard delivery requirement passes.
6. No material information remains unresolved.
7. The user explicitly enabled autonomous purchasing for this scope.
8. The mandate is active, unexpired, unrevoked, and within quantity and order-count limits.
9. No duplicate or conflicting order exists.
10. The merchant, product fingerprint, quantity, currency, and amount match the verified candidate and checkout quote.

## Mandates and payment authorization

A `PurchaseMandate` is a versioned, revocable, server-stored authorization containing:

- user and mandate identifiers
- normalized product fingerprint and quantity
- hard maximum total and ISO currency
- allowed seller tiers or merchant restrictions
- delivery destination and any hard deadline
- allowed alternatives and flexible attributes
- whether auto-buy is enabled
- maximum order count or aggregate amount
- creation, confirmation, expiry, revocation, and version metadata

Rules:

- Standing consent must be explicit and confirmed before activation.
- Changing a hard criterion, cap, seller scope, deadline, quantity, or autonomy level creates a new mandate version and requires renewed consent.
- Borderline cases escalate; the model must not stretch the mandate through interpretation.
- Raw payment credentials are never exposed to the model or browser.
- Runtime payment credentials remain server-side secrets.

The payment layer accepts only a short-lived `PurchaseAuthorizationEnvelope` created after `AUTO_BUY` or after the user approves `READY_FOR_APPROVAL`. It must bind at least:

- mandate ID and version
- candidate and merchant IDs
- product fingerprint and quantity
- verified amount and currency
- maximum authorized amount
- seller tier
- delivery commitment
- reason codes
- expiry
- idempotency key

Immediately before execution, revalidate mandate state, merchant, product, amount, currency, expiry, and idempotency. Any mismatch blocks payment. Duplicate-purchase protection is mandatory.

The weekend demo does not require production PSP integration. Use a deterministic checkout and payment simulator, and never claim that real money moved.

## Receipts and Wallet

Create two separate records after a successful simulated or real purchase:

- `MerchantReceipt`: merchant, order ID, product, quantity, item price, discounts, shipping, taxes, duties, fees, final amount, payment reference, purchase time, delivery state, and return or refund information
- `DecisionReceipt`: brief and mandate versions, hard-criterion results, product-match evidence, landed-cost breakdown, seller tier and risk flags, delivery estimate, applied policy rules, decision, reason codes, authorization ID, and timestamps

A decision receipt is an audit trail of facts, calculations, and applied rules. Do not store or expose hidden chain-of-thought as the explanation.

The target product supports Apple Wallet and Google Wallet through a shared wallet abstraction. A pass or card should expose:

- product and merchant
- amount paid and order ID
- purchase date
- delivery estimate and current status
- tracking action
- return deadline and warranty summary when available
- links to the full merchant receipt, decision receipt, and support

Lifecycle states should include `PURCHASED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `RETURN_AVAILABLE`, `REFUNDED`, and `CANCELLED`.

For the demo, one real Wallet provider or a clearly labelled Wallet-compatible in-app pass is acceptable. Do not state that a pass was added until pass generation succeeds.

## Evaluation and safety invariants

Use deterministic eval scenarios with ground-truth decisions. Include at least:

- wrong size, variant, condition, or compatibility
- fuzzy-title false matches
- counterfeit and bait listings
- fake reference prices and expired coupons
- hidden shipping, taxes, duties, marketplace fees, and FX traps
- seller-review manipulation and blocked sellers
- false next-day delivery promises
- exact-match unavailability, restocks, and sale events
- allowed and disallowed alternatives
- price or terms changing between discovery and checkout
- revoked, expired, exceeded, or duplicated mandates

Track autonomous-buy precision, false-buy rate, hard-cap violations, opportunity capture rate, unnecessary escalation rate, clarification precision, exact-match accuracy, and receipt or Wallet-pass success rate.

Zero-tolerance invariants:

```text
hard-cap violations = 0
wrong-hard-attribute autonomous purchases = 0
blocked-seller autonomous purchases = 0
duplicate autonomous purchases = 0
```

## Repository conventions

- Use Bun, not npm, pnpm, or yarn.
- Use strict TypeScript. Avoid `any` and unsafe casts.
- Keep every source script (`.ts`, `.tsx`, `.js`, and `.jsx`) at or below 500 lines. Split larger implementations by feature responsibility into focused modules; do not evade the limit by minifying or compressing formatting.
- Organize code by clear ownership: routes compose pages, components own presentation, and server/domain modules own validation, persistence, and external integrations.
- Validate model, browser, search, simulator, and checkout payloads at the trusted boundary with Zod or an equivalent strict schema.
- Prefer pure functions and explicit reason-code unions for purchase math and policy decisions.
- Use file-based TanStack routes in `src/routes`.
- Prefer HeroUI v3 components over recreating accessible controls. Import from `@heroui/react`; do not use HeroUI v2 packages or patterns.
- HeroUI interactions use `onPress`, not `onClick`.
- Keep `resolve.dedupe: ['react', 'react-dom']` in Vite. A single React copy is required by React Aria overlays.
- Use Tailwind v4 and the design tokens in `src/index.css`.
- Keep secrets out of source, docs, Git, and command output. Local secrets belong in ignored `.env` or `.dev.vars` files; production secrets belong in Cloudflare Worker secrets.
- Do not commit generated build output (`dist`) or dependencies (`node_modules`).

## Realtime agent and product UI

- Voice transport uses the same-origin `/api/realtime` WebSocket proxy to OpenAI's `gpt-realtime-2.1` model. Keep the API key server-side as the `OPENAI_API_KEY` Worker secret.
- After every `search_products` call, the Worker orchestrates one independent `gpt-5.6-luna` audit subagent per listing in parallel through `src/product-analysis.ts`. Each subagent sees only its listing evidence and returns strict price, offer, and seller verdicts.
- Listing-audit results stream as per-card `markit.analysis` events. Audits never block the voice reply, stale generations are dropped, and cards render pending, failed, and per-check verdict states.
- The voice model does not see independent audit results and must never claim their verdicts. Purchase policy must treat unavailable required evidence conservatively rather than assuming a pass.
- The model alone opens, updates, and closes product results through `control_product_display`. The client reacts to `markit.products` events; do not automatically show results or add a separate manual panel toggle.
- Product presentation uses HeroUI v3 compound `Card`, `Link`, and controlled `Drawer` APIs. Shared card data is typed in `src/product-types.ts`; desktop and mobile rendering lives in `src/components/ProductResults.tsx`.
- The primary interface remains the reactive voice orb with a compact status indicator. Desktop results open in the right-hand panel and shift the orb left; viewports below 900px use a controlled bottom `Drawer`.
- Add clarification, mandate-confirmation, purchase-progress, and receipt surfaces through typed server events and controlled HeroUI components. Use one grouped accessible modal or sheet for material clarification, and make the final item, amount, delivery estimate, and Wallet action immediately visible. Never render untrusted model-generated HTML.
- The Worker injects the trusted prompt and tools into every `session.update`; never trust browser-supplied instructions or tool definitions.
- Microphone audio is mono PCM16 at 24 kHz. Use semantic VAD with automatic response creation and interruption enabled.
- WebSocket playback is client-managed. On `input_audio_buffer.speech_started`, stop every queued audio source immediately and send `conversation.item.truncate` with the played duration. Ignore late deltas from interrupted responses, and never allow two response queues to play concurrently.

## Deployment

The Worker is named `markit-ai` and configured in `wrangler.toml`. `bun run build` emits `dist/server/wrangler.json`; deploy that generated configuration with Wrangler.

`.github/workflows/deploy.yml` is the production CI/CD pipeline. Pull requests to `main` run the verification gate. Pushes to `main` and manual dispatches run the same gate and then deploy the already-built output, avoiding a duplicate install or build. The workflow uses the latest Bun canary, a frozen lockfile, Bun's package cache, least-privilege GitHub permissions, and concurrency cancellation for superseded runs.

GitHub Actions requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets. Runtime secrets such as `OPENAI_API_KEY` remain Worker secrets and are preserved across deployments. Never write credential values into tracked files or workflow YAML.

After every completed change, run `bun run verify`, commit only the files changed for the task, and push the commit. Do not wait for the user to request deployment. The push deploys automatically; verify the workflow and live URL when deployment behavior changes or a failure is reported.

## UI work

For any task that designs, implements, or reviews frontend UI, read and follow [`skills/refine-ui/SKILL.md`](skills/refine-ui/SKILL.md) before making changes. Use its review checklist before handoff.

Keep the licensed Refactoring UI source files in `/Users/oskalbarczyk/Downloads/Refactoring_UI`; never copy or commit the full source materials into this repository.
