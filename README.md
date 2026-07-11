# markit.ai

A realtime voice experience powered by OpenAI `gpt-realtime-2.1` over WebSockets.

## Development

```bash
bun install
bun run dev
```

## Verify and deploy

```bash
bun run verify
bun run deploy
```

See [`AGENTS.md`](./AGENTS.md) for the stack and repository conventions.

## Stripe billing

Billing uses Stripe-hosted Checkout and the customer portal. The configured Stripe product must
have an active default price. Set secrets locally in `.dev.vars` and in production with Wrangler;
never commit credential values.

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

`STRIPE_PRODUCT_ID` is optional and defaults to the test product configured in the app. Stripe's
publishable key is not required because card details are collected entirely on Stripe's hosted
page. Apply the D1 migration before using billing locally:

```bash
bun x wrangler d1 migrations apply DB --local
```

Configure the Stripe webhook destination as `https://<your-host>/api/billing/webhook` and subscribe
to `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`customer.subscription.updated`, and `customer.subscription.deleted`. Production migrations run
automatically before deployment.
