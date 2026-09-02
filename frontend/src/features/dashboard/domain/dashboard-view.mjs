const count = (value) => Math.max(0, Number(value) || 0);
const text = (value) => String(value || '').trim();

// Chỉ đưa projection cần render vào hai composition. Không giữ note/subject_id hoặc các field
// nhạy cảm trong state UI; quyền và projection gốc vẫn do API quyết định.
export function dashboardViewModel(payload) {
  const overview = payload?.overview || {};
  const press = overview.press || {};
  const assoc = overview.assoc || {};
  const events = overview.events || {};
  const chart = (rows) => (Array.isArray(rows) ? rows : []).slice(0, 6).map((row) => Object.freeze({ label: text(row?.label) || 'Chưa phân loại', value: count(row?.value) }));
  return Object.freeze({
    month: count(payload?.month),
    year: count(payload?.year),
    groups: Object.freeze([
      Object.freeze({ key: 'press', title: 'Quan hệ báo chí', icon: 'news', navigate: 'press', stats: Object.freeze([
        Object.freeze({ label: 'Tòa soạn', value: count(press.total), navigate: 'press' }),
        Object.freeze({ label: 'Phóng viên đang làm việc', value: count(press.reporters), navigate: 'people' }),
        Object.freeze({ label: 'Sinh nhật VIP trong tháng', value: count(press.vipBdMonth), navigate: 'reminders' }),
      ]) }),
      Object.freeze({ key: 'association', title: 'Hiệp hội / Hội', icon: 'building-community', navigate: 'association', stats: Object.freeze([
        Object.freeze({ label: 'Đơn vị đang quản lý', value: count(assoc.total), navigate: 'association' }),
        Object.freeze({ label: 'Kỷ niệm trong tháng', value: count(assoc.annivMonth), navigate: 'reminders' }),
        Object.freeze({ label: 'Đến kỳ đóng phí', value: count(assoc.feeDueMonth), navigate: 'association' }),
      ]) }),
      Object.freeze({ key: 'events', title: 'Hoạt động sự kiện', icon: 'calendar-event', navigate: 'events', stats: Object.freeze([
        Object.freeze({ label: 'MISA tổ chức trong tháng', value: count(events.hostMonth), navigate: 'events' }),
        Object.freeze({ label: 'Tham gia / tài trợ', value: count(events.sponsorMonth), navigate: 'events' }),
        Object.freeze({ label: 'Bài keynote lãnh đạo', value: count(events.keynoteMonth), navigate: 'events' }),
      ]) }),
    ]),
    charts: Object.freeze([
      Object.freeze({ title: 'Phóng viên theo mảng', rows: Object.freeze(chart(payload?.charts?.reportersByBeat)) }),
      Object.freeze({ title: 'Hiệp hội theo lĩnh vực', rows: Object.freeze(chart(payload?.charts?.assocByField)) }),
    ]),
    upcoming: Object.freeze((Array.isArray(payload?.upcoming) ? payload.upcoming : []).slice(0, 6).map((item) => Object.freeze({
      title: text(item?.title) || 'Sự kiện cần theo dõi',
      date: text(item?.event_date),
      daysUntil: Number.isFinite(Number(item?.daysUntil)) ? Number(item.daysUntil) : null,
      navigate: 'reminders',
    }))),
  });
}
