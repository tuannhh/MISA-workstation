'use strict';
// Mechanical extraction tu routes.js (W3.VOICE.SECURE-COMMAND batch, 2026-08-31) -- khong doi hanh
// vi, chi tach de ai.js dung chung voi routes.js thay vi copy lai.
const { db, audit } = require('./db');

function buildInsert(table, data) {
  const keys = Object.keys(data);
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
  return db.prepare(sql).run(...keys.map((k) => data[k]));
}
function buildUpdate(table, id, data) {
  const keys = Object.keys(data);
  if (!keys.length) return;
  const sql = `UPDATE ${table} SET ${keys.map((k) => `${k}=?`).join(',')} WHERE id=?`;
  return db.prepare(sql).run(...keys.map((k) => data[k]), id);
}
function logEdit(req, action, entity, id, detail) {
  const u = req.session.user;
  audit({ user_id: u.id, username: u.username, action, entity, entity_id: id, detail });
}

module.exports = { buildInsert, buildUpdate, logEdit };
