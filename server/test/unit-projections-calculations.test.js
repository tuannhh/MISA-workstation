'use strict';

// G1A.2 — Commit 4/4 (cuối): Projection/tính toán nghiệp vụ trong routes.js.
// 6 hàm thuần được trích từ router handler (routes.js#nsrOf/careRiskLevel/bucketOf/crisisOf/
// sentimentScore/awardCostOf) — TRƯỚC đây là biểu thức inline lặp lại ở nhiều route (NSR lặp
// 3 nơi, bucketOf/careRisk-level là arrow function/if-else nội bộ trong 1 handler). Trích ra
// hàm module-level KHÔNG đổi giá trị trả về ở bất kỳ route nào (đã verify bằng cách giữ nguyên
// công thức/nhánh, chỉ đổi cách gọi) — xem diff commit này. Đặc tả boundary chính xác từng
// ngưỡng vì đây là logic phân loại rủi ro/khủng hoảng ảnh hưởng trực tiếp tới việc PR có nhìn
// thấy cảnh báo hay không.
process.env.DB_CLIENT = 'sqlite';
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-unit-calc-'));

const test = require('node:test');
const assert = require('node:assert/strict');

const router = require('../routes');
const { nsrOf, careRiskLevel, bucketOf, crisisOf, sentimentScore, awardCostOf } = router.testables;

test.after(() => { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

test('BR-CALC-001: nsrOf() = (tích cực-tiêu cực)/(tích cực+tiêu cực), 0 khi cả hai đều 0', () => {
  assert.equal(nsrOf(8, 2), 0.6);
  assert.equal(nsrOf(2, 8), -0.6);
  assert.equal(nsrOf(5, 5), 0);
  assert.equal(nsrOf(0, 0), 0); // mẫu số rỗng -> 0, không NaN/Infinity
});

test('BR-CALC-002: nsrOf() làm tròn 2 chữ số thập phân', () => {
  assert.equal(nsrOf(1, 2), -0.33); // -1/3 = -0.333... -> toFixed(2) -> -0.33
  assert.equal(nsrOf(2, 1), 0.33);
});

test('BR-CALC-003: careRiskLevel() đúng biên 5 cấp (7/14/21/30 ngày)', () => {
  const cases = [
    [0, 1], [6, 1], [7, 2], [13, 2], [14, 3], [20, 3], [21, 4], [29, 4], [30, 5], [999, 5],
  ];
  for (const [days, expectedLevel] of cases) {
    assert.equal(careRiskLevel(days).level, expectedLevel, `days=${days}`);
  }
  assert.equal(careRiskLevel(30).label, 'Cấp 5: Nguy hiểm');
  assert.equal(careRiskLevel(30).action, 'Đối ngoại khẩn cấp');
  assert.equal(careRiskLevel(6).action, ''); // cấp 1 không có action
});

test('BR-CALC-004: bucketOf() đúng biên 1/3/6/12 tháng, null khi <30 ngày', () => {
  const cases = [
    [29, null], [30, '1m'], [89, '1m'], [90, '3m'], [179, '3m'], [180, '6m'], [364, '6m'], [365, '12m'], [9999, '12m'],
  ];
  for (const [days, expected] of cases) assert.equal(bucketOf(days), expected, `days=${days}`);
});

test('BR-CALC-005: crisisOf() đúng ngưỡng >=3 tin tiêu cực/24h', () => {
  assert.equal(crisisOf(0), false);
  assert.equal(crisisOf(2), false);
  assert.equal(crisisOf(3), true);
  assert.equal(crisisOf(10), true);
});

test('BR-CALC-006: sentimentScore() map đúng 3 giá trị hợp lệ, null cho giá trị khác/rỗng', () => {
  assert.equal(sentimentScore('positive'), 0.6);
  assert.equal(sentimentScore('negative'), -0.6);
  assert.equal(sentimentScore('neutral'), 0);
  assert.equal(sentimentScore(null), null);
  assert.equal(sentimentScore('khong-hop-le'), null);
});

test('BR-CALC-007: awardCostOf() = cost gốc + tổng budget các lần tham gia + chi phí booking, null-guard cost/budget', () => {
  const out = awardCostOf(
    { cost: 20_000_000 },
    [{ budget: 5_000_000 }, { budget: null }, { budget: 3_000_000 }],
    1_500_000,
  );
  assert.deepEqual(out, { cost: 20_000_000, partBudget: 8_000_000, mediaCost: 1_500_000, totalCost: 29_500_000 });
});

test('BR-CALC-008: awardCostOf() cost null và không có lần tham gia nào -> chỉ còn mediaCost', () => {
  const out = awardCostOf({ cost: null }, [], 700_000);
  assert.deepEqual(out, { cost: 0, partBudget: 0, mediaCost: 700_000, totalCost: 700_000 });
});
