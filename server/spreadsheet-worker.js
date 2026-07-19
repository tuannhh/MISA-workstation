'use strict';

const { parentPort, workerData } = require('worker_threads');
const XLSX = require('xlsx');

const MAX_SHEETS = 12;
const MAX_ROWS_PER_SHEET = 500;
const MAX_COLUMNS_PER_SHEET = 80;
const MAX_SELECTED_ROWS_PER_SHEET = 120;
const MAX_OUTPUT_CHARS = 40000;
const CONTACT_SHEET = /danh\s*sách|khách\s*mời|đại\s*biểu|liên\s*hệ|contact|attendee/i;
const BUSINESS_KEYWORDS = /sự\s*kiện|chương\s*trình|tổ\s*chức|thời\s*gian|ngày|địa\s*điểm|quy\s*mô|hình\s*thức|mục\s*tiêu|thông\s*điệp|khách\s*mời|ngân\s*sách|kinh\s*phí|đồng\s*hành|tài\s*trợ|agenda|timeline|online|offline|hybrid/i;

function safeSheetName(value) {
  return String(value || 'Trang tính').replace(/[\r\n\t]/g, ' ').slice(0, 100);
}

function sanitizeCell(value, state) {
  let text = String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500);
  const before = text;
  text = text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL ĐÃ ẨN]')
    .replace(/(?:\+?84|0)\d(?:[\s.-]?\d){8,10}/g, '[SĐT ĐÃ ẨN]')
    .replace(/\b\d{9,16}\b/g, '[DÃY SỐ ĐÃ ẨN]');
  if (text !== before) state.redactedValues++;
  return text;
}

function rowsToText(rows, state) {
  return rows.map((row) => row.map((cell) => sanitizeCell(cell, state)).filter(Boolean).join(' | ')).filter(Boolean).join('\n');
}

function run() {
  const workbook = XLSX.read(Buffer.from(workerData.buffer), {
    type: 'buffer',
    dense: true,
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    sheetRows: MAX_ROWS_PER_SHEET + 1,
    WTF: false,
  });
  const sheetNames = workbook.SheetNames || [];
  if (!sheetNames.length) throw new Error('File Excel không có trang tính nào.');

  const selected = sheetNames.slice(0, MAX_SHEETS);
  const warnings = [];
  if (sheetNames.length > MAX_SHEETS) warnings.push(`File có ${sheetNames.length} trang tính; hệ thống đã đọc ${MAX_SHEETS} trang đầu tiên.`);

  let text = '';
  let sampled = false;
  const privacy = { redactedValues: 0, skippedContactSheets: 0 };
  const sheets = [];
  for (const name of selected) {
    if (text.length >= MAX_OUTPUT_CHARS) { sampled = true; break; }
    const sheet = workbook.Sheets[name];
    if (!sheet || !sheet['!ref']) continue;
    let range;
    try { range = XLSX.utils.decode_range(sheet['!ref']); } catch { continue; }
    const originalRows = Math.max(0, range.e.r - range.s.r + 1);
    const originalColumns = Math.max(0, range.e.c - range.s.c + 1);
    const clippedRange = {
      s: range.s,
      e: {
        r: Math.min(range.e.r, range.s.r + MAX_ROWS_PER_SHEET - 1),
        c: Math.min(range.e.c, range.s.c + MAX_COLUMNS_PER_SHEET - 1),
      },
    };
    if (originalRows > MAX_ROWS_PER_SHEET || originalColumns > MAX_COLUMNS_PER_SHEET) sampled = true;
    if (CONTACT_SHEET.test(name)) {
      privacy.skippedContactSheets++;
      sampled = true;
      const section = `\n### TRANG TÍNH: ${safeSheetName(name)}\n[Đã ẩn danh sách chi tiết; trang này có khoảng ${originalRows.toLocaleString('vi-VN')} dòng.]\n`;
      text += section.slice(0, MAX_OUTPUT_CHARS - text.length);
      sheets.push({ name: safeSheetName(name), rowsRead: 0, columnsRead: 0, privacyProtected: true });
      continue;
    }
    const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false, range: clippedRange });
    const selectedRows = [];
    for (let index = 0; index < allRows.length && selectedRows.length < MAX_SELECTED_ROWS_PER_SHEET; index++) {
      const row = allRows[index].slice(0, MAX_COLUMNS_PER_SHEET);
      if (index < 30 || BUSINESS_KEYWORDS.test(row.join(' '))) selectedRows.push(row);
    }
    if (selectedRows.length < allRows.length) sampled = true;
    const safeText = rowsToText(selectedRows, privacy);
    if (!safeText.trim()) continue;
    const section = `\n### TRANG TÍNH: ${safeSheetName(name)}\n${safeText.trim()}\n`;
    const remaining = MAX_OUTPUT_CHARS - text.length;
    text += section.slice(0, remaining);
    if (section.length > remaining) sampled = true;
    sheets.push({ name: safeSheetName(name), rowsRead: Math.min(originalRows, MAX_ROWS_PER_SHEET), columnsRead: Math.min(originalColumns, MAX_COLUMNS_PER_SHEET) });
  }
  if (!text.trim()) throw new Error('File Excel không có dữ liệu có thể đọc.');
  if (sampled) warnings.push('File có nhiều dữ liệu; hệ thống đã ưu tiên phần thông tin liên quan đến sự kiện để tự điền nhanh và an toàn.');
  if (privacy.redactedValues || privacy.skippedContactSheets) warnings.push('Email, số điện thoại và danh sách liên hệ đã được ẩn trước khi phân tích.');
  return { text, warnings, metadata: { totalSheets: sheetNames.length, processedSheets: sheets.length, sheets, sampled, privacy } };
}

try {
  parentPort.postMessage({ ok: true, result: run() });
} catch (error) {
  parentPort.postMessage({ ok: false, error: error && error.message ? error.message : 'Không đọc được file Excel.' });
}
