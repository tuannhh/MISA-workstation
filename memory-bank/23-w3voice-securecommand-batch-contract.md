# 23 — Batch Contract: W3.VOICE.SECURE-COMMAND + W3.VOICE.1 (backend, contract-ready)

> Theo `17-fast-track-collaboration.md` §3. Ghi trước khi code, khoá phạm vi.

## Bối cảnh phân công

Owner (`/goal` 2026-08-31): "làm những việc ở wave 2,3,4 mà claude được giao làm, việc nào của
codex thì để lại cho codex làm sau". Theo `17-fast-track-collaboration.md` §1 ("Claude phụ trách
backend/kiến trúc/test; Codex phụ trách triển khai UI theo MDS") và `CLAUDE.md` mục 6 (UI/MDS lane
Codex, chưa giao lại Claude):

- Rà toàn bộ Wave 2/3/4 (`04-ROADMAP.md`): W2.2 (tách business/domain khỏi page layout — chạm
  `frontend/`, lane Codex), toàn bộ slice UI Wave 3 (People/Partner/Supplier/... Desktop MDS +
  Native composition), toàn bộ Wave 4 (WebView-host device runtime) đều là UI/device — **không
  làm trong batch này**, để lại Codex/DevOps đúng lane.
- W2.3/W2.4 (SLO acceptance) bị chặn ngoài bởi O5 (DevOps chưa chốt ngưỡng) — harness đo đã có sẵn
  từ G1.8, không có việc mới cho Claude tới khi DevOps chốt.
- **W3.VOICE.SECURE-COMMAND + W3.VOICE.1** là ngoại lệ: thiết kế đã chốt đầy đủ ở D14.4
  (`02-decisions.md` §E), thuần backend (proposal/idempotency/optimistic-concurrency/PolicyEngine
  re-check), KHÔNG chạm `frontend/`, không phụ thuộc slice UI nào trước nó trong thứ tự Wave 3 (thứ
  tự liệt kê trong roadmap là ưu tiên chiến lược cho UI strangler, không phải phụ thuộc kỹ thuật
  cứng cho phần backend AI này — W3.VOICE.SECURE-COMMAND chỉ phụ thuộc `W1.AI-POLICY`, đã đóng cùng
  W1). Chọn batch này làm việc kế tiếp của Claude trong Wave 2-4.
- W2.5 (host-adapter interface) để lại xem xét riêng sau batch này — cần làm rõ thêm ranh giới
  server/client trước khi khoá contract (client-side mic/camera/file là API trình duyệt, có thể
  thuộc phạm vi `frontend/`).

## Batch Contract

```
Batch-ID: W3.VOICE.SECURE-COMMAND+W3.VOICE.1
Goal: Mở rộng luồng "giọng nói -> tương tác" hiện có (ai.js /interaction-voice, giữ nguyên không đổi)
  thành 1 luồng propose/confirm an toàn: AI chuẩn bị 1 "proposal" có định danh/gắn principal/hết hạn,
  người dùng chỉnh sửa + xác nhận 1 lần, server re-check PolicyEngine + optimistic concurrency +
  idempotency trước khi ghi. Đây là backend contract-ready cho UI Wave 3 slice Voice sau này (Codex
  lane) -- KHÔNG dựng UI trong batch này.
In scope:
  - Bảng mới `voice_proposals` (server/db.js init(), KHÔNG thêm vào dropAll() -- theo đúng quyết
    định W1.RBAC.0 đã chốt bỏ dropAll()/RESET_DB làm cơ chế reset, xem verify-g0.mjs dòng 291-295).
  - Mechanical: tách buildInsert/buildUpdate/logEdit khỏi routes.js sang server/db-helpers.js dùng
    chung routes.js + ai.js (COMMIT RIÊNG, không đổi hành vi).
  - 2 route mới trong ai.js: POST /api/ai/interaction-voice-propose (yêu cầu requirePerm
    interactions,create -- giống /interaction-voice hiện tại), POST /api/ai/interaction-voice-confirm
    (yêu cầu requirePerm interactions,create).
  - VOICE_SCHEMA mở rộng thêm suggested_score_delta (Gemini tự đề xuất trong lời nói, KHÔNG phải quy
    tắc cứng của Claude -- BA vẫn chưa định nghĩa quy tắc chính thức theo D14.3, server chỉ kẹp biên
    an toàn [-10,10] trên số AI tự gợi ý, mặc định 0).
  - Guardrail entity-match: trả về TẤT CẢ candidate (không tự chọn top-1 khi có >=2 khớp) --
    matchCandidates() thay matchPerson()/matchOrg() CHỈ cho 2 route mới (không đổi hàm cũ
    matchPerson/matchOrg mà /interaction-voice đang dùng).
  - Full doc apparatus: 07-route-catalog.md, 08-permission-matrix.md, UI-flow matrix (2 route mới =
    backend/API-only, chưa có UI -- lane Codex, giống tiền lệ R146-148/W1.ADMIN), gate1-test-mapping.md,
    09-db-schema.md, scripts/verify-g0.mjs (table count 35->36, index 22->23, omissions +
    voice_proposals), scripts/verify-gate1-mapping.mjs route count.
Out of scope:
  - KHÔNG đổi /interaction-voice hiện tại (route cũ giữ nguyên, không regression).
  - KHÔNG dựng UI cho 2 route mới -- lane Codex theo CLAUDE.md mục 6, chưa giao lại.
  - KHÔNG định nghĩa quy tắc chính thức AI đề xuất relationship_score bao nhiêu điểm -- đó là D14.3,
    việc của BA. Batch này chỉ dựng CƠ CHẾ (kẹp biên an toàn + xác nhận), không phải CHÍNH SÁCH.
  - KHÔNG route cancel/reject proposal riêng (không bắt buộc theo D14.4 -- hết hạn tự nhiên đủ).
  - KHÔNG đổi owner_id/ownership check cho entity `person` (person là GLOBAL entity, không
    owner-gated theo policy-engine.js hiện tại -- xem policyService.assertWritable({entity:'person'})
    không truyền record ở PUT /people/:id hiện tại, giữ nguyên hành vi đó).
Behavior mode: mechanical (db-helpers extraction) tách riêng khỏi target-change (proposal flow mới)
Risk hotspots: TOCTOU giữa propose/confirm (relationship_score lost-update), replay/tampering proposal
  payload, double-confirm tạo trùng interaction, principal binding (proposal của user A không xác
  nhận được bởi user B), AI egress (AI-E001 dùng lại, không route Gemini call mới ngoài luồng đã audit),
  hết hạn proposal (fail-closed khi quá TTL).
Required tests: unit (matchCandidates confidence levels: none/high/ambiguous; clamp suggested_score_delta;
  proposal expiry check thuần hàm), integration (happy path propose->confirm ghi đúng interaction +
  đổi relationship_score; confirm bởi user khác bị 403; confirm sau hết hạn bị từ chối; confirm 2 lần
  cùng proposal_id lần 2 không ghi thêm (idempotent, trả lại kết quả cũ hoặc 409 rõ ràng); confirm khi
  relationship_score bị đổi song song (lost-update) bị từ chối 409; confirm không có suggested_score_delta
  chỉ tạo interaction, không đụng people; PolicyEngine deny quyền interactions.create tại thời điểm
  confirm (role đổi giữa propose/confirm) vẫn đúng 403 dù propose từng cho qua).
Allowed known-red/TODO (owner + expiry/wave): không có -- toàn bộ exit criterion phải xanh trước khi
  đóng batch, vì đây là tính năng backend hoàn chỉnh (contract-ready), không phải characterization.
Exit criteria: 2 route mới GREEN cả 2 driver; route cũ /interaction-voice không regression; full
  regression (security 6/6, SQLite/MySQL 0 fail, verify-g0.mjs PASS, verify-gate1-mapping PASS,
  git diff --check sạch); mapping route count cập nhật đúng (148->150).
Expected commit range/count: 2-3 commit (1 mechanical db-helpers extraction, 1 schema+route mới,
  1 doc apparatus nếu cần tách riêng khỏi commit code).
```
