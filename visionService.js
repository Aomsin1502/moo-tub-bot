const { ImageAnnotatorClient } = require('@google-cloud/vision');
const https = require('https');

// ดึงรูปจาก LINE CDN — return { buffer, statusCode, contentType }
function getLineImageBuffer(messageId) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'api-data.line.me',
      path: `/v2/bot/message/${messageId}/content`,
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    }, (res) => {
      const statusCode  = res.statusCode;
      const contentType = res.headers['content-type'] || '';
      console.log(`[Vision] LINE image HTTP ${statusCode} | ${contentType}`);

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[Vision] image buffer size: ${buffer.length} bytes`);
        resolve({ buffer, statusCode, contentType });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// OCR — return { trackingNumbers, rawText, imageSize, statusCode }
async function extractTrackingNumbers(messageId) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('[Vision] ไม่มี credentials');
    return { trackingNumbers: [], rawText: '', imageSize: 0, statusCode: 0 };
  }

  // ดาวน์โหลดรูปจาก LINE
  const { buffer, statusCode, contentType } = await getLineImageBuffer(messageId);

  if (statusCode !== 200 || !contentType.startsWith('image/')) {
    console.error(`[Vision] ไม่ใช่รูปภาพ: HTTP ${statusCode}, content-type: ${contentType}`);
    const errText = buffer.toString('utf-8').slice(0, 200);
    console.error('[Vision] response body:', errText);
    return { trackingNumbers: [], rawText: '', imageSize: buffer.length, statusCode };
  }

  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const visionClient = new ImageAnnotatorClient({ credentials: creds });

  try {
    // documentTextDetection เหมาะกับใบเสร็จ/เอกสารมากกว่า textDetection
    const [result] = await visionClient.documentTextDetection({
      image: { content: buffer.toString('base64') },
    });

    const rawText = result.fullTextAnnotation?.text || '';
    console.log('[Vision] OCR raw text:\n', rawText);

    // ลบ whitespace ทั้งหมดก่อน match
    const noSpace = rawText.replace(/\s+/g, '').toUpperCase();

    // ไปรษณีไทย: 2 ตัวอักษร + 8–11 ตัวเลข + TH
    const found = noSpace.match(/[A-Z]{2}\d{8,11}[A-Z]{2}/g) || [];
    const trackingNumbers = [...new Set(found.filter(t => t.endsWith('TH')))];

    console.log('[Vision] tracking numbers:', trackingNumbers);
    return { trackingNumbers, rawText, imageSize: buffer.length, statusCode };
  } catch (err) {
    console.error('[Vision] OCR error:', err.message);
    return { trackingNumbers: [], rawText: `[Vision API error] ${err.message}`, imageSize: buffer.length, statusCode };
  }
}

module.exports = { extractTrackingNumbers };
