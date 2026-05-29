const { ImageAnnotatorClient } = require('@google-cloud/vision');
const https = require('https');

// ดึงรูปจาก LINE CDN
function getLineImageBuffer(messageId) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: 'api-data.line.me',
      path: `/v2/bot/message/${messageId}/content`,
      headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// OCR และดึง tracking numbers จากรูป
async function extractTrackingNumbers(imageBuffer) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('[Vision] ไม่มี credentials');
    return [];
  }

  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const visionClient = new ImageAnnotatorClient({ credentials: creds });

  try {
    const [result] = await visionClient.textDetection({
      image: { content: imageBuffer.toString('base64') },
    });

    const fullText = result.fullTextAnnotation?.text || '';
    console.log('[Vision] OCR text:\n', fullText);

    // ไปรษณีไทย tracking format: 2 ตัวอักษร + 8-9 ตัวเลข + TH
    // เช่น EF12345678TH, EF123456789TH, ET12345678TH, RH12345678TH
    const found = fullText.match(/[A-Z]{2}\d{8,9}TH/g) || [];
    const unique = [...new Set(found)];

    console.log('[Vision] tracking numbers:', unique);
    return unique;
  } catch (err) {
    console.error('[Vision] OCR error:', err.message);
    return [];
  }
}

module.exports = { getLineImageBuffer, extractTrackingNumbers };
