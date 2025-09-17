// ESM + firebase-functions v1 API (works with 4.x)
import functions from "firebase-functions"; // NOTE: default import (CJS interop)
import admin from "firebase-admin";

admin.initializeApp();

const REGION = "europe-west3";
const MAIL_COLLECTION = "mail";

const BRAND = {
  from: "hello@luciadecode.com>",
  replyTo: "lucia.decode@proton.me",
  appName: "Lucía Decode",
  continueUrl: process.env.APP_CONTINUE_URL || "https://app.luciadecode.com",
  helpUrl: "https://luciadecode.com"
};

function renderEmail({ displayName, hasVerificationLink, verifyUrl }) {
  const greeting = displayName ? `Hi ${displayName},` : "Hi there,";
  const styles = `
    .container{max-width:560px;margin:0 auto;background:#0b1623;color:#eaf2ff;border-radius:16px;overflow:hidden;font-family:Inter,Segoe UI,Arial,sans-serif}
    .header{padding:28px 28px 0}
    .brand{font-weight:700;font-size:22px;letter-spacing:.3px}
    .card{background:#111c2b;margin:16px;border-radius:12px;padding:20px}
    .btn{display:inline-block;text-decoration:none;padding:12px 18px;border-radius:10px;background:#3a7afe;color:#fff;font-weight:600}
    .muted{color:#a7b6cc;font-size:13px}
    .footer{padding:20px 28px 28px}
    a{color:#8fc1ff}
  `;
  const verifyBlock = hasVerificationLink
    ? `
      <div class="card" style="text-align:center">
        <p>Confirm your email to secure your workspace and enable backups.</p>
        <p style="margin:18px 0">
          <a class="btn" href="${verifyUrl}">Verify email</a>
        </p>
        <p class="muted">Link expires after a short time. If it’s expired, sign in and request a new one.</p>
      </div>`
    : `<div class="card"><p>Your email is already verified. You’re all set 🎯</p></div>`;

  return `
  <div class="container">
    <div class="header">
      <div class="brand">${BRAND.appName}</div>
      <h2 style="margin:16px 0 6px">Welcome to private, focused AI.</h2>
      <p class="muted">Fast. Minimal. Yours.</p>
    </div>
    <div style="padding:0 28px 12px">
      <p>${greeting}</p>
      <p>Thanks for signing up for <strong>${BRAND.appName}</strong>. You’ll get a clean chat UI, privacy-first defaults, and sensible limits.</p>
    </div>
    ${verifyBlock}
    <div style="padding:0 28px 8px"><p class="muted">Need help? See <a href="${BRAND.helpUrl}">${BRAND.helpUrl}</a></p></div>
    <div class="footer"><p class="muted">Sent by ${BRAND.appName}. If this wasn’t you, you can ignore this message.</p></div>
  </div>
  <style>${styles}</style>`;
}

function renderText({ hasVerificationLink, verifyUrl }) {
  const base = `Welcome to ${BRAND.appName}!\n\nThanks for signing up.`;
  if (!hasVerificationLink) {
    return `${base}\n\nYour email is already verified. You’re all set.\n\nHelp: ${BRAND.helpUrl}\n`;
  }
  return `${base}\n\nVerify your email to secure your workspace:\n${verifyUrl}\n\nThis link expires after a short time. If it’s expired, sign in and request a new one.\n\nHelp: ${BRAND.helpUrl}\n`;
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
    const subject = hasVerificationLink
      ? "Welcome to Lucía — verify your email"
      : "Welcome to Lucía — you’re in";
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
        emailVerifiedAtSignup: !!emailVerified
      }
    });

    functions.logger.info(`Queued welcome email for ${email} (uid=${uid}).`);
  });
