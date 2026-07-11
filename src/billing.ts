import Stripe from 'stripe'

import { createAuth, type AuthEnv } from './auth'

const DEFAULT_STRIPE_PRODUCT_ID = 'prod_Urj7QNd3trRglv'

export type BillingEnv = AuthEnv & {
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  STRIPE_PRODUCT_ID?: string
}

type AuthenticatedUser = {
  id: string
  email: string
}

function jsonError(message: string, status: number) {
  return Response.json({ message }, { status })
}

function stripeClient(secretKey: string) {
  return new Stripe(secretKey, { httpClient: Stripe.createFetchHttpClient() })
}

async function authenticatedUser(
  request: Request,
  env: BillingEnv,
): Promise<AuthenticatedUser | null> {
  const auth = createAuth(request, env)
  if (!auth) return null
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user ? { id: session.user.id, email: session.user.email } : null
}

async function configuredPrice(stripe: Stripe, productId: string) {
  const product = await stripe.products.retrieve(productId, { expand: ['default_price'] })
  if (!product.active || !product.default_price || typeof product.default_price === 'string') {
    throw new Error('The configured Stripe product needs an active default price.')
  }
  if (!product.default_price.active) throw new Error('The configured Stripe price is inactive.')
  return { product, price: product.default_price }
}

function stripeId(value: string | { id: string } | null): string | null {
  return typeof value === 'string' ? value : (value?.id ?? null)
}

async function syncCheckoutSession(env: BillingEnv, session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId
  if (!env.DB || !userId || session.payment_status === 'unpaid') return

  await env.DB.prepare(
    `UPDATE user
       SET billing_status = ?, stripe_customer_id = ?, stripe_subscription_id = ?,
           stripe_product_id = ?, updated_at = ?
     WHERE id = ?`,
  )
    .bind(
      'active',
      stripeId(session.customer),
      stripeId(session.subscription),
      session.metadata?.productId ?? null,
      Date.now(),
      userId,
    )
    .run()
}

async function syncSubscription(env: BillingEnv, subscription: Stripe.Subscription) {
  if (!env.DB) return
  const status = ['active', 'trialing'].includes(subscription.status)
    ? 'active'
    : subscription.status
  const product = subscription.items.data[0]?.price.product
  await env.DB.prepare(
    `UPDATE user
       SET billing_status = ?, stripe_subscription_id = ?, stripe_product_id = ?, updated_at = ?
     WHERE stripe_customer_id = ? OR id = ?`,
  )
    .bind(
      status,
      subscription.id,
      typeof product === 'string' ? product : (product?.id ?? null),
      Date.now(),
      stripeId(subscription.customer),
      subscription.metadata.userId || '',
    )
    .run()
}

async function createCheckout(request: Request, env: BillingEnv) {
  if (request.method !== 'POST') return jsonError('Method not allowed.', 405)
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return jsonError('Origin not allowed.', 403)
  }
  if (!env.STRIPE_SECRET_KEY) return jsonError('Payments are not configured.', 503)
  const user = await authenticatedUser(request, env)
  if (!user) return jsonError('Log in before starting checkout.', 401)

  const stripe = stripeClient(env.STRIPE_SECRET_KEY)
  const productId = env.STRIPE_PRODUCT_ID || DEFAULT_STRIPE_PRODUCT_ID
  const customer = env.DB
    ? await env.DB.prepare('SELECT stripe_customer_id, billing_status FROM user WHERE id = ?')
        .bind(user.id)
        .first<{ stripe_customer_id: string | null; billing_status: string }>()
    : null
  if (customer?.billing_status === 'active') {
    return jsonError('This account already has an active purchase.', 409)
  }
  const { price } = await configuredPrice(stripe, productId)
  const origin = new URL(request.url).origin

  const checkout = await stripe.checkout.sessions.create({
    mode: price.recurring ? 'subscription' : 'payment',
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: `${origin}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/profile?checkout=cancelled`,
    client_reference_id: user.id,
    ...(customer?.stripe_customer_id
      ? { customer: customer.stripe_customer_id }
      : { customer_email: user.email }),
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },
    metadata: { userId: user.id, productId },
    ...(price.recurring ? { subscription_data: { metadata: { userId: user.id, productId } } } : {}),
  })

  if (!checkout.url) throw new Error('Stripe did not return a checkout URL.')
  return Response.json({ url: checkout.url })
}

async function productDetails(request: Request, env: BillingEnv) {
  if (request.method !== 'GET') return jsonError('Method not allowed.', 405)
  if (!env.STRIPE_SECRET_KEY) return jsonError('Payments are not configured.', 503)
  if (!(await authenticatedUser(request, env))) return jsonError('Authentication required.', 401)

  const stripe = stripeClient(env.STRIPE_SECRET_KEY)
  const { product, price } = await configuredPrice(
    stripe,
    env.STRIPE_PRODUCT_ID || DEFAULT_STRIPE_PRODUCT_ID,
  )
  return Response.json({
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      price: price.unit_amount,
      currency: price.currency.toUpperCase(),
      recurring: price.recurring
        ? { interval: price.recurring.interval, intervalCount: price.recurring.interval_count }
        : null,
    },
  })
}

async function checkoutStatus(request: Request, env: BillingEnv) {
  if (request.method !== 'GET') return jsonError('Method not allowed.', 405)
  if (!env.STRIPE_SECRET_KEY) return jsonError('Payments are not configured.', 503)
  const user = await authenticatedUser(request, env)
  if (!user) return jsonError('Authentication required.', 401)

  const id = new URL(request.url).searchParams.get('session_id')
  if (!id?.startsWith('cs_')) return jsonError('A valid checkout session is required.', 400)
  const session = await stripeClient(env.STRIPE_SECRET_KEY).checkout.sessions.retrieve(id)
  if (session.client_reference_id !== user.id) return jsonError('Checkout session not found.', 404)
  await syncCheckoutSession(env, session)

  return Response.json({
    status: session.status,
    paymentStatus: session.payment_status,
    customerEmail: session.customer_details?.email ?? session.customer_email,
  })
}

async function customerPortal(request: Request, env: BillingEnv) {
  if (request.method !== 'POST') return jsonError('Method not allowed.', 405)
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return jsonError('Origin not allowed.', 403)
  }
  if (!env.STRIPE_SECRET_KEY || !env.DB) return jsonError('Payments are not configured.', 503)
  const user = await authenticatedUser(request, env)
  if (!user) return jsonError('Authentication required.', 401)
  const record = await env.DB.prepare('SELECT stripe_customer_id FROM user WHERE id = ?')
    .bind(user.id)
    .first<{ stripe_customer_id: string | null }>()
  if (!record?.stripe_customer_id) return jsonError('No Stripe customer is linked.', 404)

  const portal = await stripeClient(env.STRIPE_SECRET_KEY).billingPortal.sessions.create({
    customer: record.stripe_customer_id,
    return_url: `${new URL(request.url).origin}/profile`,
  })
  return Response.json({ url: portal.url })
}

async function stripeWebhook(request: Request, env: BillingEnv) {
  if (request.method !== 'POST') return jsonError('Method not allowed.', 405)
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return jsonError('Stripe webhook is not configured.', 503)
  }
  const signature = request.headers.get('stripe-signature')
  if (!signature) return jsonError('Missing Stripe signature.', 400)

  const stripe = stripeClient(env.STRIPE_SECRET_KEY)
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      await request.text(),
      signature,
      env.STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )
  } catch {
    return jsonError('Invalid Stripe signature.', 400)
  }

  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    await syncCheckoutSession(env, event.data.object)
  } else if (
    event.type === 'customer.subscription.updated' ||
    event.type === 'customer.subscription.deleted'
  ) {
    await syncSubscription(env, event.data.object)
  }

  return Response.json({ received: true })
}

export async function handleBillingRequest(request: Request, env: BillingEnv) {
  try {
    const pathname = new URL(request.url).pathname
    if (pathname === '/api/billing/checkout') return await createCheckout(request, env)
    if (pathname === '/api/billing/product') return await productDetails(request, env)
    if (pathname === '/api/billing/session') return await checkoutStatus(request, env)
    if (pathname === '/api/billing/portal') return await customerPortal(request, env)
    if (pathname === '/api/billing/webhook') return await stripeWebhook(request, env)
    return jsonError('Billing endpoint not found.', 404)
  } catch {
    return jsonError('The payment request could not be completed.', 502)
  }
}
