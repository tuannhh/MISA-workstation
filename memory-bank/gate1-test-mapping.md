# Gate 1 — Bảng ánh xạ route/job → test (G1A.9)

> Yêu cầu bắt buộc theo Codex C0.6 (`memory-bank/04-ROADMAP.md` §G1A): mapping
> `route_id/business_rule_id → test_id → trạng thái` phủ đủ 145/145 route + mọi
> job/scheduler/monitor flow, là **exit criterion của toàn Gate 1**, không phải optional.
>
> `status` dùng 1 trong 4 giá trị: `TODO` (chưa viết test — trạng thái khởi tạo của mọi
> dòng trong file này), `green` (characterization/target test đã xanh), `known-red`
> (target test đỏ có chủ ý, phải có allowlist `{F-id/D13-target/N-id, owner, expiry}` ở
> G1B — xem `04-ROADMAP.md` §G1B.6), `manual-host` (không tự động hoá được, cần test tay
> trên thiết bị/host thật — ví dụ Native-Mobile runtime). Gate 1 chỉ đóng khi KHÔNG còn
> dòng nào `TODO`.
>
> Cột `test_id`/`file` để trống (`—`) cho tới khi G1A.2–G1A.8 lần lượt viết test thật.
> Nguồn route_id: `memory-bank/07-route-catalog.md` (đã xác nhận đúng 145/145, không
> lọt/trùng, bằng `scripts/verify-g0.mjs`).

| route_id | test_id | status | file | note |
|---|---|---|---|---|
| R001 | — | TODO | — | — |
| R002 | — | TODO | — | — |
| R003 | — | TODO | — | — |
| R004 | — | TODO | — | — |
| R005 | — | TODO | — | — |
| R006 | — | TODO | — | — |
| R007 | — | TODO | — | — |
| R008 | — | TODO | — | — |
| R009 | — | TODO | — | — |
| R010 | — | TODO | — | — |
| R011 | — | TODO | — | — |
| R012 | — | TODO | — | — |
| R013 | — | TODO | — | — |
| R014 | — | TODO | — | — |
| R015 | — | TODO | — | — |
| R016 | — | TODO | — | — |
| R017 | — | TODO | — | — |
| R018 | — | TODO | — | — |
| R019 | — | TODO | — | — |
| R020 | — | TODO | — | — |
| R021 | — | TODO | — | — |
| R022 | — | TODO | — | — |
| R023 | — | TODO | — | — |
| R024 | — | TODO | — | — |
| R025 | — | TODO | — | — |
| R026 | — | TODO | — | — |
| R027 | — | TODO | — | — |
| R028 | — | TODO | — | — |
| R029 | — | TODO | — | — |
| R030 | — | TODO | — | — |
| R031 | — | TODO | — | — |
| R032 | — | TODO | — | — |
| R033 | — | TODO | — | — |
| R034 | — | TODO | — | — |
| R035 | — | TODO | — | — |
| R036 | — | TODO | — | — |
| R037 | — | TODO | — | — |
| R038 | — | TODO | — | — |
| R039 | — | TODO | — | — |
| R040 | — | TODO | — | — |
| R041 | — | TODO | — | — |
| R042 | — | TODO | — | — |
| R043 | — | TODO | — | — |
| R044 | — | TODO | — | — |
| R045 | — | TODO | — | — |
| R046 | — | TODO | — | — |
| R047 | — | TODO | — | — |
| R048 | — | TODO | — | — |
| R049 | — | TODO | — | — |
| R050 | — | TODO | — | — |
| R051 | — | TODO | — | — |
| R052 | — | TODO | — | — |
| R053 | — | TODO | — | — |
| R054 | — | TODO | — | — |
| R055 | — | TODO | — | — |
| R056 | — | TODO | — | — |
| R057 | — | TODO | — | — |
| R058 | — | TODO | — | — |
| R059 | — | TODO | — | — |
| R060 | — | TODO | — | — |
| R061 | — | TODO | — | — |
| R062 | — | TODO | — | — |
| R063 | — | TODO | — | — |
| R064 | — | TODO | — | — |
| R065 | — | TODO | — | — |
| R066 | — | TODO | — | — |
| R067 | — | TODO | — | — |
| R068 | — | TODO | — | — |
| R069 | — | TODO | — | — |
| R070 | — | TODO | — | — |
| R071 | — | TODO | — | — |
| R072 | — | TODO | — | — |
| R073 | — | TODO | — | — |
| R074 | — | TODO | — | — |
| R075 | — | TODO | — | — |
| R076 | — | TODO | — | — |
| R077 | — | TODO | — | — |
| R078 | — | TODO | — | — |
| R079 | — | TODO | — | — |
| R080 | — | TODO | — | — |
| R081 | — | TODO | — | — |
| R082 | — | TODO | — | — |
| R083 | — | TODO | — | — |
| R084 | — | TODO | — | — |
| R085 | — | TODO | — | — |
| R086 | — | TODO | — | — |
| R087 | — | TODO | — | — |
| R088 | — | TODO | — | — |
| R089 | — | TODO | — | — |
| R090 | — | TODO | — | — |
| R091 | — | TODO | — | — |
| R092 | — | TODO | — | — |
| R093 | — | TODO | — | — |
| R094 | — | TODO | — | — |
| R095 | — | TODO | — | — |
| R096 | — | TODO | — | — |
| R097 | — | TODO | — | — |
| R098 | — | TODO | — | — |
| R099 | — | TODO | — | — |
| R100 | — | TODO | — | — |
| R101 | — | TODO | — | — |
| R102 | — | TODO | — | — |
| R103 | — | TODO | — | — |
| R104 | — | TODO | — | — |
| R105 | — | TODO | — | — |
| R106 | — | TODO | — | — |
| R107 | — | TODO | — | — |
| R108 | — | TODO | — | — |
| R109 | — | TODO | — | — |
| R110 | — | TODO | — | — |
| R111 | — | TODO | — | — |
| R112 | — | TODO | — | — |
| R113 | — | TODO | — | — |
| R114 | — | TODO | — | — |
| R115 | — | TODO | — | — |
| R116 | — | TODO | — | — |
| R117 | — | TODO | — | — |
| R118 | — | TODO | — | — |
| R119 | — | TODO | — | — |
| R120 | — | TODO | — | — |
| R121 | — | TODO | — | — |
| R122 | — | TODO | — | — |
| R123 | — | TODO | — | — |
| R124 | — | TODO | — | — |
| R125 | — | TODO | — | — |
| R126 | — | TODO | — | — |
| R127 | — | TODO | — | — |
| R128 | — | TODO | — | — |
| R129 | — | TODO | — | — |
| R130 | — | TODO | — | — |
| R131 | — | TODO | — | — |
| R132 | — | TODO | — | — |
| R133 | — | TODO | — | — |
| R134 | — | TODO | — | — |
| R135 | — | TODO | — | — |
| R136 | — | TODO | — | — |
| R137 | — | TODO | — | — |
| R138 | — | TODO | — | — |
| R139 | — | TODO | — | — |
| R140 | — | TODO | — | — |
| R141 | — | TODO | — | — |
| R142 | — | TODO | — | — |
| R143 | — | TODO | — | — |
| R144 | — | TODO | — | — |
| R145 | — | TODO | — | — |
| JOB-REMINDER | — | TODO | — | scheduler.js runOnce() — G1A.4 (race hiện tại)/G1A.8 |
| JOB-MONITOR-SCAN | — | TODO | — | monitor.js runScan()/applySchedule() — G1A.8 |
