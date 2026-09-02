#!/usr/bin/env node
// Live contract verification for the production Gemini gateway. It sends only synthetic/public
// Vietnamese samples, never persists model output, and never prints prompts, audio, responses,
// or credentials. Run explicitly: npm run test:gemini:live
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const gemini = require('../server/gemini');
const cfg = require('../server/config');
const runCount = Math.max(1, Math.min(5, Number(process.env.GEMINI_LIVE_VOICE_RUNS || 3)));
const failures = [];
const timings = [];
const artifactPath = process.env.GEMINI_LIVE_ARTIFACT || path.join(process.cwd(), 'data', 'gemini-live-contract-last.json');
function assert(condition, message) { if (!condition) throw new Error(message); }
async function check(name, fn) {
  const started = Date.now();
  try { await fn(); timings.push({ name, ok: true, ms: Date.now() - started }); }
  catch (error) { failures.push({ name, error: error?.message || 'unknown error' }); timings.push({ name, ok: false, ms: Date.now() - started }); }
}

const AWARD_SCHEMA = { type: 'object', properties: {
  name: { type: 'string', minLength: 1, maxLength: 500 }, organizer: { type: 'string', maxLength: 500 },
  submission_deadline: { type: 'string', maxLength: 10 }, ai_summary: { type: 'string', minLength: 1, maxLength: 1000 },
}, required: ['name', 'ai_summary'] };
const EVENT_SCHEMA = { type: 'object', properties: {
  name: { type: 'string', minLength: 1, maxLength: 500 }, organizer: { type: 'string', maxLength: 500 },
  mode: { type: 'string', enum: ['host', 'join'] }, start_time: { type: 'string', maxLength: 10 },
}, required: ['name'] };
const VOICE_SCHEMA = { type: 'object', properties: {
  transcript: { type: 'string', minLength: 1, maxLength: 20000 }, summary: { type: 'string', minLength: 1, maxLength: 4000 },
  channel: { type: 'string', enum: ['Gặp mặt', 'Điện thoại', 'Email', 'Sự kiện', 'Khác'] },
  result: { type: 'string', enum: ['Tích cực', 'Trung lập', 'Cần theo dõi'] }, person_name: { type: 'string', maxLength: 200 },
  org_name: { type: 'string', maxLength: 200 }, date: { type: 'string', maxLength: 10 },
}, required: ['transcript', 'summary'] };

if (!cfg.GEMINI_API_KEY) {
  writeFileSync(artifactPath, JSON.stringify({ status: 'SKIP', reason: 'GEMINI_API_KEY is not configured', at: new Date().toISOString() }, null, 2));
  console.error('LIVE-GEMINI: SKIP — GEMINI_API_KEY is not configured. No request was sent.');
  process.exitCode = 2;
} else {
  await check('structured-award-extraction', async () => {
    const out = await gemini.genJSON([{ text: 'Trích xuất theo schema, không suy diễn: Thông báo Giải Demo An Toàn 2026 do Hội Ví Dụ tổ chức. Hạn nộp hồ sơ là 2026-10-15. Đây là dữ liệu kiểm thử công khai, không có người thật.' }], AWARD_SCHEMA, { temperature: 0 });
    assert(out.name.includes('Giải Demo An Toàn 2026'), 'award name drift');
    assert(out.organizer.includes('Hội Ví Dụ'), 'award organizer drift');
    assert(out.submission_deadline === '2026-10-15', 'award deadline drift');
  });
  await check('structured-event-extraction', async () => {
    const out = await gemini.genJSON([{ text: 'Đây là tài liệu KẾ HOẠCH một SỰ KIỆN của MISA. Đọc và trích xuất thông tin tổng quan theo schema. mode: "host" nếu MISA là đơn vị tổ chức chính; "join" nếu MISA chỉ tham gia/tài trợ. start_time: YYYY-MM-DD nếu suy ra được. Chỉ điền thông tin có trong tài liệu; trường không rõ để trống. Dữ liệu nguồn: Sự kiện thử nghiệm Công nghệ Mẫu 2026 do MISA Demo tổ chức chính tại Hà Nội, bắt đầu ngày 2026-11-20.' }], EVENT_SCHEMA, { temperature: 0 });
    assert(out.name.includes('Công nghệ Mẫu 2026'), 'event name drift');
    assert(out.mode === 'host', 'event mode drift');
    assert(out.start_time === '2026-11-20', 'event date drift');
  });
  await check('grounded-search-sources', async () => {
    const out = await gemini.groundedSearch('MISA AMIS là gì? Trả lời ngắn gọn bằng tiếng Việt.', { temperature: 0 });
    assert(out.text.length >= 20, 'grounded answer is empty');
    assert(out.chunks.every((chunk) => /^https:\/\//.test(chunk.uri) && !/^[^/]+:\/\/[^/]*@/.test(chunk.uri)), 'unsafe grounding URL escaped gateway');
  });
  await check('text-generation', async () => {
    const text = await gemini.genText('Viết đúng hai câu tiếng Việt ngắn về một cuộc họp thử nghiệm nội bộ. Không nêu người, số điện thoại hay email.', { temperature: 0 });
    assert(text.length >= 20 && text.length <= 1000, 'text output length is invalid');
  });
  await check('image-generation', async () => {
    const image = await gemini.genImage('Tạo một minh hoạ tối giản, không chữ, về lịch họp thử nghiệm trên nền trắng. Không dùng người thật hay logo.', []);
    const bytes = Buffer.from(image.data, 'base64');
    assert(/^image\/(png|jpeg|webp)$/i.test(image.mime), 'unexpected image MIME');
    assert(bytes.length > 100, 'image payload is unexpectedly small');
  });

  const dir = mkdtempSync(path.join(tmpdir(), 'pr-gemini-live-'));
  const audioPath = path.join(dir, 'synthetic-voice.aiff');
  try {
    execFileSync('/usr/bin/say', ['-v', 'Linh', '-o', audioPath, 'Ngày hai tháng chín năm hai nghìn không trăm hai mươi sáu, tôi gọi điện cho chị Lan tại Báo Ví Dụ. Hai bên đã thống nhất lịch gặp tuần sau. Kết quả tích cực.'], { stdio: 'ignore' });
    const audio = readFileSync(audioPath);
    let voicePasses = 0;
    for (let index = 0; index < runCount; index += 1) {
      await check(`voice-extraction-${index + 1}`, async () => {
        const out = await gemini.genJSON([
          { text: 'Nghe audio tiếng Việt này. Chỉ trích xuất sự kiện được nói: transcript, summary, channel trong enum, result trong enum, person_name, org_name. Chỉ điền date dạng YYYY-MM-DD nếu lời nói nêu rõ.' },
          { inlineData: { mimeType: 'audio/aiff', data: audio.toString('base64') } },
        ], VOICE_SCHEMA, { temperature: 0 });
        assert(/Lan/i.test(`${out.transcript} ${out.person_name || ''}`), 'voice person drift');
        assert(/Ví Dụ/i.test(`${out.transcript} ${out.org_name || ''}`), 'voice organisation drift');
        assert(out.date === '2026-09-02', 'voice date drift');
        assert(out.channel === 'Điện thoại' && out.result === 'Tích cực', 'voice classification drift');
        voicePasses += 1;
      });
    }
    if (voicePasses < Math.ceil(runCount * 2 / 3)) failures.push({ name: 'voice-consistency-threshold', error: `only ${voicePasses}/${runCount} voice runs met the semantic contract` });
  } catch (error) {
    failures.push({ name: 'synthetic-voice-fixture', error: error?.message || 'could not create synthetic audio' });
  } finally { rmSync(dir, { recursive: true, force: true }); }

  const passed = timings.filter((item) => item.ok).length;
  writeFileSync(artifactPath, JSON.stringify({
    status: failures.length ? 'FAIL' : 'PASS', at: new Date().toISOString(), textModel: cfg.GEMINI_TEXT_MODEL,
    imageModel: cfg.GEMINI_IMAGE_MODEL, voiceRunsRequested: runCount, timings, failures,
    // The artifact deliberately contains metadata only: no prompt, response, audio or credential.
  }, null, 2));
  console.log(`LIVE-GEMINI: ${failures.length ? 'FAIL' : 'PASS'} | model=${cfg.GEMINI_TEXT_MODEL} imageModel=${cfg.GEMINI_IMAGE_MODEL} | ${passed}/${timings.length} calls passed | ${timings.map((item) => `${item.name}:${item.ms}ms`).join(', ')}`);
  if (failures.length) {
    for (const failure of failures) console.error(`LIVE-GEMINI failure [${failure.name}]: ${failure.error}`);
    process.exitCode = 1;
  }
}
