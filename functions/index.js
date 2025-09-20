// ESM + firebase-functions v1 API (works with 4.x)
import functions from "firebase-functions"; // NOTE: default import (CJS interop)
import admin from "firebase-admin";

admin.initializeApp();

const REGION = "europe-west3";
const MAIL_COLLECTION = "mail";

const BRAND = {
  from: "Lucía <hello@luciadecode.com>",
  replyTo: "lucia.decode@proton.me",
  appName: "Lucía",
  continueUrl: process.env.APP_CONTINUE_URL || "https://app.luciadecode.com",
  helpUrl: "https://luciadecode.com",
  supportEmail: "lucia.decode@proton.me",
};

function renderEmail({ displayName, hasVerificationLink, verifyUrl }) {
  const greeting = displayName ? `Hi ${displayName},` : "Hi,";

  const styles = `
    .container{max-width:560px;margin:0 auto;background:#0b1623;color:#eaf2ff;border-radius:16px;overflow:hidden;font-family:Inter,Segoe UI,Arial,sans-serif}
    .header{padding:28px 28px 0}
    .brand{font-weight:700;font-size:22px;letter-spacing:.3px}
    .card{background:#111c2b;margin:16px;border-radius:12px;padding:20px}
    .btn{display:inline-block;text-decoration:none;padding:12px 18px;border-radius:10px;background:#3a7afe;color:#fff;font-weight:600}
    .muted{color:#a7b6cc;font-size:13px}
    .footer{padding:20px 28px 28px}
    a{color:#8fc1ff}
    h2{margin:16px 0 6px}
    p{line-height:1.55}
  `;

  const confirmBlock = hasVerificationLink
    ? `
      <div class="card" style="text-align:center">
        <p>Please confirm your account by clicking the button below:</p>
        <p style="margin:18px 0">
          <a class="btn" href="${verifyUrl}">Confirm Account</a>
        </p>
        <p class="muted">This link expires after a short time. If it’s expired, sign in and request a new one.</p>
      </div>`
    : `
      <div class="card">
        <p>Your email is already verified. You’re all set 🎯</p>
      </div>`;

  return `
  <div class="container">
    <div class="header">
      <div class="brand">Lucía</div>
      <h2>Welcome — Your Conversations Are Private</h2>
    </div>

    <div style="padding:0 28px 12px">
      <p>${greeting}</p>
      <p>Thank you for registering with Lucía.</p>
    </div>

    ${confirmBlock}

    <div style="padding:0 28px">
      <p><strong>Privacy you can trust:</strong> All your conversations are encrypted before leaving your device. We cannot read them. Only you control your content.</p>

      <p>Lucía helps you find context and perspective through what we call <em>Digital Intuition</em>. To do this, she sometimes extracts a lot from almost nothing — she was designed to infer deeply, even from small details you may not be consciously aware of.</p>

      <p>She also includes a random, statistical component in her reasoning. That means sometimes she feels almost magical when she gets it right, while other times she may add a little noise or lose coherence. This will never be fully removed — and that’s what makes her unique.</p>

      <p>It’s also important to know that the underlying AI never gives the same answer twice. This variability is not even under our control — and that’s why we emphasize: Lucía is context, not absolute truth.</p>

      <p>Most of the time she will be very accurate, but her true value is not to predict everything exactly. Her real contribution is to provide context and illuminate blind spots — things that your own bias, personality, past experiences, or background might never let you see.</p>

      <p>Think of her like GPS: she guides you, but you remain the driver. You don’t drive off a cliff just because the map says the road continues, and you don’t enter a path too narrow for cars only because it looks shorter. You always keep your own judgment.</p>

      <div class="card">
        <p><strong>Your rights:</strong> You can request deletion of your email and account data at any time. Just send a message to our support team at <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a>, and we will remove it.</p>
      </div>
    </div>

    <div style="padding:0 28px 8px"><p class="muted">Need help? Email <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a> or visit <a href="${BRAND.helpUrl}">${BRAND.helpUrl}</a>.</p></div>
    <div class="footer"><p class="muted">Sent by Lucía. If this wasn’t you, you can ignore this message.</p></div>
  </div>
  <style>${styles}</style>`;
}

function renderText({ hasVerificationLink, verifyUrl }) {
  const lines = [];

  lines.push("Subject: Welcome to Lucía – Your Conversations Are Private");
  lines.push("");
  lines.push("Hi,");
  lines.push("");
  if (hasVerificationLink) {
    lines.push("Confirm your account:");
    lines.push(verifyUrl);
    lines.push("");
  } else {
    lines.push("Your email is already verified. You’re all set.");
    lines.push("");
  }
  lines.push("Privacy you can trust: Your conversations are encrypted before leaving your device. We cannot read them. Only you control your content.");
  lines.push("");
  lines.push("Lucía gives context through Digital Intuition — she sometimes infers a lot from very little, with a random component that makes her feel magical at times and off at others. The underlying AI never gives the same answer twice. That’s why her role is to provide context, not absolute truth.");
  lines.push("");
  lines.push("Think of her like GPS: she guides you, but you remain the driver. You don’t drive off a cliff just because the map says the road continues, and you don’t enter a path too narrow for cars only because it looks shorter.");
  lines.push("");
  lines.push(`You can request deletion of your email and account data anytime by writing to ${BRAND.supportEmail}.`);
  lines.push("");
  lines.push(`Need help? ${BRAND.supportEmail}`);

  return lines.join("\n");
}

export const sendWelcomeOnSignup = functions
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    const { uid, email, displayName, emailVerified } = user || {};
    if (!email) {
      functions.logger.warn(`User ${uid} has no email; skipping welcome email.`);
      return;
    }

    let verifyUrl = null;
    if (!emailVerified) {
      const actionCodeSettings = { url: BRAND.continueUrl, handleCodeInApp: false };
      verifyUrl = await admin.auth().generateEmailVerificationLink(email, actionCodeSettings);
    }

    const hasVerificationLink = !!verifyUrl;

    // Fixed subject per spec/doc
    const subject = "Welcome to Lucía – Your Conversations Are Private";

    const html = renderEmail({ displayName, hasVerificationLink, verifyUrl });
    const text = renderText({ hasVerificationLink, verifyUrl });

    await admin.firestore().collection(MAIL_COLLECTION).add({
      to: [email],
      from: BRAND.from,
      replyTo: BRAND.replyTo,
      message: { subject, text, html },
      meta: {
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        emailVerifiedAtSignup: !!emailVerified,
      },
    });

    functions.logger.info(`Queued welcome email for ${email} (uid=${uid}).`);
  });
