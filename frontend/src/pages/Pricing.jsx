import React, { useMemo } from 'react';
import { useAuthToken } from '../hooks/useAuthToken';
import { startCheckout, stripeEnabled } from '../lib/api';
import '../styles/pricing.css';

const PLANS = [
  { key: 'BASIC', tier: 'basic', name: 'Basic', price: '€20', note: '200 messages / mo' },
  { key: 'MEDIUM', tier: 'medium', name: 'Medium', price: '€30', note: '400 messages / mo' },
  { key: 'INTENSIVE', tier: 'intensive', name: 'Intensive', price: '€50', note: '2,000 messages / mo' },
  { key: 'TOTAL', tier: 'total', name: 'Total', price: '€90', note: '6,000+ messages / mo' },
];

export default function Pricing({ onClose }) {
  const { user } = useAuthToken();
  const enabled = useMemo(() => stripeEnabled(), []);

  async function buy(plan) {
    if (!user?.uid) {
      window.dispatchEvent(new CustomEvent('lucia:show-login'));
      return;
    }
    if (!enabled) {
      alert('Checkout is temporarily unavailable. Please try again later.');
      return;
    }
    await startCheckout(plan.tier, { uid: user.uid, email: user.email || undefined });
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
                title={enabled ? `Choose ${p.name}` : 'Checkout currently unavailable'}
                onClick={() => buy(p)}
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
