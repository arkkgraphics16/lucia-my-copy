const Stripe = require('stripe');
const { getSecretValue, parseSecretValue } = require('./secrets');

let stripeClientPromise = null;
let stripeSecretsPromise = null;

const DEFAULT_SUCCESS_URL = 'https://www.luciadecode.com/success';
const DEFAULT_CANCEL_URL = 'https://www.luciadecode.com/cancel';

function getUrls() {
  const successUrl = (process.env.STRIPE_SUCCESS_URL || DEFAULT_SUCCESS_URL).trim();
  const cancelUrl = (process.env.STRIPE_CANCEL_URL || DEFAULT_CANCEL_URL).trim();
  const portalReturnUrl = (process.env.STRIPE_PORTAL_RETURN_URL || successUrl).trim();
  return { successUrl, cancelUrl, portalReturnUrl };
}

async function loadStripeSecrets() {
  if (!stripeSecretsPromise) {
    stripeSecretsPromise = (async () => {
      const directKey = (process.env.STRIPE_SECRET_KEY || '').trim();
      const directWebhook =
        (process.env.STRIPE_WEBHOOK_SECRET || process.env.WEBHOOK_SIGNING_SECRET || '').trim();

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
        parsed.WEBHOOK_SIGNING_SECRET ||
        parsed.STRIPE_WEBHOOK_SECRET ||
        parsed.webhookSecret ||
        parsed.webhook ||
        parsed.whsec ||
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
        apiVersion: process.env.STRIPE_API_VERSION || '2024-06-20',
      });
      return stripe;
    })();
  }
  return stripeClientPromise;
}

function escapeSearchTerm(term) {
  return String(term ?? '').replace(/[\"']/g, ' ');
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
  const params = { metadata: {} };
  if (uid) params.metadata.firebase_uid = uid;
  if (email) params.email = email;
  return stripe.customers.create(params);
}

function resolveTierPrice(tier) {
  const prices = {
    basic:
      process.env.PRICE_BASIC ||
      process.env.STRIPE_PRICE_BASIC ||
      process.env.VITE_STRIPE_PRICE_BASIC,
    medium:
      process.env.PRICE_MEDIUM ||
      process.env.STRIPE_PRICE_MEDIUM ||
      process.env.VITE_STRIPE_PRICE_MEDIUM,
    intensive:
      process.env.PRICE_INTENSIVE ||
      process.env.STRIPE_PRICE_INTENSIVE ||
      process.env.VITE_STRIPE_PRICE_INTENSIVE,
    total:
      process.env.PRICE_TOTAL ||
      process.env.STRIPE_PRICE_TOTAL ||
      process.env.VITE_STRIPE_PRICE_TOTAL,
  };

  const value = prices[String(tier || '').toLowerCase()];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.startsWith('price_') ? trimmed : null;
}

async function createCheckoutSessionForTier({ tier, uid, email }) {
  const price = resolveTierPrice(tier);
  if (!price) {
    const err = new Error('Invalid or missing price for tier');
    err.statusCode = 400;
    err.code = 'invalid_tier';
    throw err;
  }

  const stripe = await getStripeClient();
  const { successUrl, cancelUrl } = getUrls();
  const normalizedTier = String(tier || '').toLowerCase();
  const isSubscription = normalizedTier !== 'total';

  const metadata = { tier: normalizedTier };
  if (uid) metadata.firebase_uid = uid;

  const params = {
    mode: isSubscription ? 'subscription' : 'payment',
    line_items: [{ price, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    metadata,
  };

  if (uid) {
    params.client_reference_id = uid;
  }

  if (isSubscription) {
    params.subscription_data = { metadata };
  } else {
    params.payment_intent_data = { metadata };
  }

  if (uid || email) {
    try {
      const customer = await getOrCreateCustomer(stripe, { uid, email });
      if (customer?.id) {
        params.customer = customer.id;
      }
    } catch (err) {
      console.warn('Failed to attach existing customer, falling back to email', err.message);
      if (email) {
        params.customer_email = email;
      }
    }
  } else if (email) {
    params.customer_email = email;
  }

  if (!params.customer && email && !params.customer_email) {
    params.customer_email = email;
  }

  const session = await stripe.checkout.sessions.create(params);
  return { id: session.id, url: session.url };
}

async function createPortalSession({ uid, email }) {
  if (!uid && !email) {
    throw Object.assign(new Error('uid or email is required to open the billing portal'), {
      statusCode: 400,
    });
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
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
  return Stripe.webhooks.constructEvent(payload, signatureHeader, webhookSecret);
}

async function handleWebhookEvent(event) {
  const loggable = {
    id: event?.id,
    type: event?.type,
  };

  try {
    switch (event?.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed':
        console.info('Stripe webhook received', loggable);
        // TODO: Implement idempotent persistence of event.id and update entitlements for the user.
        break;
      default:
        console.debug('Stripe webhook ignored', loggable);
        break;
    }
  } catch (err) {
    console.error('Stripe webhook handler error', { ...loggable, error: err.message });
    throw err;
  }
}

module.exports = {
  createCheckoutSessionForTier,
  createPortalSession,
  verifyWebhookSignature,
  handleWebhookEvent,
};
