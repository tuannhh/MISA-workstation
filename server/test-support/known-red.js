'use strict';
// G1B.6 — khung "known-red": mọi target-red test PHẢI đăng ký {id, owner, expiry} trong
// memory-bank/g1b-allowlist.json. Không có cơ chế này thì một RED test chỉ đơn giản làm build đỏ
// vô thời hạn (không phân biệt được "gap đã biết, chờ implement" với "bug thật"), hoặc bị comment
// out và mất dấu vết. knownRed() lật ngược: test CHA chỉ pass khi hành vi ĐÍCH bên trong vẫn đang
// sai (đúng như allowlist mô tả); nếu hành vi đích bất ngờ đã đúng, test CHA tự fail để buộc người
// làm xoá entry khỏi allowlist và promote thành test xanh thật — không được để known-red mãi mãi.
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ALLOWLIST_PATH = path.join(__dirname, '..', '..', 'memory-bank', 'g1b-allowlist.json');

let cached = null;
function loadAllowlist() {
  if (!cached) {
    cached = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  }
  return cached;
}

// Tách riêng khỏi knownRed() để self-test gọi thẳng, không phải đăng ký test con qua node:test.
function validateEntry(id) {
  const entry = loadAllowlist().find((e) => e.id === id);
  if (!entry) {
    throw new Error(
      `known-red "${id}" không có trong memory-bank/g1b-allowlist.json — mọi target-red phải khai {id, owner, expiry} theo G1B.6 trước khi được coi là known-red hợp lệ.`
    );
  }
  if (!entry.expiry || new Date(entry.expiry).getTime() <= Date.now()) {
    throw new Error(
      `known-red "${id}" đã hết hạn allowlist (expiry=${entry.expiry}) — gia hạn có chủ đích hoặc implement thật, không để known-red quá hạn âm thầm.`
    );
  }
  return entry;
}

function knownRed(id, name, fn) {
  test(`${name} [known-red:${id}]`, async (t) => {
    validateEntry(id); // throw ở đây nếu allowlist thiếu/hết hạn -> test fail đúng lý do

    let behaviorFailedAsExpected = false;
    try {
      await fn(t);
    } catch (err) {
      behaviorFailedAsExpected = true;
    }

    assert.ok(
      behaviorFailedAsExpected,
      `known-red "${id}" hành vi ĐÍCH bên trong đã pass — gap coi như đã được sửa. Xoá entry khỏi g1b-allowlist.json và chuyển test này thành assertion xanh thật thay vì để known-red (G1B.6).`
    );
  });
}

module.exports = { knownRed, validateEntry };
