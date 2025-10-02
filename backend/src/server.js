"use strict";

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const securePrompts = require('./routes/securePrompts');
const chat = require('./routes/chat');
const files = require('./routes/files');
const { router: stripeRouter, payRouter, webhookHandler } = require('./routes/payments');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.post('/stripe/webhook', express.raw({ type: 'application/json' }), webhookHandler);
app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

app.use('/api/secure-prompts', securePrompts);
app.use('/api/chat', chat);
app.use('/api/files', files);
app.use('/api/pay', payRouter);
app.use('/stripe', stripeRouter);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on :${port}`));
