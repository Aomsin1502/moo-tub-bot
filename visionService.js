const { recognize } = require('tesseract.js');
const https = require('https');

// ดึงรูปจาก LINE CDN
function getLineImageBuffer(messageId) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'api-data.line.me',
      path: `/v2/bot/message/${messageId}/content`,
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    }, (res) => {
      const statusCode  = res.statusCode;
      const contentType = res.headers['content-type'] || '';
      console.log(`[OCR] LINE image HTTP ${statusCode} | ${contentType}`);
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[OCR] image size: ${buffer.length} bytes`);
        resolve({ buffer, statusCode, contentType });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// แก้ความสับสน OCR: O↔0, I/l↔1 ในส่วนตัวเลข tracking
function fixOcrDigits(str) {
  // เฉพาะส่วนกลาง (ระหว่าง prefix 2 ตัวกับ suffix TH)
  return str.replace(/([A-Z]{2})([A-Z0-9]{8,11})(TH)/g, (_, prefix, mid, suffix) => {
    const cleaned = mid
      .replace(/O/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/S(?=\d|$)/g, '5')
      .replace(/B(?=\d|$)/g, '8');
    return prefix + cleaned + suffix;
  });
}

// parse ใบเสร็จไปรษณีไทย — ค้นแบบ global ทั้งข้อความ
function parseThaiPostReceipt(rawText) {
  // 1. ดึงชื่อผู้รับทั้งหมด (global search)
  const names = [];
  const nameRe = /ผู้รับ\s*:\s*([฀-๿]+(?:[\s][฀-๿]+)*)/g;
  let m;
  while ((m = nameRe.exec(rawText)) !== null) {
    const name = m[1].trim();
    if (name) names.push(name);
  }

  // 2. ดึง tracking ทั้งหมดจากข้อความรวม (global, ลบ whitespace ก่อน)
  const noSpace = rawText.replace(/\s/g, '').toUpperCase();
  const fixed   = fixOcrDigits(noSpace);
  const trackRe = /[A-Z]{2}\d{8,11}TH/g;
  const trackings = [...new Set((fixed.match(trackRe) || []))];

  console.log('[OCR] names found:', names);
  console.log('[OCR] trackings found:', trackings);

  // 3. จับคู่ตามลำดับ (ในใบเสร็จ ชื่อกับ tracking เรียงลำดับเดียวกัน)
  const maxLen = Math.max(names.length, trackings.length);
  if (maxLen === 0) return [];

  const pairs = [];
  for (let i = 0; i < maxLen; i++) {
    pairs.push({
      name:      names[i]     || '',
      trackingNo: trackings[i] || null,
    });
    console.log(`[OCR] pair ${i + 1}: "${names[i] || ''}" → ${trackings[i] || 'null'}`);
  }
  return pairs;
}

// OCR หลัก — return { pairs:[{name,trackingNo}], rawText, imageSize, statusCode }
async function extractTrackingNumbers(messageId) {
  const { buffer, statusCode, contentType } = await getLineImageBuffer(messageId);

  if (statusCode !== 200 || !contentType.startsWith('image/')) {
    const errBody = buffer.toString('utf-8').slice(0, 200);
    console.error('[OCR] ไม่ใช่รูปภาพ:', errBody);
    return { pairs: [], rawText: `HTTP ${statusCode}`, imageSize: buffer.length, statusCode };
  }

  try {
    console.log('[OCR] กำลังอ่านด้วย Tesseract...');
    const result = await recognize(buffer, 'eng+tha', {
      logger: m => { if (m.status === 'recognizing text') console.log(`[OCR] ${(m.progress * 100).toFixed(0)}%`); },
    });

    const rawText = result.data.text || '';
    console.log('[OCR] raw text:\n', rawText);

    const pairs = parseThaiPostReceipt(rawText);
    console.log('[OCR] pairs:', pairs);

    return { pairs, rawText, imageSize: buffer.length, statusCode };
  } catch (err) {
    console.error('[OCR] error:', err.message);
    return { pairs: [], rawText: `[OCR error] ${err.message}`, imageSize: buffer.length, statusCode };
  }
}

module.exports = { extractTrackingNumbers };
