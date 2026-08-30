'use strict';
process.env.DB_CLIENT = 'sqlite';
const fs = require('fs'), os = require('os'), path = require('path');
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-policy-vis-'));
const test = require('node:test'), assert = require('node:assert/strict');
const { db } = require('../db'); const { createVisibilityStore } = require('../policy-visibility-store');
const store = createVisibilityStore(db);
test.after(() => fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }));
// D13-006 sua P0 2026-08-30: store chi bao cao "chua cau hinh" (undefined), KHONG tu quyet dinh
// "private" thay cho PolicyEngine -- PolicyEngine (D13.2b) moi la noi ap dung mac dinh theo
// classification_tier (Public mac dinh hien thi, Confidential/Restricted mac dinh an).
test('D13-006: missing configuration reports undefined (not configured); invalid field is rejected', () => { assert.equal(store.isPublic('partners', 'phone_personal'), undefined); assert.throws(() => store.isPublic('partners', 'bad'), /không hợp lệ/); });
test('D13-007: privileged user may only keep every Confidential/Restricted field private', () => { for (const field of ['phone_personal', 'personality', 'gift_rules', 'bank_account_number']) assert.throws(() => store.setPublic({ module: 'partners', field, isPublic: true, principal: { id: 2, role: 'super_admin' } }), /FORBIDDEN_TIER/); store.setPublic({ module: 'partners', field: 'phone_personal', isPublic: false, principal: { id: 2, role: 'super_admin' } }); assert.equal(store.isPublic('partners', 'phone_personal'), false); });
