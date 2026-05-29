const MENU = [
  {
    category: '🐷 หมูทุบ',
    items: [
      { name: 'หมูทุบ 130g', price: 100 },
      { name: 'หมูทุบ 500g', price: 350 },
      { name: 'หมูทุบ 1000g', price: 700 },
    ],
  },
  {
    category: '🐷 หมูแท่ง',
    items: [
      { name: 'หมูแท่ง 130g', price: 100 },
      { name: 'หมูแท่ง 200g', price: 200 },
      { name: 'หมูแท่ง 500g', price: 350 },
    ],
  },
  {
    category: '🐷 หมูแผ่นกรอบ',
    items: [
      { name: 'หมูแผ่นกรอบ 130g', price: 100 },
    ],
  },
  {
    category: '🐷 หมูสวรรค์',
    items: [
      { name: 'หมูสวรรค์ 170g', price: 100 },
      { name: 'หมูสวรรค์ 350g', price: 200 },
      { name: 'หมูสวรรค์ 500g', price: 300 },
      { name: 'หมูสวรรค์ 1000g', price: 600 },
    ],
  },
  {
    category: '🐷 หมูฝอย',
    items: [
      { name: 'หมูฝอย 180g', price: 100 },
      { name: 'หมูฝอย 350g', price: 200 },
      { name: 'หมูฝอย 500g', price: 300 },
      { name: 'หมูฝอย 1000g', price: 600 },
    ],
  },
  {
    category: '🐷 ฝอยกรอบ',
    items: [
      { name: 'ฝอยกรอบ 170g', price: 100 },
      { name: 'ฝอยกรอบ 350g', price: 200 },
    ],
  },
  {
    category: '🐷 หมูหยอง',
    items: [
      { name: 'หมูหยอง 150g', price: 100 },
      { name: 'หมูหยอง 500g', price: 300 },
      { name: 'หมูหยอง 1000g', price: 600 },
    ],
  },
  {
    category: '🔥 สินค้าอื่นๆ',
    items: [
      { name: 'ปลาเก๋าปรุงรส 150g', price: 100 },
      { name: 'หมึกเชอรี่ 150g', price: 100 },
      { name: 'เชียงปลาสลิด 500g', price: 140 },
      { name: 'กุนเชียงหมู 500g', price: 140 },
    ],
  },
  {
    category: '🌶️ น้ำพริก',
    items: [
      { name: 'น้ำพริกกากหมู 200g', price: 100 },
      { name: 'น้ำพริกกากหมู 500g', price: 250 },
      { name: 'น้ำพริกแมงดา (เปียก)', price: 50 },
      { name: 'น้ำพริกตาแดง (เปียก)', price: 50 },
      { name: 'น้ำพริกปลาย่าง (เปียก)', price: 50 },
      { name: 'น้ำพริกเผากุ้ง (เปียก)', price: 50 },
      { name: 'น้ำพริกปลาสลิด', price: 50 },
      { name: 'น้ำพริกปลาดุกฟูผัดพริกขิง', price: 50 },
      { name: 'น้ำพริกหมูทุบ', price: 50 },
      { name: 'น้ำพริกปลาย่าง', price: 50 },
      { name: 'น้ำพริกนรกแมงดา (แห้ง)', price: 50 },
      { name: 'น้ำพริกนรกปลาย่าง (แห้ง)', price: 50 },
    ],
  },
  {
    category: '🦐 กะปิ & อื่นๆ',
    items: [
      { name: 'กะปิแท้ชุมพร', price: 70 },
      { name: 'กะปิกุ้งหวาน', price: 70 },
      { name: 'ขิงดอง 500g', price: 50 },
      { name: 'ไชโป๊แบบเส้น 400g', price: 50 },
      { name: 'ไชโป๊แบบแว่น 400g', price: 50 },
      { name: 'ไชโป๊แบบลูกเต๋า 400g', price: 50 },
    ],
  },
];

// Flat list สำหรับ matching
const FLAT_ITEMS = MENU.flatMap(cat => cat.items);

module.exports = { MENU, FLAT_ITEMS };
