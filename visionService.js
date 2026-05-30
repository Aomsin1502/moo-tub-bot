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
      console.log(`[OCR] HTTP ${statusCode} | ${contentType}`);
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[OCR] size: ${buffer.length} bytes`);
        resolve({ buffer, statusCode, contentType });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// แก้ความสับสน OCR ระหว่าง letter/digit ที่หน้าตาคล้ายกัน
function fixOcrDigits(str) {
  // ใน tracking number: ส่วนกลางควรเป็นตัวเลขทั้งหมด
  // แทน O→0, I/l→1 เฉพาะส่วนที่คาดว่าเป็น digit (ระหว่าง 2 letters กับ TH)
  return str.replace(/([A-Z]{2})([A-Z0-9]{8,11})(TH)/g, (_, pre, mid, suf) =>
    pre + mid.replace(/O/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8') + suf
  );
}

// OCR — ดึง tracking numbers จากรูป (eng เท่านั้น tracking เป็น ASCII)
// return: { trackingNumbers, rawText, imageSize, statusCode }
async function extractTrackingNumbers(messageId) {
  const { buffer, statusCode, contentType } = await getLineImageBuffer(messageId);

  if (statusCode !== 200 || !contentType.startsWith('image/')) {
    return { trackingNumbers: [], rawText: `HTTP ${statusCode}`, imageSize: buffer.length, statusCode };
  }

  try {
    console.log('[OCR] starting Tesseract (eng)...');
    const result = await recognize(buffer, 'eng', {
      logger: m => { if (m.status === 'recognizing text') process.stdout.write(`\r[OCR] ${(m.progress * 100).toFixed(0)}%`); },
    });

    const rawText = result.data.text || '';
    console.log('\n[OCR] raw text:\n', rawText);

    // ลบ whitespace ทั้งหมด → แก้ OCR digit errors → หา pattern
    const noSpace = rawText.replace(/\s/g, '').toUpperCase();
    const fixed   = fixOcrDigits(noSpace);
    const found   = fixed.match(/[A-Z]{2}\d{8,11}TH/g) || [];
    const trackingNumbers = [...new Set(found)];

    console.log('[OCR] tracking numbers:', trackingNumbers);
    return { trackingNumbers, rawText, imageSize: buffer.length, statusCode };
  } catch (err) {
    console.error('[OCR] error:', err.message);
    return { trackingNumbers: [], rawText: `[error] ${err.message}`, imageSize: buffer.length, statusCode };
  }
}

module.exports = { extractTrackingNumbers };
