const Stripe = require('stripe');
const { getSecretValue, parseSecretValue } = require('./secrets');

let stripeClientPromise = null;
let stripeSecretsPromise = null;

const DEFAULT_ALLOWED_PRICE_IDS = [
  'prod_T94vRkqGFkaXWG',
  'prod_T94zVM2gXLzNx3',
  'prod_T950su3vUkpPAc',
  'price_1SCmrg2NCNcgXLO1dIBQ75vR',
];

const allowedIds = new Set(
  (process.env.STRIPE_ALLOWED_PRICE_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
);
DEFAULT_ALLOWED_PRICE_IDS.forEach((id) => allowedIds.add(id));

function getUrls() {
  const successUrl = (process.env.STRIPE_SUCCESS_URL || 'https://www.luciadecode.com/success').trim();
  const cancelUrl = (process.env.STRIPE_CANCEL_URL || 'https://www.luciadecode.com/cancel').trim();
  const portalReturnUrl = (process.env.STRIPE_PORTAL_RETURN_URL || successUrl).trim();
  return { successUrl, cancelUrl, portalReturnUrl };
}

async function loadStripeSecrets() {
  if (!stripeSecretsPromise) {
    stripeSecretsPromise = (async () => {
      const directKey = (process.env.STRIPE_SECRET_KEY || '').trim();
      const directWebhook = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
      if (directKey) {
        return { secretKey: directKey, webhookSecret: directWebhook || null };
      }
      const secretId = (process.env.LUCIA_STRIPE_SECRET_ARN || '').trim();
      if (!secretId) {
        throw new Error('Stripe secret key not configured');
      }
      const rawSecret = await getSecretValue(secretId);
      const parsed = parseSecretValue(rawSecret);
      if (!parsed) {
        throw new Error(`Secret ${secretId} returned empty value`);
      }
      if (typeof parsed === 'string') {
        return { secretKey: parsed.trim(), webhookSecret: null };
      }
      const secretKey =
        parsed.STRIPE_SECRET_KEY ||
        parsed.secretKey ||
        parsed.key ||
        parsed.STRIPE_API_KEY ||
        '';
      const webhookSecret =
        parsed.STRIPE_WEBHOOK_SECRET ||
        parsed.webhookSecret ||
        parsed.webhook ||
        null;
      if (!secretKey) {
        throw new Error(`Secret ${secretId} does not contain a STRIPE_SECRET_KEY field`);
      }
      return { secretKey: secretKey.trim(), webhookSecret: webhookSecret ? webhookSecret.trim() : null };
    })();
  }
  return stripeSecretsPromise;
}

async function getStripeClient() {
  if (!stripeClientPromise) {
    stripeClientPromise = (async () => {
      const { secretKey } = await loadStripeSecrets();
      const stripe = new Stripe(secretKey, {
        apiVersion: process.env.STRIPE_API_VERSION || '2023-10-16',
      });
      return stripe;
    })();
  }
  return stripeClientPromise;
}

function ensureAllowed(priceIdOrProductId) {
  if (!allowedIds.size) return;
  if (allowedIds.has(priceIdOrProductId)) return;
  throw Object.assign(new Error(`Price or product not allowed: ${priceIdOrProductId}`), {
    statusCode: 400,
    code: 'price_not_allowed',
  });
}

function escapeSearchTerm(term) {
  return term.replace(/["']/g, ' ');
}

async function resolvePriceId(stripe, priceIdOrProductId) {
  if (priceIdOrProductId.startsWith('price_')) {
    return priceIdOrProductId;
  }
  if (!priceIdOrProductId.startsWith('prod_')) {
    return priceIdOrProductId;
  }
  const product = await stripe.products.retrieve(priceIdOrProductId, {
    expand: ['default_price'],
  });
  const defaultPrice = product?.default_price;
  if (!defaultPrice) {
    throw new Error(`Product ${priceIdOrProductId} has no default price`);
  }
  if (typeof defaultPrice === 'string') {
    return defaultPrice;
  }
  if (defaultPrice && defaultPrice.id) {
    return defaultPrice.id;
  }
  throw new Error(`Unable to resolve price for product ${priceIdOrProductId}`);
}

async function findCustomer(stripe, { uid, email }) {
  const candidates = [];
  if (uid) {
    try {
      const search = await stripe.customers.search({
        query: `metadata['firebase_uid']:'${escapeSearchTerm(uid)}'`,
        limit: 1,
      });
      if (search?.data?.length) {
        candidates.push(...search.data);
      }
    } catch (err) {
      if (err?.statusCode !== 404) {
        console.warn('Stripe customer search failed, falling back to list', err.message);
      }
    }
  }
  if (!candidates.length && email) {
    const list = await stripe.customers.list({ email, limit: 1 });
    if (list?.data?.length) {
      candidates.push(...list.data);
    }
  }
  return candidates[0] || null;
}

async function getOrCreateCustomer(stripe, { uid, email }) {
  const existing = await findCustomer(stripe, { uid, email });
  if (existing) return existing;
  const params = {
    metadata: uid ? { firebase_uid: uid } : {},
  };
  if (email) params.email = email;
  return stripe.customers.create(params);
}

async function createCheckoutSession({ priceId, uid, email }) {
  if (!priceId) {
    throw Object.assign(new Error('priceId is required'), { statusCode: 400 });
  }
  if (!uid) {
    throw Object.assign(new Error('uid is required'), { statusCode: 400 });
  }
  ensureAllowed(priceId);
  const stripe = await getStripeClient();
  const resolvedPriceId = await resolvePriceId(stripe, priceId);
  const customer = await getOrCreateCustomer(stripe, { uid, email });
  const { successUrl, cancelUrl } = getUrls();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customer.id,
    client_reference_id: uid,
    metadata: { firebase_uid: uid },
    subscription_data: { metadata: { firebase_uid: uid } },
    line_items: [{ price: resolvedPriceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });
  return { id: session.id, url: session.url };
}

async function createPortalSession({ uid, email }) {
  if (!uid && !email) {
    throw Object.assign(new Error('uid or email is required to open the billing portal'), { statusCode: 400 });
  }
  const stripe = await getStripeClient();
  const customer = await findCustomer(stripe, { uid, email });
  if (!customer) {
    const err = new Error('No Stripe customer found for user');
    err.statusCode = 404;
    err.code = 'customer_not_found';
    throw err;
  }
  const { portalReturnUrl } = getUrls();
  const session = await stripe.billingPortal.sessions.create({
    customer: customer.id,
    return_url: portalReturnUrl,
  });
  return { id: session.id, url: session.url };
}

async function verifyWebhookSignature(rawBody, signatureHeader) {
  const { webhookSecret } = await loadStripeSecrets();
  if (!webhookSecret) {
    throw Object.assign(new Error('Stripe webhook secret not configured'), { statusCode: 500 });
  }
  const stripe = await getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
}

async function handleWebhookEvent(event) {
  const loggable = {
    id: event?.id,
    type: event?.type,
  };
  switch (event?.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.payment_succeeded':
    case 'invoice.payment_failed':
      console.info('Stripe webhook received', loggable);
      break;
    default:
      console.debug('Stripe webhook ignored', loggable);
  }
}

module.exports = {
  createCheckoutSession,
  createPortalSession,
  verifyWebhookSignature,
  handleWebhookEvent,
};
