'use strict';
const { db } = require('./db');
const mailer = require('./mailer');

function todayGMT7() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

// Lần xuất hiện kế tiếp của 1 ngày (Date UTC chuẩn hoá)
function nextOccurrence(eventDate, recurring, today) {
  const [y, m, d] = String(eventDate || '').split('-').map(Number);
  if (!m || !d) return null;
  let occ = new Date(Date.UTC(recurring ? today.getUTCFullYear() : y, m - 1, d));
  if (recurring && occ < today) occ = new Date(Date.UTC(today.getUTCFullYear() + 1, m - 1, d));
  return occ;
}
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }

// Một lượt quét: tạo log in-app + gửi email cho các mốc nhắc đã đến hạn
function runOnce() {
  const today = todayGMT7();
  const dates = db.prepare('SELECT * FROM important_dates').all();
  const users = db.prepare("SELECT id, full_name, email, notify_opt_in FROM users WHERE active=1").all();
  const optedUsers = users.filter((u) => u.notify_opt_in);
  const has = db.prepare('SELECT 1 FROM reminder_log WHERE date_id=? AND occur_date=? AND seq=? AND channel=? AND recipient_user_id=?');
  const insLog = db.prepare('INSERT INTO reminder_log (date_id, occur_date, seq, channel, recipient_user_id) VALUES (?,?,?,?,?)');

  let created = 0, emailed = 0;
  for (const r of dates) {
    const occ = nextOccurrence(r.event_date, r.recurring, today);
    if (!occ) continue;
    const lead = r.lead_days || 0;
    const every = r.notify_repeat_every || 0;
    const count = Math.max(1, r.notify_repeat_count || 1);
    for (let seq = 1; seq <= count; seq++) {
      // mốc nhắc thứ seq: lead ngày trước, rồi tiến dần về ngày sự kiện
      let slot = addDays(occ, -lead + (seq - 1) * every);
      if (slot > occ) slot = occ;            // không nhắc sau ngày sự kiện
      if (slot > today) continue;            // chưa tới hạn
      const occStr = ymd(occ);
      // in-app cho từng user opt-in
      for (const u of optedUsers) {
        if (!has.get(r.date_id ?? r.id, occStr, seq, 'inapp', u.id)) {
          insLog.run(r.id, occStr, seq, 'inapp', u.id);
          created++;
        }
      }
      // email (nếu bật) cho user có email
      if (mailer.enabled()) {
        for (const u of optedUsers.filter((x) => x.email)) {
          if (!has.get(r.id, occStr, seq, 'email', u.id)) {
            insLog.run(r.id, occStr, seq, 'email', u.id);
            const dleft = Math.round((occ - today) / 86400000);
            mailer.send({
              to: u.email,
              subject: `[MISA PR] Nhắc: ${r.title} (còn ${dleft} ngày)`,
              text: `Sự kiện "${r.title}" diễn ra ngày ${occStr}${r.subject_name ? ` — ${r.subject_name}` : ''}. ${r.note || ''}\nVui lòng chuẩn bị chăm sóc đối tác.`,
            }).then((x) => { if (x.sent) emailed++; }).catch(() => {});
          }
        }
      }
    }
  }
  if (created || emailed) console.log(`  [scheduler] tạo ${created} nhắc in-app, gửi ${emailed} email.`);
  return { created, emailed };
}

let timer = null;
function start() {
  try { runOnce(); } catch (e) { console.error('[scheduler] lỗi:', e.message); }
  timer = setInterval(() => { try { runOnce(); } catch (e) { console.error('[scheduler] lỗi:', e.message); } }, 6 * 3600 * 1000);
  if (timer.unref) timer.unref();
}

module.exports = { start, runOnce };
