const MENU = [
  {
    category: '🐷 หมูทุบ',
    items: [
      { name: 'หมูทุบ 130g',   price: 100, weight: 130  },
      { name: 'หมูทุบ 500g',   price: 350, weight: 500  },
      { name: 'หมูทุบ 1000g',  price: 700, weight: 1000 },
    ],
  },
  {
    category: '🐷 หมูแท่ง',
    items: [
      { name: 'หมูแท่ง 130g',  price: 100, weight: 130 },
      { name: 'หมูแท่ง 200g',  price: 200, weight: 200 },
      { name: 'หมูแท่ง 500g',  price: 350, weight: 500 },
    ],
  },
  {
    category: '🐷 หมูแผ่นกรอบ',
    items: [
      { name: 'หมูแผ่นกรอบ 130g', price: 100, weight: 130 },
    ],
  },
  {
    category: '🐷 หมูสวรรค์',
    items: [
      { name: 'หมูสวรรค์ 170g',  price: 100, weight: 170  },
      { name: 'หมูสวรรค์ 350g',  price: 200, weight: 350  },
      { name: 'หมูสวรรค์ 500g',  price: 300, weight: 500  },
      { name: 'หมูสวรรค์ 1000g', price: 600, weight: 1000 },
    ],
  },
  {
    category: '🐷 หมูฝอย',
    items: [
      { name: 'หมูฝอย 180g',  price: 100, weight: 180  },
      { name: 'หมูฝอย 350g',  price: 200, weight: 350  },
      { name: 'หมูฝอย 500g',  price: 300, weight: 500  },
      { name: 'หมูฝอย 1000g', price: 600, weight: 1000 },
    ],
  },
  {
    category: '🐷 ฝอยกรอบ',
    items: [
      { name: 'ฝอยกรอบ 170g', price: 100, weight: 170 },
      { name: 'ฝอยกรอบ 350g', price: 200, weight: 350 },
    ],
  },
  {
    category: '🐷 หมูหยอง',
    items: [
      { name: 'หมูหยอง 150g',  price: 100, weight: 150  },
      { name: 'หมูหยอง 500g',  price: 300, weight: 500  },
      { name: 'หมูหยอง 1000g', price: 600, weight: 1000 },
    ],
  },
  {
    category: '🔥 สินค้าอื่นๆ',
    items: [
      { name: 'ปลาเก๋าปรุงรส 150g',   price: 100, weight: 150 },
      { name: 'หมึกเชอรี่ 150g',       price: 100, weight: 150 },
      { name: 'เชียงปลาสลิด 500g',     price: 140, weight: 500 },
      { name: 'กุนเชียงหมู 500g',      price: 140, weight: 500 },
    ],
  },
  {
    category: '🌶️ น้ำพริก',
    items: [
      { name: 'น้ำพริกกากหมู 200g',           price: 100, weight: 200 },
      { name: 'น้ำพริกกากหมู 500g',           price: 250, weight: 500 },
      { name: 'น้ำพริกแมงดา (เปียก)',          price: 50,  weight: 370 },
      { name: 'น้ำพริกตาแดง (เปียก)',          price: 50,  weight: 370 },
      { name: 'น้ำพริกปลาย่าง (เปียก)',        price: 50,  weight: 370 },
      { name: 'น้ำพริกเผากุ้ง (เปียก)',        price: 50,  weight: 170 },
      { name: 'น้ำพริกปลาสลิด',               price: 50,  weight: 230 },
      { name: 'น้ำพริกปลาดุกฟูผัดพริกขิง',    price: 50,  weight: 230 },
      { name: 'น้ำพริกหมูทุบ',                price: 50,  weight: 100 },
      { name: 'น้ำพริกปลาย่าง',               price: 50,  weight: 370 },
      { name: 'น้ำพริกนรกแมงดา (แห้ง)',       price: 50,  weight: 250 },
      { name: 'น้ำพริกนรกปลาย่าง (แห้ง)',     price: 50,  weight: 250 },
    ],
  },
  {
    category: '🦐 กะปิ & อื่นๆ',
    items: [
      { name: 'กะปิแท้ชุมพร',        price: 70, weight: 350 },
      { name: 'กะปิกุ้งหวาน',        price: 70, weight: 350 },
      { name: 'ขิงดอง 500g',         price: 50, weight: 500 },
      { name: 'ไชโป๊แบบเส้น 400g',   price: 50, weight: 400 },
      { name: 'ไชโป๊แบบแว่น 400g',   price: 50, weight: 400 },
      { name: 'ไชโป๊แบบลูกเต๋า 400g', price: 50, weight: 400 },
    ],
  },
];

// Flat list สำหรับ matching
const FLAT_ITEMS = MENU.flatMap(cat => cat.items);

// ─── อัตราค่าส่งไปรษณีไทย ─────────────────────────────────
const SHIPPING_RATES = [
  { maxWeight: 3000, fee: 80  },  // ≤ 3 กก
  { maxWeight: 5000, fee: 100 },  // 3–5 กก
  { maxWeight: Infinity, fee: 200 }, // > 5 กก
];

// คำนวณค่าส่งจาก cart
function calcShipping(cart) {
  const totalWeight = cart.reduce((sum, item) => sum + (item.weight || 0) * item.qty, 0);
  const rate = SHIPPING_RATES.find(r => totalWeight <= r.maxWeight) || SHIPPING_RATES[SHIPPING_RATES.length - 1];
  return { totalWeight, fee: rate.fee };
}

module.exports = { MENU, FLAT_ITEMS, calcShipping };
