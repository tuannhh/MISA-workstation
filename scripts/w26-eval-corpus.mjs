'use strict';
// W2.6 — Corpus tổng hợp (KHÔNG dữ liệu thật, đúng yêu cầu O6) cho golden eval Gemini
// gemini-3.5-flash (pin hiện tại) vs candidate. 4 nhóm x 15 ca = 60 ca, mỗi ca có ground-truth
// nhúng sẵn trong prompt/input để chấm điểm tự động (schema-validity + field-accuracy), không cần
// người chấm tay. Import trực tiếp 4 schema thật từ server/ai.js (routes.testables) để KHÔNG lệch
// với schema production đang dùng.

const AWARD_ORGS = [
  ['Bộ Thông tin và Truyền thông', 'gov'], ['Bộ Tài chính', 'gov'], ['Hiệp hội Phần mềm Việt Nam (VINASA)', 'association'],
  ['Hiệp hội Doanh nghiệp nhỏ và vừa Việt Nam', 'association'], ['Tạp chí Kinh tế Việt Nam', 'other'],
  ['Phòng Thương mại và Công nghiệp Việt Nam (VCCI)', 'association'], ['Bộ Khoa học và Công nghệ', 'gov'],
  ['Hội Tin học Việt Nam (VAIP)', 'association'], ['Báo Đầu tư', 'other'], ['Bộ Kế hoạch và Đầu tư', 'gov'],
  ['Hiệp hội An toàn thông tin Việt Nam (VNISA)', 'association'], ['Tạp chí Diễn đàn Doanh nghiệp', 'other'],
  ['Bộ Công Thương', 'gov'], ['Hiệp hội Internet Việt Nam (VIA)', 'association'], ['Báo VietnamNet', 'other'],
];
const AWARD_NAMES = [
  'Giải thưởng Chuyển đổi số Việt Nam', 'Sao Khuê', 'Doanh nghiệp Công nghệ số xuất sắc', 'Top 10 Doanh nghiệp CNTT hàng đầu',
  'Giải thưởng Sản phẩm Công nghệ số Make in Vietnam', 'Thương hiệu mạnh Việt Nam', 'Giải thưởng An toàn thông tin tiêu biểu',
  'Top 50 nơi làm việc tốt nhất', 'Giải thưởng Đổi mới sáng tạo quốc gia', 'ASOCIO Digital Award',
  'Giải thưởng Trách nhiệm xã hội doanh nghiệp', 'Sản phẩm Fintech tiêu biểu', 'Giải thưởng Chất lượng quốc gia',
  'Top 10 thương hiệu tin cậy', 'Giải thưởng Quản trị doanh nghiệp tốt nhất',
];
const SCALES = ['Toàn quốc', 'Khu vực miền Bắc', 'Quốc tế', 'Toàn quốc'];

function awardCase(i) {
  const [organizer, organizer_type] = AWARD_ORGS[i % AWARD_ORGS.length];
  const name = AWARD_NAMES[i % AWARD_NAMES.length];
  const scale = SCALES[i % SCALES.length];
  const month = String(1 + (i % 12)).padStart(2, '0');
  const day = String(1 + ((i * 3) % 27)).padStart(2, '0');
  const deadline = `2026-${month}-${day}`;
  const cost = i % 4 === 0 ? 0 : (i % 4) * 500000;
  const text = `Thông báo: ${organizer} phát động chương trình "${name}" năm 2026, quy mô ${scale}. `
    + `Hạn nộp hồ sơ: ${deadline}. ${cost > 0 ? `Lệ phí tham gia: ${cost.toLocaleString('vi-VN')} đồng.` : 'Chương trình miễn phí tham gia.'} `
    + `Đối tượng: doanh nghiệp công nghệ, phần mềm hoạt động hợp pháp tại Việt Nam, có báo cáo tài chính minh bạch tối thiểu 2 năm gần nhất. `
    + `Tiêu chí đánh giá dựa trên: mức độ đổi mới sáng tạo, hiệu quả kinh doanh, đóng góp cho cộng đồng. `
    + `Hồ sơ gồm: đơn đăng ký, báo cáo thành tích, tài liệu minh chứng. Cơ cấu giải: 1 giải Đặc biệt, 3 giải Nhất, 10 giải Nhì. `
    + `Phương thức đánh giá: hội đồng chuyên gia chấm điểm qua 2 vòng. Phạm vi: trong nước.`;
  return { id: `AWD-${String(i + 1).padStart(2, '0')}`, family: 'award-extract', input: text, truth: { name, organizer, organizer_type, submission_deadline: deadline } };
}

const EVENT_NAMES = [
  'Hội nghị Khách hàng MISA AMIS 2026', 'Ngày hội Chuyển đổi số Doanh nghiệp', 'Tọa đàm Kế toán - Thuế thời đại số',
  'Hội thảo An ninh mạng cho SME', 'Diễn đàn Công nghệ Tài chính Việt Nam', 'Lễ ra mắt sản phẩm MISA SME 2026',
  'Hội nghị Đối tác chiến lược MISA', 'Ngày hội Tuyển dụng Công nghệ', 'Tọa đàm Quản trị nhân sự số',
  'Hội thảo Hóa đơn điện tử và Thuế điện tử', 'Diễn đàn Doanh nghiệp nhỏ và vừa 2026', 'Chương trình Đào tạo Đối tác MISA',
  'Hội nghị Khách hàng khu vực miền Nam', 'Ngày hội Việc làm ngành CNTT', 'Tọa đàm Chuyển đổi số ngành Y tế',
];
const FIELDS = ['Công nghệ', 'Tài chính - Thuế', 'Quản trị', 'An ninh mạng'];
const FORMATS = ['Offline', 'Online', 'Hybrid'];
const LOCATIONS = ['Trung tâm Hội nghị Quốc gia, Hà Nội', 'Khách sạn Rex, TP.HCM', 'Trung tâm Hội nghị Ariyana, Đà Nẵng', 'Văn phòng MISA, Hà Nội'];

function eventCase(i) {
  const name = EVENT_NAMES[i % EVENT_NAMES.length];
  const mode = i % 3 === 0 ? 'join' : 'host';
  const field = FIELDS[i % FIELDS.length];
  const format = FORMATS[i % FORMATS.length];
  const location = LOCATIONS[i % LOCATIONS.length];
  const month = String(1 + (i % 12)).padStart(2, '0');
  const day = String(1 + ((i * 5) % 27)).padStart(2, '0');
  const start = `2026-${month}-${day}`;
  const attendees = 50 + i * 15;
  const organizer = mode === 'host' ? 'MISA' : `Đối tác chiến lược số ${i % 5}`;
  const text = `Kế hoạch chương trình "${name}" dự kiến diễn ra ngày ${start} tại ${location}, hình thức ${format}. `
    + `${mode === 'host' ? 'MISA là đơn vị tổ chức chính.' : `MISA tham gia với vai trò đồng hành cùng ${organizer}.`} `
    + `Lĩnh vực: ${field}. Quy mô dự kiến ${attendees} người tham dự, thành phần khách mời gồm C-Level và quản lý cấp trung của doanh nghiệp vừa và nhỏ. `
    + `Mục tiêu: giới thiệu giải pháp, kết nối khách hàng tiềm năng, nâng cao nhận diện thương hiệu. Ngân sách dự kiến do phòng Marketing phê duyệt.`;
  return { id: `EVT-${String(i + 1).padStart(2, '0')}`, family: 'event-extract', input: text, truth: { name, mode, field, format, start_time: start, location, scale_attendees: attendees } };
}

function adviceCase(i) {
  const award = AWARD_NAMES[i % AWARD_NAMES.length];
  const organizer = AWARD_ORGS[(i + 2) % AWARD_ORGS.length][0];
  const criteria = 'Đổi mới sáng tạo, hiệu quả kinh doanh, mức độ ứng dụng công nghệ mới (AI, Cloud)';
  const prize = '1 giải Đặc biệt, 3 giải Nhất, 10 giải Nhì';
  const products = ['MISA AMIS', 'MISA SME.NET', 'MISA meInvoice', 'MISA eShop'][i % 4];
  return {
    id: `ADV-${String(i + 1).padStart(2, '0')}`, family: 'award-advice',
    input: { name: award, organizer, criteria, prize_structure: prize, products },
  };
}

const SUBJECT_NAMES = ['Báo VnExpress', 'Đài Truyền hình Việt Nam', 'Báo Tuổi Trẻ', 'Tạp chí Kinh tế Sài Gòn', 'Báo Thanh Niên'];
const DATE_TYPES = ['founding', 'anniversary', 'birthday', 'other'];
function cardCase(i) {
  const subject_name = SUBJECT_NAMES[i % SUBJECT_NAMES.length];
  const date_type = DATE_TYPES[i % DATE_TYPES.length];
  const title = i % 2 === 0 ? `Kỷ niệm ${10 + i} năm thành lập` : '';
  const idea = i % 3 === 0 ? 'Nhấn mạnh mối quan hệ hợp tác lâu năm và tin cậy' : '';
  return { id: `CRD-${String(i + 1).padStart(2, '0')}`, family: 'card-text', input: { title, date_type, subject_name, idea } };
}

export function buildCorpus() {
  const cases = [];
  for (let i = 0; i < 15; i += 1) cases.push(awardCase(i));
  for (let i = 0; i < 15; i += 1) cases.push(eventCase(i));
  for (let i = 0; i < 15; i += 1) cases.push(adviceCase(i));
  for (let i = 0; i < 15; i += 1) cases.push(cardCase(i));
  return cases;
}
