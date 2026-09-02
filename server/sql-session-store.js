'use strict';

// Durable express-session Store over the application database. The browser cookie retains only a
// signed opaque id; the principal/payload stays in the shared database across app instances.
const session = require('express-session');

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

function expiryFor(sess, ttlMs) {
  const supplied = sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : NaN;
  return new Date(Number.isFinite(supplied) ? supplied : Date.now() + ttlMs).toISOString();
}

class SqlSessionStore extends session.Store {
  constructor({ db, ttlMs = DEFAULT_TTL_MS } = {}) {
    super();
    if (!db || typeof db.prepare !== 'function') throw new Error('SqlSessionStore requires database adapter.');
    this.ttlMs = ttlMs;
    this.select = db.prepare('SELECT data, expires_at FROM web_sessions WHERE sid=?');
    this.upsert = db.prepare(`INSERT INTO web_sessions (sid, data, expires_at) VALUES (?,?,?)
      ON CONFLICT(sid) DO UPDATE SET data=excluded.data, expires_at=excluded.expires_at`);
    this.remove = db.prepare('DELETE FROM web_sessions WHERE sid=?');
    this.touchStmt = db.prepare('UPDATE web_sessions SET expires_at=? WHERE sid=?');
  }

  get(sid, callback) {
    try {
      const row = this.select.get(sid);
      if (!row) return callback(null, null);
      if (!row.expires_at || Date.parse(row.expires_at) <= Date.now()) {
        this.remove.run(sid);
        return callback(null, null);
      }
      try { return callback(null, JSON.parse(row.data)); }
      catch {
        // A corrupt row must never restore a principal. Remove it and force a fresh login.
        this.remove.run(sid);
        return callback(null, null);
      }
    } catch (err) { return callback(err); }
  }

  set(sid, sess, callback = () => {}) {
    try {
      this.upsert.run(sid, JSON.stringify(sess), expiryFor(sess, this.ttlMs));
      return callback(null);
    } catch (err) { return callback(err); }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.remove.run(sid);
      return callback(null);
    } catch (err) { return callback(err); }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      this.touchStmt.run(expiryFor(sess, this.ttlMs), sid);
      return callback(null);
    } catch (err) { return callback(err); }
  }
}

function createSqlSessionStore(options) { return new SqlSessionStore(options); }

module.exports = { DEFAULT_TTL_MS, SqlSessionStore, createSqlSessionStore };
