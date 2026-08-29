'use strict';

const path = require('path');
const { Worker } = require('worker_threads');

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 15000;
const EXCEL_EXTENSIONS = new Set(['.xlsx', '.xls', '.xlsb', '.csv']);
const EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  'text/csv',
  'application/csv',
]);

function redactTextForAi(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL ĐÃ ẨN]')
    .replace(/(?:\+?84|0)\d(?:[\s.-]?\d){8,10}/g, '[SĐT ĐÃ ẨN]')
    .replace(/\b\d{9,16}\b/g, '[DÃY SỐ ĐÃ ẨN]');
}

function isSpreadsheet(file) {
  if (!file || !file.buffer) return false;
  const extension = path.extname(file.originalname || '').toLowerCase();
  return EXCEL_EXTENSIONS.has(extension) || EXCEL_MIMES.has(String(file.mimetype || '').toLowerCase());
}

function validateSignature(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const bytes = file.buffer;
  if (bytes.length > MAX_FILE_BYTES) throw new Error('File Excel vượt quá 10 MB. Bạn hãy xóa bớt ảnh trong file hoặc tải bản rút gọn.');
  if (extension === '.csv') {
    if (bytes.subarray(0, Math.min(bytes.length, 4096)).includes(0)) throw new Error('File CSV không đúng định dạng văn bản.');
    return;
  }
  const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  const isOle = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (!isZip && !isOle) throw new Error('File không đúng định dạng Excel. Bạn hãy chọn lại file .xlsx, .xls, .xlsb hoặc .csv.');
}

function parseSpreadsheet(file) {
  if (!isSpreadsheet(file)) return Promise.reject(new Error('Định dạng file chưa được hỗ trợ. Hãy chọn file Excel hoặc CSV.'));
  try { validateSignature(file); } catch (error) { return Promise.reject(error); }

  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'spreadsheet-worker.js'), {
      workerData: { buffer: file.buffer, filename: file.originalname || 'bang-du-lieu.xlsx' },
      resourceLimits: { maxOldGenerationSizeMb: 160, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate().catch(() => {});
      callback(value);
    };
    const timer = setTimeout(() => finish(reject, new Error('File cần quá nhiều thời gian để đọc. Bạn hãy lưu lại thành .xlsx hoặc chia file thành các phần nhỏ hơn.')), PARSE_TIMEOUT_MS);
    worker.once('message', (message) => {
      if (message && message.ok) finish(resolve, message.result);
      else finish(reject, new Error((message && message.error) || 'Không đọc được nội dung file Excel.'));
    });
    worker.once('error', () => finish(reject, new Error('File Excel quá lớn hoặc có cấu trúc không hợp lệ. Bạn hãy dùng bản rút gọn.')));
    worker.once('exit', (code) => {
      if (!settled && code !== 0) finish(reject, new Error('Không đọc được file Excel. File có thể bị hỏng hoặc dùng định dạng chưa hỗ trợ.'));
    });
  });
}

module.exports = { MAX_FILE_BYTES, isSpreadsheet, validateSignature, parseSpreadsheet, redactTextForAi };
