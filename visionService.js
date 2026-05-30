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
// return: { trackingNumbers: string[], rawText: string }
async function extractTrackingNumbers(imageBuffer) {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('[Vision] ไม่มี credentials');
    return { trackingNumbers: [], rawText: '' };
  }

  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const visionClient = new ImageAnnotatorClient({ credentials: creds });

  try {
    const [result] = await visionClient.textDetection({
      image: { content: imageBuffer.toString('base64') },
    });

    const rawText = result.fullTextAnnotation?.text || '';
    console.log('[Vision] OCR raw text:\n', rawText);

    // ลบ whitespace ทั้งหมดก่อน match
    // เพราะ OCR อาจอ่านเลขมีช่องว่างกลาง เช่น "EF 1234 5678 TH" → "EF12345678TH"
    const noSpace = rawText.replace(/\s+/g, '').toUpperCase();

    // ไปรษณีไทย: 2 ตัวอักษร + 8-11 ตัวเลข + 2 ตัวอักษร ลงท้าย TH
    const found = noSpace.match(/[A-Z]{2}\d{8,11}[A-Z]{2}/g) || [];
    const trackingNumbers = [...new Set(found.filter(t => t.endsWith('TH')))];

    console.log('[Vision] tracking numbers:', trackingNumbers);
    return { trackingNumbers, rawText };
  } catch (err) {
    console.error('[Vision] OCR error:', err.message);
    return { trackingNumbers: [], rawText: '' };
  }
}

module.exports = { getLineImageBuffer, extractTrackingNumbers };
