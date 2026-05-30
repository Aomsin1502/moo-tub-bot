// ทดสอบถอด QR code จากรูปใบเสร็จไปรษณีไทย
const { Jimp } = require('jimp');
const jsQR = require('jsqr');
const fs = require('fs');

async function testQR(imagePath) {
  console.log('อ่าน:', imagePath);
  const buf = fs.readFileSync(imagePath);

  const attempts = [
    img => img.resize({ w: 1000 }).greyscale(),
    img => img.resize({ w: 1000 }).greyscale().contrast(0.5),
    img => img.resize({ w: 1500 }).greyscale().contrast(0.8),
    img => img.resize({ w: 2000 }).greyscale(),
  ];

  const image = await Jimp.fromBuffer(buf);

  for (let i = 0; i < attempts.length; i++) {
    const img = image.clone();
    attempts[i](img);
    const { data, width, height } = img.bitmap;
    const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
    if (result) {
      console.log(`\n✅ พบ QR code (attempt ${i + 1}):`);
      console.log(result.data);
      return;
    }
    console.log(`attempt ${i + 1}: ไม่พบ QR`);
  }
  console.log('\n❌ ไม่พบ QR code ในรูปนี้');
}

const imgPath = process.argv[2];
if (!imgPath || !fs.existsSync(imgPath)) {
  console.log('วิธีใช้: node testQR.js "C:\\path\\to\\receipt.jpg"');
  process.exit(0);
}
testQR(imgPath).catch(console.error);
