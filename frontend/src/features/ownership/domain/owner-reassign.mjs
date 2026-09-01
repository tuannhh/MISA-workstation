function positiveId(value) { const id = Number(value); return Number.isInteger(id) && id > 0 ? id : null; }
function text(value, fallback = '') { const result = String(value ?? '').trim(); return result || fallback; }

// Projection dùng chung cho luồng owner reassignment của entity Direct. Giữ đúng thông tin Admin
// cần quyết định và loại bỏ metadata quyền/tài khoản ngoài scope khỏi form mutation.
export function ownerReassignViewModel({ record, users } = {}) {
  const ownerId = positiveId(record?.owner_id ?? record?.responsible_user_id);
  const owners = Object.freeze((users?.rows || []).filter((user) => Boolean(user?.active)).map((user) => {
    const id = positiveId(user?.id); const fullName = text(user?.full_name, text(user?.username, `User #${id}`));
    return id ? Object.freeze({ value: id, label: `${fullName} · ${text(user?.username, `#${id}`)}` }) : null;
  }).filter(Boolean));
  const current = owners.find((user) => user.value === ownerId) || null;
  return Object.freeze({ ownerId, currentOwnerLabel: current?.label || (ownerId ? `Tài khoản #${ownerId}` : 'Chưa được gán'), owners });
}

export function toOwnerReassignPayload(ownerId) {
  const id = positiveId(ownerId);
  if (!id) throw new TypeError('Hãy chọn người phụ trách đang hoạt động.');
  return Object.freeze({ owner_id: id });
}
