'use strict';
const fs = require('fs');
const path = require('path');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch {}

// Cấu hình SMTP: ưu tiên env, fallback data/smtp.json (đã gitignore). Chưa có => email tắt.
function readConfig() {
  const env = process.env;
  if (env.SMTP_HOST && env.SMTP_USER) {
    return { host: env.SMTP_HOST, port: Number(env.SMTP_PORT) || 587, user: env.SMTP_USER, pass: env.SMTP_PASS, from: env.SMTP_FROM || env.SMTP_USER, secure: String(env.SMTP_SECURE) === 'true' };
  }
  try {
    const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
    const p = path.join(dir, 'smtp.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  return null;
}

let cfg = readConfig();
let transporter = null;
if (cfg && nodemailer) {
  try {
    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port || 587,
      secure: !!cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      disableFileAccess: true,
      disableUrlAccess: true,
      tls: { rejectUnauthorized: true },
    });
  } catch {}
}

function enabled() { return !!transporter; }

function validateRecipient(to) {
  const recipient = String(to || '').trim();
  if (!recipient || recipient.length > 254 || /[\r\n:]/.test(recipient) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error('Địa chỉ email người nhận không hợp lệ.');
  }
  return recipient;
}

async function send({ to, subject, text, html, icsContent }) {
  if (!transporter) return { sent: false, reason: 'SMTP chưa cấu hình (email tắt)' };
  const recipient = validateRecipient(to);
  const safeSubject = String(subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
  const msg = {
    from: cfg.from || cfg.user,
    to: recipient,
    subject: safeSubject,
    text: text == null ? undefined : String(text),
    html: html == null ? undefined : String(html),
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  if (icsContent) msg.attachments = [{ filename: 'su-kien.ics', content: icsContent, contentType: 'text/calendar' }];
  await transporter.sendMail(msg);
  return { sent: true };
}

module.exports = { enabled, send, validateRecipient };
