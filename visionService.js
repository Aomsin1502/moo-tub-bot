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

// OCR ด้วย Tesseract.js (ฟรี ไม่ต้อง API key)
// return: { trackingNumbers, rawText, imageSize, statusCode }
async function extractTrackingNumbers(messageId) {
  const { buffer, statusCode, contentType } = await getLineImageBuffer(messageId);

  if (statusCode !== 200 || !contentType.startsWith('image/')) {
    const errBody = buffer.toString('utf-8').slice(0, 200);
    console.error('[OCR] ไม่ใช่รูปภาพ:', errBody);
    return { trackingNumbers: [], rawText: `HTTP ${statusCode} — ไม่ใช่รูปภาพ`, imageSize: buffer.length, statusCode };
  }

  try {
    console.log('[OCR] กำลังอ่านด้วย Tesseract...');
    const result = await recognize(buffer, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });

    const rawText = result.data.text || '';
    console.log('[OCR] raw text:\n', rawText);

    // ลบ whitespace ทั้งหมดก่อน match
    // เพราะ OCR อาจอ่านได้ "EF 1234 5678 TH" → "EF12345678TH"
    const noSpace = rawText.replace(/\s+/g, '').toUpperCase();

    // ไปรษณีไทย: 2 ตัวอักษร + 8–11 ตัวเลข + TH
    const found = noSpace.match(/[A-Z]{2}\d{8,11}[A-Z]{2}/g) || [];
    const trackingNumbers = [...new Set(found.filter(t => t.endsWith('TH')))];

    console.log('[OCR] tracking numbers:', trackingNumbers);
    return { trackingNumbers, rawText, imageSize: buffer.length, statusCode };
  } catch (err) {
    console.error('[OCR] Tesseract error:', err.message);
    return { trackingNumbers: [], rawText: `[OCR error] ${err.message}`, imageSize: buffer.length, statusCode };
  }
}

module.exports = { extractTrackingNumbers };
