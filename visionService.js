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
        console.log(`[OCR] size: ${buffer.length} bytes`);
        resolve({ buffer, statusCode, contentType });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// แก้ความสับสน OCR ระหว่าง letter/digit
function fixOcrDigits(str) {
  return str.replace(/([A-Z]{2})([A-Z0-9]{8,11})(TH)/g, (_, pre, mid, suf) =>
    pre + mid.replace(/O/g, '0').replace(/[Il|]/g, '1') + suf
  );
}

// OCR ด้วย OCR.space API (แม่นกว่า Tesseract มาก)
async function callOcrSpace(imageBuffer) {
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) throw new Error('ไม่มี OCR_SPACE_API_KEY');

  const base64 = imageBuffer.toString('base64');
  const body = [
    `base64Image=data%3Aimage%2Fjpeg%3Bbase64%2C${encodeURIComponent(base64)}`,
    'language=eng',
    'isOverlayRequired=false',
    'detectOrientation=true',
    'scale=true',
    'OCREngine=2',
  ].join('&');

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.ocr.space',
      path: '/parse/image',
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(Buffer.concat(chunks).toString());
          console.log('[OCR] OCRSpace result:', JSON.stringify(json).slice(0, 500));
          const text = (json.ParsedResults || []).map(r => r.ParsedText || '').join('\n');
          resolve(text);
        } catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// OCR หลัก — return { trackingNumbers, rawText, imageSize, statusCode }
async function extractTrackingNumbers(messageId) {
  const { buffer, statusCode, contentType } = await getLineImageBuffer(messageId);

  if (statusCode !== 200 || !contentType.startsWith('image/')) {
    return { trackingNumbers: [], rawText: `HTTP ${statusCode}`, imageSize: buffer.length, statusCode };
  }

  try {
    console.log('[OCR] กำลังส่ง OCR.space...');
    const rawText = await callOcrSpace(buffer);
    console.log('[OCR] raw text:\n', rawText);

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
