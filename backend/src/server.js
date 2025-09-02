"use strict";

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const securePrompts = require('./routes/securePrompts');
const files = require('./routes/files');
const payments = require('./routes/payments');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

app.use('/api/secure-prompts', securePrompts);
app.use('/api/files', files);
app.use('/api/pay', payments);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on :${port}`));
