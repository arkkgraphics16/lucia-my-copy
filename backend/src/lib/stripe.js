async function createCheckoutSession(_payload) {
  // Dev-safe stub. Replace with real Stripe SDK usage.
  return { id: `cs_test_${Date.now()}` };
}
module.exports = { createCheckoutSession };
