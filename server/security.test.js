'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { parseSpreadsheet, redactTextForAi } = require('./spreadsheet-parser');
const { validateRecipient } = require('./mailer');

function excelFile(rows, name = 'ke-hoach.xlsx') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Kế hoạch');
  return {
    originalname: name,
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }),
  };
}

test('BR-VAL-035: đọc file Excel trong worker và trả về nội dung cần cho AI', async () => {
  const result = await parseSpreadsheet(excelFile([
    ['Tên sự kiện', 'Ngày tổ chức', 'Địa điểm'],
    ['Hội nghị khách hàng', '20/08/2026', 'Hà Nội'],
  ]));
  assert.match(result.text, /Hội nghị khách hàng/);
  assert.equal(result.metadata.processedSheets, 1);
  assert.equal(result.metadata.sampled, false);
});

test('BR-VAL-036: lấy mẫu file lớn thay vì đưa toàn bộ dữ liệu cho AI', async () => {
  const rows = Array.from({ length: 520 }, (_, row) => Array.from({ length: 90 }, (_, col) => `R${row}C${col}`));
  const result = await parseSpreadsheet(excelFile(rows, 'du-lieu-lon.xlsx'));
  assert.equal(result.metadata.sampled, true);
  assert.ok(result.warnings.length > 0);
  assert.ok(result.text.length <= 60000);
});

test('BR-VAL-037: từ chối file giả mạo phần mở rộng Excel', async () => {
  await assert.rejects(() => parseSpreadsheet({
    originalname: 'gia-mao.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('khong-phai-file-excel'),
  }), /không đúng định dạng Excel/);
});

test('BR-VAL-038: ẩn thông tin liên hệ trước khi gửi nội dung sang AI', async () => {
  const result = await parseSpreadsheet(excelFile([
    ['Tên sự kiện', 'Đầu mối', 'Email'],
    ['Hội nghị khách hàng', '0912345678', 'nguyenvana@example.com'],
  ]));
  assert.doesNotMatch(result.text, /0912345678|nguyenvana@example\.com/);
  assert.match(result.text, /ĐÃ ẨN/);
  assert.ok(result.metadata.privacy.redactedValues >= 2);
});

test('BR-VAL-039: ẩn thông tin liên hệ trong nội dung dán trực tiếp', () => {
  const safe = redactTextForAi('Liên hệ 0912345678 hoặc pr@misa.vn');
  assert.doesNotMatch(safe, /0912345678|pr@misa\.vn/);
  assert.match(safe, /SĐT ĐÃ ẨN/);
  assert.match(safe, /EMAIL ĐÃ ẨN/);
});

test('BR-VAL-040: từ chối địa chỉ email chứa CRLF hoặc nhóm lồng nhau', () => {
  assert.equal(validateRecipient('pr@misa.vn'), 'pr@misa.vn');
  assert.throws(() => validateRecipient('admin@misa.vn\r\nBcc: attacker@example.com'), /không hợp lệ/);
  assert.throws(() => validateRecipient('g0:g1:victim@example.com'), /không hợp lệ/);
});
