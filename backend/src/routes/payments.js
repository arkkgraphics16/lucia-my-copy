const router = require('express').Router();
const { createCheckoutSession } = require('../lib/stripe');

// Create Checkout session (stub)
router.post('/create-session', async (req, res) => {
  const session = await createCheckoutSession(req.body || {});
  return res.json({ id: session.id });
});

// Webhook (stub)
router.post('/webhook', (req, res) => {
  // In prod: verify signature with STRIPE_WEBHOOK_SECRET
  return res.status(200).end();
});

module.exports = router;
