import React, { useMemo } from 'react';
import { useAuthToken } from '../hooks/useAuthToken';
import { createCheckoutSession, stripeEnabled } from '../lib/api';
import '../styles/pricing.css';

const PLANS = [
  { key: 'BASIC',     name: 'Basic',     priceId: 'price_BASIC_EUR',     price: '€20',   note: '200 messages / mo' },
  { key: 'MEDIUM',    name: 'Medium',    priceId: 'price_MEDIUM_EUR',    price: '€30',   note: '400 messages / mo' },
  { key: 'INTENSIVE', name: 'Intensive', priceId: 'price_INTENSIVE_EUR', price: '€50',   note: '2,000 messages / mo' },
  { key: 'TOTAL',     name: 'Total',     priceId: 'price_TOTAL_EUR',     price: '€90',   note: '6,000+ messages / mo' },
];

export default function Pricing({ onClose }) {
  const { user } = useAuthToken();
  const enabled = useMemo(() => stripeEnabled(), []);

  async function buy(priceId) {
    if (!user?.uid) {
      window.dispatchEvent(new CustomEvent('lucia:show-login'));
      return;
    }
    if (!enabled) {
      alert('Owner must plug Stripe keys and API URL to enable checkout.');
      return;
    }
    const { url } = await createCheckoutSession(priceId, user.uid);
    window.location.href = url;
  }

  return (
    <div className="pricing-overlay">
      <div className="pricing-panel" role="dialog" aria-modal="true" aria-label="Pricing and Plans">
        <div className="pricing-header">
          <h3 className="pricing-title">Pricing & Plans</h3>
          <button className="pricing-close" aria-label="Close" onClick={onClose}>✕</button>
        </div>

        <p className="pricing-subtext">
          EUR • Monthly billing • No Stripe trials (app uses 12-message courtesy).
        </p>

        <div className="plan-grid">
          {PLANS.map((p) => (
            <div key={p.key} className="plan-card">
              <div className="plan-name">{p.name}</div>
              <div className="plan-price">{p.price}</div>
              <div className="plan-note">{p.note}</div>
              <button
                className="plan-cta"
                disabled={!enabled}
                title={enabled ? `Choose ${p.name}` : 'Checkout disabled until owner connects Stripe'}
                onClick={() => buy(p.priceId)}
              >
                {enabled ? `Choose ${p.name}` : 'Checkout disabled'}
              </button>
            </div>
          ))}
        </div>

        <div className="pricing-footnote">
          Manage or cancel later via <strong>Account → Billing</strong> once Stripe is connected.
        </div>
      </div>
    </div>
  );
}
