const PROMPTPAY = process.env.PROMPTPAY_NUMBER || '0931726399';

// ─── แคตตาล็อกสินค้า ────────────────────────────────────────────────────────
// รูปอยู่ที่ /public/images/ — serve ผ่าน https://moo-tub-bot.onrender.com/images/
const IMG = 'https://moo-tub-bot.onrender.com/images';
const CATALOG_ITEMS = [
  { name: 'หมูทุบ 130g',    price: 100, imageUrl: `${IMG}/moo-tub-130g.jpg`    },
  { name: 'หมูทุบ 500g',    price: 350, imageUrl: `${IMG}/moo-tub-500g.jpg`    },
  { name: 'หมูแท่ง 130g',   price: 100, imageUrl: `${IMG}/moo-tang-130g.jpg`   },
  { name: 'หมูแท่ง 500g',   price: 350, imageUrl: `${IMG}/moo-tang-500g.jpg`   },
  { name: 'หมูสวรรค์ 500g', price: 300, imageUrl: `${IMG}/moo-sawan-500g.jpg`  },
  { name: 'หมูฝอย 170g',    price: 100, imageUrl: `${IMG}/moo-foi-170g.jpg`    },
  { name: 'หมูหยอง 140g',   price: 100, imageUrl: `${IMG}/moo-yong-140g.jpg`   },
  { name: 'น้ำพริกหมูทุบ',  price: 50,  imageUrl: `${IMG}/namprik-mootub.jpg`  },
];

function welcomeFlex() {
  return {
    type: 'flex',
    altText: '🐷 ยินดีต้อนรับสู่ร้านหมูทุบแม่บัวเผื่อน!',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#C0392B',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: '🐷 ร้านหมูทุบแม่บัวเผื่อน', weight: 'bold', size: 'xl', color: '#FFFFFF', align: 'center', wrap: true },
          { type: 'text', text: 'แม่บัวเผื่อน • ชุมพร', size: 'sm', color: '#FFD0CC', align: 'center' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: 'ยินดีต้อนรับครับ! 😊', weight: 'bold', size: 'lg', color: '#C0392B' },
          { type: 'text', text: 'สินค้าทำสดใหม่ทุกวัน จัดส่งทั่วไทย\nผ่าน Kerry / Flash Express', wrap: true, size: 'sm', color: '#555555' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md',
            contents: [
              { type: 'text', text: '🐷  หมูทุบ หมูแท่ง หมูสวรรค์ หมูฝอย หมูหยอง', size: 'sm', wrap: true },
              { type: 'text', text: '🌶️  น้ำพริกหลากหลาย 50–100 บาท', size: 'sm', wrap: true },
              { type: 'text', text: '🦐  กะปิแท้ชุมพร และสินค้าอื่นๆ', size: 'sm', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: '📜 ดูเมนูทั้งหมด', text: 'เมนู' },
            style: 'primary',
            color: '#C0392B',
          },
          {
            type: 'button',
            action: { type: 'message', label: '🛒 สั่งสินค้าเลย!', text: 'สั่ง' },
            style: 'secondary',
          },
        ],
      },
    },
  };
}

function cartFlex(cart, showConfirmButtons = false) {
  let total = 0;
  const itemRows = cart.map(item => {
    const sub = item.price * item.qty;
    total += sub;
    return {
      type: 'box',
      layout: 'horizontal',
      contents: [
        { type: 'text', text: `${item.name}${item.qty > 1 ? ` ×${item.qty}` : ''}`, size: 'sm', flex: 4, wrap: true, color: '#333333' },
        { type: 'text', text: `${sub} ฿`, size: 'sm', flex: 1, align: 'end', color: '#C0392B', weight: 'bold' },
      ],
    };
  });

  const footerContents = showConfirmButtons
    ? [
        {
          type: 'button',
          action: { type: 'message', label: '✅ ยืนยันสั่งซื้อ', text: 'ยืนยัน' },
          style: 'primary',
          color: '#27AE60',
        },
        {
          type: 'button',
          action: { type: 'message', label: '❌ ยกเลิก', text: 'ยกเลิก' },
          style: 'secondary',
        },
      ]
    : [];

  return {
    type: 'flex',
    altText: `🛒 รายการสั่งซื้อ รวม ${total} บาท`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#2C3E50',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '🛒 รายการสั่งซื้อของคุณ', weight: 'bold', color: '#FFFFFF', size: 'md' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          ...itemRows,
          { type: 'separator', margin: 'md' },
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              { type: 'text', text: '💰 รวมทั้งหมด', weight: 'bold', flex: 3 },
              { type: 'text', text: `${total} บาท`, weight: 'bold', color: '#C0392B', flex: 1, align: 'end', size: 'lg' },
            ],
          },
          { type: 'text', text: '⚠️ ค่าส่ง Kerry/Flash คิดแยกต่างหาก', size: 'xs', color: '#888888', margin: 'sm' },
        ],
      },
      ...(showConfirmButtons ? {
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: footerContents,
        },
      } : {}),
    },
  };
}

function paymentFlex(orderId, total) {
  return {
    type: 'flex',
    altText: `💳 ชำระเงิน ออเดอร์ #${orderId} ยอด ${total} บาท`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1A5276',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '💳 ข้อมูลการชำระเงิน', weight: 'bold', color: '#FFFFFF', size: 'md' },
          { type: 'text', text: `ออเดอร์ #${orderId}`, color: '#AED6F1', size: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              { type: 'text', text: '💰 ยอดสินค้า', flex: 2, color: '#555555' },
              { type: 'text', text: `${total} บาท`, flex: 1, align: 'end', weight: 'bold', color: '#C0392B', size: 'lg' },
            ],
          },
          { type: 'text', text: '⚠️ ค่าส่ง Kerry/Flash แจ้งแยกต่างหาก', size: 'xs', color: '#E74C3C', wrap: true },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '📱 โอนผ่าน PromptPay', weight: 'bold', margin: 'md' },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#EBF5FB',
            paddingAll: '12px',
            margin: 'sm',
            contents: [
              { type: 'text', text: PROMPTPAY, weight: 'bold', size: 'xxl', align: 'center', color: '#1A5276' },
              { type: 'text', text: '🏦 SCB (แม่บัวเผื่อน)', size: 'sm', align: 'center', color: '#555555', margin: 'sm' },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#FDFEFE',
            paddingAll: '12px',
            margin: 'md',
            contents: [
              { type: 'text', text: '📸 ส่งสลิปหลังโอนเงินได้เลยครับ', weight: 'bold', color: '#1A5276', wrap: true, align: 'center' },
              { type: 'text', text: 'กดแนบรูป → เลือกสลิปโอนเงิน', size: 'xs', color: '#888888', align: 'center', margin: 'sm', wrap: true },
            ],
          },
        ],
      },
    },
  };
}

function slipReceivedFlex(orderId) {
  return {
    type: 'flex',
    altText: `✅ รับสลิปออเดอร์ #${orderId} แล้ว!`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E8449',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '✅ รับสลิปแล้วครับ!', weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: `ออเดอร์ #${orderId}`, color: '#A9DFBF', size: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '⏳ รอร้านยืนยัน', weight: 'bold', size: 'md' },
          { type: 'text', text: 'ร้านจะยืนยันออเดอร์ภายใน 30 นาทีครับ\nขอบคุณที่ใช้บริการ 🙏', wrap: true, color: '#555555' },
        ],
      },
    },
  };
}

function orderConfirmedFlex(orderId) {
  return {
    type: 'flex',
    altText: `✅ ร้านยืนยันออเดอร์ #${orderId} แล้ว!`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E8449',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '✅ ยืนยันออเดอร์แล้ว!', weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: `#${orderId}`, color: '#A9DFBF', size: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '🚀 กำลังเตรียมสินค้า', weight: 'bold', size: 'md' },
          { type: 'text', text: 'ร้านได้รับออเดอร์และยืนยันแล้วครับ\nจะแจ้งเลขพัสดุเมื่อจัดส่ง 📮', wrap: true, color: '#555555' },
        ],
      },
    },
  };
}

function shippedFlex(orderId, trackingNo) {
  return {
    type: 'flex',
    altText: `📦 จัดส่งออเดอร์ #${orderId} แล้ว!`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#7D3C98',
        paddingAll: '16px',
        contents: [
          { type: 'text', text: '📦 จัดส่งแล้ว!', weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: `#${orderId}`, color: '#D7BDE2', size: 'sm' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          ...(trackingNo
            ? [
                { type: 'text', text: '🚚 เลขพัสดุ', color: '#555555', size: 'sm' },
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#F4ECF7',
                  paddingAll: '12px',
                  contents: [
                    { type: 'text', text: trackingNo, weight: 'bold', size: 'xl', align: 'center', color: '#7D3C98' },
                  ],
                },
              ]
            : []),
          {
            type: 'text',
            text: 'ขอบคุณที่อุดหนุนร้านหมูทุบแม่บัวเผื่อนครับ\nแวะมาอีกนะครับ 🙏😊',
            wrap: true,
            color: '#555555',
            margin: trackingNo ? 'md' : 'none',
          },
        ],
      },
    },
  };
}

function catalogFlex() {
  return {
    type: 'flex',
    altText: 'สินค้าร้านหมูทุบแม่บัวเผื่อน - แตะ สั่งเลย ได้เลยครับ',
    contents: {
      type: 'carousel',
      contents: CATALOG_ITEMS.map(item => ({
        type: 'bubble',
        hero: {
          type: 'image',
          url: item.imageUrl,
          size: 'full',
          aspectRatio: '20:13',
          aspectMode: 'cover',
          action: { type: 'message', label: 'สั่งเลย', text: item.name },
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: 'md',
          contents: [
            { type: 'text', text: item.name, weight: 'bold', size: 'sm', wrap: true, color: '#1a1a1a' },
            { type: 'text', text: `฿${item.price.toLocaleString()}`, size: 'lg', weight: 'bold', color: '#C0392B' },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: 'sm',
          contents: [{
            type: 'button',
            action: { type: 'message', label: 'สั่งเลย', text: item.name },
            style: 'primary',
            color: '#C0392B',
            height: 'sm',
          }],
        },
      })),
    },
  };
}

const STATUS_CONFIG = {
  'รอยืนยัน':         { color: '#E67E22', icon: '⏳', label: 'รอร้านยืนยัน',   canCancel: false },
  'กำลัง Packing':    { color: '#2980B9', icon: '📦', label: 'กำลัง Packing',  canCancel: false },
  'รออนุมัติยกเลิก':  { color: '#7F8C8D', icon: '🔄', label: 'รอร้านอนุมัติ',  canCancel: false },
  'จัดส่งแล้ว':       { color: '#7D3C98', icon: '🚚', label: 'จัดส่งแล้ว',     canCancel: false },
  'ยกเลิก':           { color: '#95A5A6', icon: '❌', label: 'ยกเลิกแล้ว',     canCancel: false },
};

function statusFlex(orderId, orderData) {
  const { status, total, items, trackingNo } = orderData;
  const cfg = STATUS_CONFIG[status] || { color: '#95A5A6', icon: '❓', label: status, canCancel: false };

  const itemRows = Array.isArray(items) ? items.map(i => ({
    type: 'box', layout: 'horizontal',
    contents: [
      { type: 'text', text: `• ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ''}`, size: 'sm', flex: 4, wrap: true, color: '#555555' },
      { type: 'text', text: `${i.price * i.qty} ฿`, size: 'sm', flex: 1, align: 'end', color: '#333333' },
    ],
  })) : [];

  return {
    type: 'flex',
    altText: `📦 สถานะออเดอร์ #${orderId}: ${cfg.label}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: cfg.color, paddingAll: '16px',
        contents: [
          { type: 'text', text: `${cfg.icon}  ${cfg.label}`, weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: `#${orderId}`, color: '#FFFFFF', size: 'xs', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          ...itemRows,
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: '💰 รวม', flex: 2, color: '#555555', weight: 'bold' },
              { type: 'text', text: `${total} บาท`, flex: 1, align: 'end', weight: 'bold', color: '#C0392B' },
            ],
          },
          ...(trackingNo ? [{
            type: 'box', layout: 'horizontal', margin: 'sm',
            contents: [
              { type: 'text', text: '🚚 เลขพัสดุ', flex: 2, color: '#555555', size: 'sm' },
              { type: 'text', text: trackingNo, flex: 2, align: 'end', weight: 'bold', color: '#7D3C98', wrap: true, size: 'sm' },
            ],
          }] : []),
        ],
      },
      ...((cfg.canCancel || trackingNo) ? {
        footer: {
          type: 'box', layout: 'vertical', spacing: 'sm',
          contents: [
            ...(trackingNo ? [{
              type: 'button',
              action: { type: 'uri', label: '🚚 ติดตามพัสดุ', uri: `https://track.thailandpost.co.th/?barcode=${trackingNo}` },
              style: 'primary',
              color: '#7D3C98',
            }] : []),
            ...(cfg.canCancel ? [{
              type: 'button',
              action: { type: 'message', label: '❌ ยกเลิกออเดอร์', text: 'ยกเลิกออเดอร์' },
              style: 'secondary',
              color: '#E74C3C',
            }] : []),
          ],
        },
      } : {}),
    },
  };
}

function cancelConfirmFlex(orderId, hasFee) {
  return {
    type: 'flex',
    altText: `⚠️ ยืนยันการยกเลิกออเดอร์ #${orderId}?`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#E74C3C', paddingAll: '16px',
        contents: [
          { type: 'text', text: '⚠️ ยืนยันการยกเลิก?', weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: `#${orderId}`, color: '#FFCCCC', size: 'xs', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          hasFee
            ? { type: 'text', text: '📦 ออเดอร์กำลัง Packing อยู่แล้วครับ\n\nหากยกเลิก ต้องชำระค่า Packing\nร้านจะติดต่อแจ้งยอดที่ต้องชำระครับ', wrap: true, color: '#C0392B', size: 'sm' }
            : { type: 'text', text: 'ยืนยันการยกเลิกออเดอร์ใช่ไหมครับ?\n\nร้านจะดำเนินการคืนเงินให้ครับ 🙏', wrap: true, color: '#555555', size: 'sm' },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: { type: 'message', label: hasFee ? '✅ ยืนยัน (มีค่า Packing)' : '✅ ยืนยันยกเลิก', text: 'ยืนยันยกเลิก' },
            style: 'primary',
            color: '#E74C3C',
          },
          {
            type: 'button',
            action: { type: 'message', label: '↩️ ไม่ยกเลิก', text: 'ไม่ยกเลิก' },
            style: 'secondary',
          },
        ],
      },
    },
  };
}

// Quick Reply helpers
function qr(items) {
  return {
    items: items.map(({ label, text }) => ({
      type: 'action',
      action: { type: 'message', label, text: text || label },
    })),
  };
}

const QR_START = qr([
  { label: '📜 ดูเมนู', text: 'เมนู' },
  { label: '🛒 สั่งสินค้า', text: 'สั่ง' },
]);

const QR_ORDERING = qr([
  { label: '📜 ดูเมนู', text: 'เมนู' },
  { label: '🛒 ดูตะกร้า', text: 'ตะกร้า' },
  { label: '✅ สั่งครบแล้ว', text: 'จบ' },
  { label: '❌ ยกเลิก', text: 'ยกเลิก' },
]);

const QR_CONFIRM = qr([
  { label: '✅ ยืนยัน', text: 'ยืนยัน' },
  { label: '❌ ยกเลิก', text: 'ยกเลิก' },
]);

const QR_CANCEL = qr([
  { label: '❌ ยกเลิก', text: 'ยกเลิก' },
]);

function adminQR(orderId) {
  return qr([{ label: '✅ ยืนยันออเดอร์', text: `ยืนยัน ${orderId}` }]);
}

const QR_MENU = qr([
  { label: '🛒 สั่งสินค้า', text: 'สั่ง' },
  { label: '📋 เมนูทั้งหมด', text: 'ดูเมนูทั้งหมด' },
]);

module.exports = {
  welcomeFlex,
  cartFlex,
  paymentFlex,
  slipReceivedFlex,
  orderConfirmedFlex,
  shippedFlex,
  statusFlex,
  cancelConfirmFlex,
  catalogFlex,
  QR_START,
  QR_ORDERING,
  QR_CONFIRM,
  QR_CANCEL,
  QR_MENU,
  adminQR,
};
