// ESM + Admin modular + Functions v1 compat
import * as functions from "firebase-functions/v1";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const app = initializeApp();
const auth = getAuth(app);
const db = getFirestore(app);

// ----- Config -----
const REGION = process.env.FUNCTIONS_REGION || "europe-west3";
const MAIL_COLLECTION = process.env.MAIL_COLLECTION || "mail";

const BRAND = {
  from: "Lucía <hello@luciadecode.com>",
  replyTo: "lucia.decode@proton.me",
  appName: "Lucía",
  continueUrl: process.env.APP_CONTINUE_URL || "https://app.luciadecode.com",
  helpUrl: "https://luciadecode.com",
  supportEmail: "lucia.decode@proton.me",
};

// ----- Renderers -----
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
      <p>Lucía helps you find context and perspective through what we call <em>Digital Intuition</em>…</p>
      <p>She also includes a random, statistical component…</p>
      <p>It’s also important to know that the underlying AI never gives the same answer twice…</p>
      <p>Most of the time she will be very accurate…</p>
      <p>Think of her like GPS…</p>
      <div class="card">
        <p><strong>Your rights:</strong> You can request deletion… <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a></p>
      </div>
    </div>
    <div style="padding:0 28px 8px"><p class="muted">Need help? Email <a href="mailto:${BRAND.supportEmail}">${BRAND.supportEmail}</a> or visit <a href="${BRAND.helpUrl}">${BRAND.helpUrl}</a>.</p></div>
    <div class="footer"><p class="muted">Sent by Lucía. If this wasn’t you, you can ignore this message.</p></div>
  </div>
  <style>${styles}</style>`;
}

function renderText({ hasVerificationLink, verifyUrl }) {
  const lines = [];
  lines.push("Subject: Welcome to Lucía – Your Conversations Are Private", "", "Hi:", "");
  if (hasVerificationLink) { lines.push("Confirm your account:", verifyUrl, ""); }
  else { lines.push("Your email is already verified. You’re all set.", ""); }
  lines.push(
    "Privacy you can trust: Your conversations are encrypted before leaving your device. We cannot read them. Only you control your content.",
    "",
    "Lucía gives context through Digital Intuition…",
    "",
    "Think of her like GPS…",
    "",
    `You can request deletion anytime by writing to ${BRAND.supportEmail}.`,
    "",
    `Need help? ${BRAND.supportEmail}`
  );
  return lines.join("\n");
}

// ----- Trigger -----
export const sendWelcomeOnSignup = functions
  .region(REGION)
  .auth.user()
  .onCreate(async (user) => {
    try {
      const { uid, email, displayName, emailVerified } = user || {};
      if (!email) {
        functions.logger.warn(`onCreate skip: uid=${uid} has no email`);
        return;
      }

      let verifyUrl = null;
      if (!emailVerified) {
        const actionCodeSettings = { url: BRAND.continueUrl, handleCodeInApp: false };
        verifyUrl = await auth.generateEmailVerificationLink(email, actionCodeSettings);
      }

      const subject = "Welcome to Lucía – Your Conversations Are Private";
      const html = renderEmail({ displayName, hasVerificationLink: !!verifyUrl, verifyUrl });
      const text = renderText({ hasVerificationLink: !!verifyUrl, verifyUrl });

      const ref = await db.collection(MAIL_COLLECTION).add({
        to: [email],
        from: BRAND.from,
        replyTo: BRAND.replyTo,
        message: { subject, text, html },
        meta: {
          uid,
          createdAt: FieldValue.serverTimestamp(),
          emailVerifiedAtSignup: !!emailVerified,
          source: "sendWelcomeOnSignup",
        },
      });

      functions.logger.info(`Queued welcome email doc ${ref.id} in /${MAIL_COLLECTION} for ${email} (uid=${uid})`);
    } catch (err) {
      functions.logger.error("Failed to queue welcome email", { err: String(err) });
      throw err;
    }
  });
