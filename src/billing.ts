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

async function stripeCustomer(stripe: Stripe, email: string) {
  const customers = await stripe.customers.list({ email, limit: 1 })
  return customers.data[0] ?? null
}

async function hasActivePurchase(stripe: Stripe, customerId: string, productId: string) {
  const [subscriptions, sessions] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 }),
    stripe.checkout.sessions.list({ customer: customerId, limit: 100 }),
  ])
  const activeSubscription = subscriptions.data.some(
    (subscription) =>
      ['active', 'trialing'].includes(subscription.status) &&
      subscription.items.data.some((item) => stripeId(item.price.product) === productId),
  )
  const completedPayment = sessions.data.some(
    (session) =>
      session.metadata?.productId === productId &&
      session.status === 'complete' &&
      session.payment_status !== 'unpaid',
  )
  return activeSubscription || completedPayment
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
  const customer = await stripeCustomer(stripe, user.email)
  if (customer && (await hasActivePurchase(stripe, customer.id, productId))) {
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
    ...(customer ? { customer: customer.id } : { customer_email: user.email }),
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },
    metadata: { userId: user.id, productId },
    ...(price.recurring ? { subscription_data: { metadata: { userId: user.id, productId } } } : {}),
    ...(!price.recurring && !customer ? { customer_creation: 'always' as const } : {}),
  })

  if (!checkout.url) throw new Error('Stripe did not return a checkout URL.')
  return Response.json({ url: checkout.url })
}

async function productDetails(request: Request, env: BillingEnv) {
  if (request.method !== 'GET') return jsonError('Method not allowed.', 405)
  if (!env.STRIPE_SECRET_KEY) return jsonError('Payments are not configured.', 503)
  const user = await authenticatedUser(request, env)
  if (!user) return jsonError('Authentication required.', 401)

  const stripe = stripeClient(env.STRIPE_SECRET_KEY)
  const { product, price } = await configuredPrice(
    stripe,
    env.STRIPE_PRODUCT_ID || DEFAULT_STRIPE_PRODUCT_ID,
  )
  const customer = await stripeCustomer(stripe, user.email)
  const active = customer ? await hasActivePurchase(stripe, customer.id, product.id) : false
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
      active,
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
  if (!env.STRIPE_SECRET_KEY) return jsonError('Payments are not configured.', 503)
  const user = await authenticatedUser(request, env)
  if (!user) return jsonError('Authentication required.', 401)
  const stripe = stripeClient(env.STRIPE_SECRET_KEY)
  const customer = await stripeCustomer(stripe, user.email)
  if (!customer) return jsonError('No Stripe customer is linked.', 404)

  const portal = await stripe.billingPortal.sessions.create({
    customer: customer.id,
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

  return Response.json({ received: true, type: event.type })
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
