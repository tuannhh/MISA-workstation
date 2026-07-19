'use strict';
const fs = require('fs');
const path = require('path');

// Khóa Gemini: ưu tiên biến môi trường, fallback file data/gemini.key (đã gitignore).
// KHÔNG commit khóa vào repo.
function readKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  try {
    const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
    const p = path.join(dir, 'gemini.key');
    if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  } catch {}
  return '';
}

module.exports = {
  GEMINI_API_KEY: readKey(),
  GEMINI_TEXT_MODEL: process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash',
  GEMINI_IMAGE_MODEL: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
  GEMINI_BASE: 'https://generativelanguage.googleapis.com/v1beta',
  hasKey() { return !!readKey(); },
};
