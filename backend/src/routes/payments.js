const router = require('express').Router();
const {
  createCheckoutSession,
  createPortalSession,
  verifyWebhookSignature,
  handleWebhookEvent,
} = require('../lib/stripe');

router.post('/create-checkout-session', async (req, res) => {
  try {
    const { priceId, uid, email } = req.body || {};
    const session = await createCheckoutSession({ priceId, uid, email });
    return res.json({ url: session.url, id: session.id });
  } catch (err) {
    const status = err?.statusCode || 500;
    const message = err?.message || 'Failed to create checkout session';
    console.error('Stripe checkout error', { message, code: err?.code });
    return res.status(status).json({ error: err?.code || 'checkout_failed', message });
  }
});

router.post('/create-portal-session', async (req, res) => {
  try {
    const { uid, email } = req.body || {};
    const session = await createPortalSession({ uid, email });
    return res.json({ url: session.url, id: session.id });
  } catch (err) {
    const status = err?.statusCode || 500;
    const message = err?.message || 'Failed to create billing portal session';
    console.error('Stripe portal error', { message, code: err?.code });
    return res.status(status).json({ error: err?.code || 'portal_failed', message });
  }
});

async function webhookHandler(req, res) {
  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing stripe-signature header');
  }
  try {
    const event = await verifyWebhookSignature(req.body, signature);
    await handleWebhookEvent(event);
    return res.status(200).json({ received: true });
  } catch (err) {
    const status = err?.statusCode || 400;
    const message = err?.message || 'Webhook signature verification failed';
    console.error('Stripe webhook error', { message, code: err?.code });
    return res.status(status).send(`Webhook Error: ${message}`);
  }
}

module.exports = {
  router,
  webhookHandler,
};
