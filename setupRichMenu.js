require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) { console.error('❌ ไม่พบ LINE_CHANNEL_ACCESS_TOKEN ใน .env'); process.exit(1); }

// หาไฟล์รูป rich-menu.png หรือ rich-menu.jpg
const exts = ['png', 'jpg', 'jpeg'];
let imagePath, contentType;
for (const ext of exts) {
  const p = path.join(__dirname, `rich-menu.${ext}`);
  if (fs.existsSync(p)) {
    imagePath = p;
    contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    break;
  }
}
if (!imagePath) {
  console.error('❌ ไม่พบไฟล์รูป\nกรุณาบันทึกรูปชื่อ "rich-menu.png" หรือ "rich-menu.jpg" ไว้ที่:\n' + path.join(__dirname, 'rich-menu.png'));
  process.exit(1);
}

const headers = { Authorization: `Bearer ${TOKEN}` };

const richMenuConfig = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: 'หมูทุบแม่บัวเผื่อน',
  chatBarText: '☰  เมนู',
  areas: [
    // แถวบน
    { bounds: { x: 0,    y: 0,   width: 833,  height: 843 }, action: { type: 'message', label: 'เมนู',       text: 'เมนู'       } },
    { bounds: { x: 833,  y: 0,   width: 834,  height: 843 }, action: { type: 'message', label: 'สั่งสินค้า', text: 'สั่ง'       } },
    { bounds: { x: 1667, y: 0,   width: 833,  height: 843 }, action: { type: 'message', label: 'ดูตะกร้า',  text: 'ตะกร้า'    } },
    // แถวล่าง
    { bounds: { x: 0,    y: 843, width: 833,  height: 843 }, action: { type: 'message', label: 'ยกเลิก',    text: 'ยกเลิก'    } },
    { bounds: { x: 833,  y: 843, width: 834,  height: 843 }, action: { type: 'message', label: 'เช็คสถานะ', text: 'สถานะ'     } },
    { bounds: { x: 1667, y: 843, width: 833,  height: 843 }, action: { type: 'message', label: 'ติดต่อร้าน', text: 'ติดต่อร้าน' } },
  ],
};

async function deleteExistingMenus() {
  try {
    const { data } = await axios.get('https://api.line.me/v2/bot/richmenu/list', { headers });
    for (const menu of data.richmenus || []) {
      await axios.delete(`https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`, { headers });
      console.log('   ลบ Rich Menu เก่า:', menu.richMenuId);
    }
  } catch (_) {}
}

async function setup() {
  console.log('\n🚀 ตั้งค่า Rich Menu ร้านหมูทุบแม่บัวเผื่อน\n');
  console.log('📁 ใช้ไฟล์รูป:', imagePath);

  const fileSizeKB = (fs.statSync(imagePath).size / 1024).toFixed(0);
  console.log('📏 ขนาดไฟล์:', fileSizeKB, 'KB');
  if (fileSizeKB > 1000) {
    console.warn('⚠️  ไฟล์ใหญ่เกิน 1MB LINE อาจปฏิเสธ กรุณา export รูปใหม่ให้เล็กกว่านี้');
    process.exit(1);
  }

  console.log('\n1️⃣  ลบ Rich Menu เก่า (ถ้ามี)...');
  await deleteExistingMenus();

  console.log('2️⃣  สร้าง Rich Menu ใหม่...');
  const { data: created } = await axios.post('https://api.line.me/v2/bot/richmenu', richMenuConfig, { headers });
  const richMenuId = created.richMenuId;
  console.log('   Rich Menu ID:', richMenuId);

  console.log('3️⃣  Upload รูป...');
  const image = fs.readFileSync(imagePath);
  await axios.post(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    image,
    { headers: { ...headers, 'Content-Type': contentType }, maxBodyLength: Infinity }
  );
  console.log('   Upload สำเร็จ!');

  console.log('4️⃣  ตั้งเป็น default สำหรับทุก user...');
  await axios.post(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {}, { headers });

  console.log('\n✅ เสร็จแล้ว! Rich Menu ใช้งานได้แล้วครับ');
  console.log('   ID:', richMenuId);
}

setup().catch(err => {
  console.error('\n❌ เกิดข้อผิดพลาด:', err.response?.data || err.message);
  process.exit(1);
});
