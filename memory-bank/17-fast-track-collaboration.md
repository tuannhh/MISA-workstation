# 17 — Fast-track protocol: Claude triển khai ↔ Codex audit

> **Status:** OWNER APPROVED — 2026-08-26.  
> **Mục tiêu:** giảm thời gian chờ và số vòng tranh luận, nhưng không hạ chuẩn bảo mật, chịu lỗi, tính đúng nghiệp vụ hoặc độ trung thực của bằng chứng.  
> **Áp dụng:** từ phần còn lại của G1A.3 và mọi gate/wave tiếp theo, trừ khi owner chỉ định khác.

## 1. Thứ tự ưu tiên và ranh giới vai trò

Thứ tự ưu tiên không đổi:

```text
Bảo mật > chịu lỗi/mất dữ liệu > đúng nghiệp vụ > hiệu năng > tốc độ triển khai
```

| Vai trò | Trách nhiệm chính | Không làm |
|---|---|---|
| Owner | Chốt nghiệp vụ, đánh đổi và thay đổi phạm vi có hậu quả | Không phải phân xử tranh luận kỹ thuật vụn |
| Claude | Implementer: lập Batch Contract, code/test, tự review, gửi Evidence Bundle | Không tự tuyên bố gate được Codex CLOSE; không giấu known gap |
| Codex | Auditor độc lập theo rủi ro và exit criteria đã chốt | Không audit lại toàn project; không giữ gate vì P2/P3/doc nit |

Phân công hiện tại: Claude phụ trách backend/kiến trúc/test; Codex phụ trách triển khai và audit UI theo MISA Design System. Bên còn lại được review giao diện/contract giao nhau, nhưng không tự sửa lane kia nếu owner chưa giao.

## 2. Đơn vị bàn giao là batch, không phải từng commit

- Một batch là một vertical slice hoặc nhóm module gắn kết, mặc định khoảng **15–25 route** đối với G1A.3.
- Batch nhỏ hơn khi chạm auth/RBAC, tiền, file, migration, AI egress, SSRF, concurrency hoặc dữ liệu khó khôi phục.
- Claude vẫn tạo commit nhỏ, độc lập, rollback được; **không gửi audit sau từng commit**.
- Codex audit một lần trên toàn commit range của batch.
- Không gộp mechanical extraction với thay đổi nghiệp vụ trong cùng commit, dù chúng có thể thuộc cùng batch.

## 3. Batch Contract bắt buộc trước khi code

Claude phải ghi contract ngắn ngay trong kế hoạch/báo cáo batch:

```md
Batch-ID:
Goal:
In scope: route/job/business-rule IDs cụ thể
Out of scope:
Behavior mode: characterization | target-change | mechanical
Risk hotspots:
Required tests:
Allowed known-red/TODO (owner + expiry/wave):
Exit criteria:
Expected commit range/count:
```

Quy tắc scope-freeze:

- Sau khi bắt đầu, không bổ sung tiêu chí audit mới ngoài contract, trừ P0/P1 có bằng chứng tái hiện được.
- Phát hiện ngoài phạm vi ghi backlog với evidence; không tiện tay sửa.
- Nếu root cause đúng bắt buộc mở rộng đáng kể phạm vi, dừng và xin owner duyệt phần mở rộng.

## 4. Nhịp test nhanh nhưng vẫn tuân thủ full regression

Các commit trong batch là trạng thái làm việc trung gian, chưa được tuyên bố hoàn thành:

| Thời điểm | Bắt buộc chạy |
|---|---|
| Trong lúc code từng commit | Unit/contract/integration test trực tiếp liên quan + syntax/diff check |
| Trước khi kết thúc batch | Toàn bộ test hiện có, security suite, verifier, mapping check; MySQL là blocking driver |
| SQLite | Targeted trong lúc code; full suite trước bàn giao batch khi compatibility SQLite vẫn còn trong G1A/G1A.5 |
| Remediation code P0/P1 | Test tái hiện finding + affected suite; full regression đúng một lần trước bàn giao lại |
| Remediation chỉ sửa tài liệu | Broken-link/parser/verifier/diff check tương ứng; không chạy lại integration nếu nội dung không tác động code/test contract |

Không được bỏ full regression trước khi tuyên bố một batch hoàn thành. Tối ưu nằm ở việc chỉ chạy targeted trong các commit trung gian và full suite đúng một lần tại điểm bàn giao.

Dữ liệu test bắt buộc cách ly. MySQL integration phải giữ các chốt `ALLOW_TEST_DB_CREATE`, host/DB-name validation, database tạm và `DATA_DIR` tạm; không chạy test trên dữ liệu dev/vận hành thật.

## 5. Evidence Bundle Claude phải gửi trước audit

Codex chỉ bắt đầu audit khi bundle có đủ:

```md
Batch-ID / commit range / HEAD:
Contract result: từng exit criterion PASS/FAIL + evidence
Changed files: product / test / docs tách riêng
Route-job-rule mapping delta:
Behavior changes: có/không; file:line hoặc diff chứng minh
Tests added/changed: ID + file
Commands and exact results: pass/fail/skip + exit code
Known-red/TODO: reason + owner + expiry/wave
Out-of-scope findings/backlog:
Rollback path:
Worktree status and unrelated pre-existing changes:
```

Không dùng các câu “đã phủ hết”, “không đổi hành vi”, “không leak” nếu chưa có phép đếm/diff/thí nghiệm tái lập. Log dài không cần dán toàn bộ; ghi command, exit code, tổng pass/fail/skip và artifact khi cần.

## 6. Codex audit theo rủi ro, không bới lỗi hình thức

Codex thực hiện theo thứ tự:

1. Xác minh commit range và scope của Batch Contract.
2. Đối chiếu mapping/inventory bằng máy.
3. Review sâu các hotspot: auth/RBAC, write-path, tiền/file, migration, AI egress, SSRF, concurrency, cleanup/rollback.
4. Sampling phần CRUD lặp lại; chỉ mở rộng khi sample cho thấy lỗi hệ thống.
5. Chạy focused reproduction trước; full regression tối đa một lần nếu bundle chưa đủ tin cậy hoặc thay đổi rủi ro cao.
6. Trả về đúng một trong ba quyết định ở §8.

Codex không được:

- Audit lại phần đã CLOSE nếu diff không chạm vào nó.
- Biến hardening lý thuyết xác suất thấp thành blocker khi không có exploit/reproduction hoặc vi phạm exit criterion.
- Yêu cầu remediation riêng cho wording, naming, format, comment hoặc doc drift không làm sai quyết định kỹ thuật.
- Đưa finding mới ngoài scope vào vòng close hiện tại nếu không phải P0/P1.

## 7. Severity quyết định gate

| Mức | Ví dụ | Xử lý |
|---|---|---|
| **P0 Critical** | auth bypass, lộ secret/dữ liệu mật, xoá/ghi nhầm dữ liệu thật, test giả xanh nghiêm trọng | BLOCKED; sửa ngay |
| **P1 High** | sai nghiệp vụ chính, SQL khác driver làm route hỏng, resource/process leak tái hiện được, rollback không hoạt động | BLOCKED; sửa trong một remediation batch hẹp |
| **P2 Medium** | thiếu edge case quan trọng nhưng happy path đúng, maintainability tạo nguy cơ có cơ sở | ACCEPTED WITH BACKLOG; gắn owner+wave |
| **P3 Low/Nit** | wording, naming, comment, hardening hiếm, số liệu tài liệu không ảnh hưởng quyết định | Ghi note hoặc sửa khi tiện; không giữ gate |

Chỉ P0/P1 hoặc exit criterion trong Batch Contract chưa đạt mới được trả `BLOCKED`. Security finding có bằng chứng luôn được ưu tiên theo mức tác động, không bị hạ cấp chỉ để chạy nhanh.

## 8. Trạng thái audit duy nhất

- **ACCEPTED:** đạt contract, không có P0/P1.
- **ACCEPTED WITH BACKLOG:** đạt contract, còn P2/P3 đã gắn owner+wave; được chuyển batch tiếp.
- **BLOCKED:** có P0/P1 tái hiện được hoặc exit criterion chưa đạt; Codex phải cung cấp `Status/Evidence/Risk/Alternative/Experiment/Decision` và phạm vi remediation nhỏ nhất.

Claude không dùng `PARTIAL` chung chung. Nếu bị BLOCKED, chỉ sửa đúng blocker và regression liên quan. Codex re-audit tập trung vào finding đó; không mở lại toàn batch. Không đặt “tối đa một vòng” cứng nếu P0/P1 vẫn thật sự còn, nhưng mọi vòng sau phải có bằng chứng mới, không lặp tranh luận cũ.

## 9. Quy tắc known-red, TODO và finding ngoài scope

- `known-red` chỉ dành cho target test thực sự đỏ, có owner và expiry/wave.
- Characterization test đang xanh nhưng mô tả gap hiện tại vẫn là `green`; target fix là một dòng riêng.
- TODO phải có đích xử lý; TODO vô chủ hoặc không có wave là lỗi contract.
- Finding ngoài scope được ghi một lần vào backlog/finding registry; không sao chép lặp qua nhiều báo cáo.

## 10. Đồng bộ memory-bank không tạo nút thắt

- Trong batch, cập nhật mapping gần code khi cần để không drift.
- Trước bàn giao batch, đồng bộ tất cả tài liệu bị ảnh hưởng và changelog **một lần**; đây vẫn là cùng lượt hoàn thành theo `BackEnd.SKILL/20-memory-bank-mandate.md`.
- Không sửa hàng loạt file chỉ để lặp cùng một câu. Mỗi fact có một nguồn sự thật, file khác liên kết tới nguồn đó.
- Doc-only P2/P3 được gộp vào lần sync kế tiếp, trừ khi tài liệu sai có thể khiến code/deploy/security decision sai.

## 11. Definition of Done cho một batch

- [ ] Batch Contract đã có trước code và phạm vi không bị trôi âm thầm.
- [ ] Code đúng root cause, commit độc lập và có rollback path.
- [ ] Route/job/rule mapping của phạm vi đã join được tới test thật.
- [ ] Targeted test xanh trong quá trình làm.
- [ ] Full regression, security và verifier xanh đúng một lần trước handoff; giới hạn được khai báo trung thực.
- [ ] MySQL blocking pass; SQLite pass theo compatibility contract hiện hành.
- [ ] Không chạm dữ liệu thật; không leak DB/process/file temp.
- [ ] Memory-bank liên quan đã đồng bộ một lần cuối batch.
- [ ] Evidence Bundle đầy đủ, không overclaim.
- [ ] Codex trả ACCEPTED hoặc ACCEPTED WITH BACKLOG trước khi coi gate/slice được audit-close.

## 12. Áp dụng ngay cho G1A.3

- Claude gom các nhóm route kế tiếp thành batch khoảng 15–25 route khi dependency cho phép; vẫn giữ commit module độc lập.
- Không gửi Codex audit sau từng commit. Gửi khi batch đủ contract + Evidence Bundle.
- MySQL full suite, security, verifier và mapping check chạy một lần trước handoff; SQLite full suite chạy cùng checkpoint cho tới khi G1A.5 quyết định compatibility được thay đổi.
- Codex ưu tiên sampling write-path/auth/file và khác biệt SQLite↔MySQL; CRUD lặp lại chỉ mở rộng khi sample thất bại.
- P2/P3 đi backlog. Không lặp mô hình bốn vòng của G1A.1, vốn phát sinh khi test infrastructure chưa ổn định.

## 13. Mẫu phản hồi ngắn giữa hai bên

### Claude → Codex

```md
READY FOR ONE-SHOT AUDIT — Batch <id>, commits <a..b>
Contract: PASS <n>/<n>
Tests: targeted <...>; full MySQL <...>; full SQLite <...>; security/verifier <...>
Hotspots: <...>
Known gaps/backlog: <...>
Evidence Bundle: <path>
```

### Codex → Claude/Owner

```md
Decision: ACCEPTED | ACCEPTED WITH BACKLOG | BLOCKED
Blockers P0/P1: <none | list>
Backlog P2/P3: <list + owner/wave>
Experiment independently rerun: <command/result>
Next action: <continue batch | narrow remediation>
```

## 14. Amendment tăng tốc: hợp nhất handoff, không hợp nhất rủi ro

> **Status:** OWNER APPROVED — 2026-08-26. Áp dụng ngay cho phần đóng G1A.3 và các nhóm việc Gate 1 sau đó.

- Các sub-batch kề nhau có tổng quy mô trong giới hạn batch và cùng exit criterion có thể được **bàn giao chung một lần**. Vẫn giữ commit nhỏ, mapping và bằng chứng theo từng sub-batch để truy vết/rollback.
- Với G1A.3, `monitor-2` (R121–R135) và `ai` (R136–R142) là một **audit-closure bundle**: Codex audit một lần trên range `13501da..fc77674`, không review xen giữa hai commit. Điều kiện là route mapping phải 145/145 `green`, Evidence Bundle tách rõ 15+7 route, và full regression/checkpoint chỉ chạy một lần ở HEAD.
- Không gọi Gemini, SMTP hay URL Internet thật trong characterization. Các case no-key, timeout, SSRF và upload nguy hiểm phải dùng fixture/fake/local closed port; golden evaluation Gemini vẫn thuộc G1A.7.
- P2/P3 và finding ngoài scope chỉ được ghi **một** lần vào registry có owner+wave. Không mở remediation/audit mới cho chúng. P0/P1 hoặc exit criterion thiếu vẫn phải tách remediation hẹp và re-audit focused.
- Sau route closure, Claude phải gộp phần Gate 1 còn lại thành tối đa hai Evidence Bundle: **(A)** jobs/concurrency/DB contract/AI golden/target security tests; **(B)** UI smoke, E2E skeleton, CI-mapping verifier và performance artifact. Tách nhỏ hơn chỉ khi chạm migration, auth/session, RBAC, file hoặc một P0/P1 có bằng chứng.
- `145/145 route green` chỉ đóng phần HTTP-route của G1A.3; không được tuyên bố CLOSE G1A hoặc Gate 1 cho đến khi hai job, mapping verifier, các G1A còn lại và G1B/G1C/G1.8 đạt exit gate ở roadmap.
