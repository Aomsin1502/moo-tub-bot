const PROMPTPAY = process.env.PROMPTPAY_NUMBER || '0931726399';
const { calcShipping } = require('./menu');

// ─── แคตตาล็อกสินค้า ────────────────────────────────────────────────────────
// รูปอยู่ที่ /public/images/ — serve ผ่าน https://moo-tub-bot.onrender.com/images/
const IMG = 'https://moo-tub-bot.onrender.com/images';
const _img = f => `${IMG}/${encodeURIComponent(f)}`;
const CATALOG_ITEMS = [
  { name: 'หมูทุบ 130g',        price: 100, imageUrl: _img('หมูทุบ 130 กรัม.jpg')        },
  { name: 'หมูทุบ 500g',        price: 350, imageUrl: _img('หมูทุบ 500 กรัม.jpg')        },
  { name: 'หมูแท่ง 130g',       price: 100, imageUrl: _img('หมูแท่ง 130 กรัม.jpg')       },
  { name: 'หมูแท่ง 500g',       price: 350, imageUrl: _img('หมูแท่ง 500 กรัม.jpg')       },
  { name: 'หมูหยอง 150g',       price: 100, imageUrl: _img('หมูหยอง 150 กรัม.jpg')       },
  { name: 'หมูฝอย 180g',        price: 100, imageUrl: _img('หมูฝอย 180 กรัม.jpg')        },
  { name: 'น้ำพริกหมูทุบ',      price: 50,  imageUrl: _img('น้ำพริกหมูทุบ.jpg')          },
  { name: 'น้ำพริกกากหมู 500g', price: 250, imageUrl: _img('น้ำพริกกากหมู 500 กรัม.jpg') },
];

function menuFlex() {
  const { MENU } = require('./menu');
  const rows = [];
  MENU.forEach(cat => {
    rows.push({
      type: 'box', layout: 'horizontal', margin: 'md',
      contents: [
        { type: 'text', text: cat.category, size: 'xs', weight: 'bold', color: '#C0392B', flex: 1 },
      ],
    });
    cat.items.forEach(item => {
      rows.push({
        type: 'box', layout: 'horizontal', paddingTop: 'xs',
        contents: [
          { type: 'text', text: `  ${item.name}`, size: 'xs', color: '#333333', flex: 4, wrap: true },
          { type: 'text', text: `${item.price}฿`, size: 'xs', color: '#C0392B', flex: 1, align: 'end', weight: 'bold' },
        ],
      });
    });
    rows.push({ type: 'separator', margin: 'sm' });
  });

  return {
    type: 'flex',
    altText: '🐷 ราคาสินค้า หมูทุบแม่บัวเผื่อน',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#C0392B', paddingAll: '16px',
        contents: [
          { type: 'text', text: '🐷 ราคาสินค้า', weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: 'หมูทุบแม่บัวเผื่อน • ชุมพร', color: '#FFD0CC', size: 'xs', margin: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'none', paddingAll: 'md',
        contents: rows,
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: 'md',
        contents: [{
          type: 'button',
          action: { type: 'uri', label: '🛒 สั่งสินค้าเลย', uri: 'https://liff.line.me/2010237396-QOmKN3ML' },
          style: 'primary', color: '#C0392B',
        }],
      },
    },
  };
}

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
          { type: 'text', text: 'สินค้าทำสดใหม่ทุกวัน จัดส่งทั่วไทย\nผ่าน ไปรษณีไทย / EMS', wrap: true, size: 'sm', color: '#555555' },
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
      paddingTop: 'sm',
      paddingBottom: 'sm',
      contents: [
        {
          type: 'box', layout: 'vertical', flex: 5, justifyContent: 'center',
          contents: [
            { type: 'text', text: item.name, size: 'sm', wrap: true, color: '#333333', weight: 'bold' },
            { type: 'text', text: `×${item.qty}   ${sub} ฿`, size: 'xs', color: '#C0392B', margin: 'xs' },
          ],
        },
        {
          type: 'box', layout: 'vertical', flex: 1, justifyContent: 'center', alignItems: 'center',
          action: { type: 'message', label: '+', text: `เพิ่ม ${item.name}` },
          contents: [
            { type: 'text', text: '+', size: 'md', align: 'center', color: '#27AE60', weight: 'bold' },
          ],
        },
        {
          type: 'box', layout: 'vertical', flex: 1, justifyContent: 'center', alignItems: 'center',
          action: { type: 'message', label: 'ลบ', text: `ลบ ${item.name}` },
          contents: [
            { type: 'text', text: '✕', size: 'sm', align: 'center', color: '#E74C3C', weight: 'bold' },
          ],
        },
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
              { type: 'text', text: '💰 รวมสินค้า', weight: 'bold', flex: 3 },
              { type: 'text', text: `${total} บาท`, weight: 'bold', color: '#C0392B', flex: 1, align: 'end', size: 'lg' },
            ],
          },
          (() => {
            const { totalWeight, fee } = calcShipping(cart);
            const kg = (totalWeight / 1000).toFixed(2).replace(/\.?0+$/, '');
            return {
              type: 'box', layout: 'horizontal', margin: 'xs',
              contents: [
                { type: 'text', text: `🚚 ค่าส่ง (~${kg} กก)`, flex: 3, size: 'sm', color: '#555555' },
                { type: 'text', text: `${fee} บาท`, flex: 1, align: 'end', size: 'sm', color: '#555555' },
              ],
            };
          })(),
          (() => {
            const { fee } = calcShipping(cart);
            return {
              type: 'box', layout: 'horizontal', margin: 'xs',
              contents: [
                { type: 'text', text: '💳 รวมจ่ายทั้งหมด', weight: 'bold', flex: 3, color: '#1A5276' },
                { type: 'text', text: `${total + fee} บาท`, weight: 'bold', flex: 1, align: 'end', size: 'lg', color: '#1A5276' },
              ],
            };
          })(),
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

function paymentFlex(orderId, total, cart = []) {
  const { totalWeight, fee } = calcShipping(cart);
  const grandTotal = total + fee;
  const kg = (totalWeight / 1000).toFixed(2).replace(/\.?0+$/, '');
  return {
    type: 'flex',
    altText: `💳 ชำระเงิน ออเดอร์ #${orderId} ยอดรวม ${grandTotal} บาท`,
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
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: '💰 ยอดสินค้า', flex: 2, color: '#555555' },
              { type: 'text', text: `${total} บาท`, flex: 1, align: 'end', weight: 'bold', color: '#C0392B', size: 'lg' },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: `🚚 ค่าส่ง (~${kg} กก)`, flex: 2, color: '#555555', size: 'sm' },
              { type: 'text', text: `${fee} บาท`, flex: 1, align: 'end', color: '#555555', size: 'sm' },
            ],
          },
          {
            type: 'box', layout: 'horizontal', backgroundColor: '#EBF5FB', paddingAll: '10px',
            contents: [
              { type: 'text', text: '💳 รวมโอน', flex: 2, weight: 'bold', color: '#1A5276' },
              { type: 'text', text: `${grandTotal} บาท`, flex: 1, align: 'end', weight: 'bold', color: '#1A5276', size: 'xl' },
            ],
          },
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
                    {
              type: 'text', text: `${trackingNo}  📋`, weight: 'bold', size: 'xl', align: 'center', color: '#7D3C98',
              action: { type: 'clipboard', label: 'คัดลอก', clipboardText: trackingNo },
            },
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

function qtyPickerFlex(item, qty) {
  const subtotal = item.price * qty;
  return {
    type: 'flex',
    altText: `${item.name} — เลือกจำนวน`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#C0392B', paddingAll: '16px',
        contents: [
          { type: 'text', text: item.name, weight: 'bold', color: '#FFFFFF', size: 'md', wrap: true },
          { type: 'text', text: `฿${item.price.toLocaleString()} / ชิ้น`, color: '#FFD0CC', size: 'sm', margin: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', paddingAll: 'xl', spacing: 'lg',
        contents: [
          {
            type: 'box', layout: 'horizontal', spacing: 'md',
            contents: [
              {
                type: 'button',
                action: { type: 'message', label: '−', text: `qty- ${item.name}` },
                style: 'secondary', height: 'sm', flex: 1,
              },
              {
                type: 'text', text: String(qty),
                size: 'xxl', weight: 'bold', align: 'center', gravity: 'center',
                color: '#1a1a1a', flex: 1,
              },
              {
                type: 'button',
                action: { type: 'message', label: '+', text: `qty+ ${item.name}` },
                style: 'primary', color: '#C0392B', height: 'sm', flex: 1,
              },
            ],
          },
          {
            type: 'text',
            text: `฿${subtotal.toLocaleString()}`,
            size: 'xl', weight: 'bold', align: 'center', color: '#C0392B',
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: 'md',
        contents: [{
          type: 'button',
          action: { type: 'message', label: '✅ เพิ่มลงตะกร้า', text: `ลงตะกร้า ${item.name}` },
          style: 'primary', color: '#27AE60',
        }],
      },
    },
  };
}

function catalogFlex() {
  return {
    type: 'flex',
    altText: 'สินค้าร้านหมูทุบแม่บัวเผื่อน - กดเลือกจำนวนได้เลยครับ',
    contents: {
      type: 'carousel',
      contents: CATALOG_ITEMS.map(item => ({
        type: 'bubble',
        hero: {
          type: 'image',
          url: item.imageUrl,
          size: 'full',
          aspectRatio: '1:1',
          aspectMode: 'cover',
          action: { type: 'message', label: '1 ชิ้น', text: `สั่ง 1 ${item.name}` },
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
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            contents: [
              { type: 'button', action: { type: 'message', label: '1 ชิ้น', text: `สั่ง 1 ${item.name}` }, flex: 1, style: 'secondary', height: 'sm' },
              { type: 'button', action: { type: 'message', label: '2 ชิ้น', text: `สั่ง 2 ${item.name}` }, flex: 1, style: 'secondary', height: 'sm' },
              { type: 'button', action: { type: 'message', label: '3 ชิ้น', text: `สั่ง 3 ${item.name}` }, flex: 1, style: 'primary', color: '#C0392B', height: 'sm' },
            ],
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
  const { status, trackingNo } = orderData;
  const cfg = STATUS_CONFIG[status] || { color: '#95A5A6', icon: '❓', label: status, canCancel: false };

  return {
    type: 'flex',
    altText: `📦 ออเดอร์ #${orderId} — ${cfg.label}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: cfg.color, paddingAll: '24px',
        contents: [
          { type: 'text', text: `${cfg.icon}  ${cfg.label}`, weight: 'bold', color: '#FFFFFF', size: 'xl', align: 'center' },
          { type: 'text', text: `#${orderId}`, color: '#FFFFFF', size: 'xs', align: 'center', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'xl',
        contents: trackingNo ? [
          { type: 'text', text: '📮 เลขพัสดุไปรษณีไทย', size: 'sm', color: '#888888', align: 'center' },
          {
            type: 'box', layout: 'vertical', backgroundColor: '#EBF5FB',
            paddingAll: '16px', cornerRadius: '8px', margin: 'sm',
            contents: [
              {
              type: 'text', text: `${trackingNo}  📋`, weight: 'bold', size: 'xxl', align: 'center', color: '#1A5276',
              action: { type: 'clipboard', label: 'คัดลอก', clipboardText: trackingNo },
            },
            ],
          },
          { type: 'text', text: 'กดปุ่มด้านล่างเพื่อติดตามพัสดุได้เลยครับ 📦', size: 'xs', color: '#888888', align: 'center', margin: 'sm', wrap: true },
        ] : [
          {
            type: 'text',
            text: '⏳ กำลังดำเนินการ\nร้านจะแจ้งเลขพัสดุ\nเมื่อจัดส่งครับ 🙏',
            wrap: true, color: '#555555', align: 'center', size: 'md',
          },
        ],
      },
      ...(trackingNo ? {
        footer: {
          type: 'box', layout: 'vertical', paddingAll: 'md',
          contents: [{
            type: 'button',
            action: { type: 'uri', label: '🚚 ติดตามพัสดุไปรษณีไทย', uri: `https://track.thailandpost.co.th/?barcode=${trackingNo}` },
            style: 'primary', color: '#C0392B',
          }],
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

function adminOrderFlex(orderId, cart, total, address, displayName) {
  const cartLines = cart.map(i => ({
    type: 'box', layout: 'horizontal', paddingTop: 'xs', paddingBottom: 'xs',
    contents: [
      { type: 'text', text: `• ${i.name}`, flex: 5, size: 'sm', wrap: true, color: '#333333' },
      { type: 'text', text: `×${i.qty}`, flex: 1, size: 'sm', align: 'center', color: '#555555' },
      { type: 'text', text: `${i.price * i.qty}฿`, flex: 2, size: 'sm', align: 'end', weight: 'bold', color: '#C0392B' },
    ],
  }));

  return {
    type: 'flex',
    altText: `🔔 ออเดอร์ใหม่! ${orderId} รวม ${total} บาท`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#E67E22', paddingAll: '16px',
        contents: [
          { type: 'text', text: '🔔 ออเดอร์ใหม่!', weight: 'bold', color: '#FFFFFF', size: 'xl' },
          { type: 'text', text: orderId, color: '#FDE8CC', size: 'xs', margin: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'xs',
        contents: [
          ...cartLines,
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: '💰 รวม', weight: 'bold', flex: 2 },
              { type: 'text', text: `${total} บาท`, weight: 'bold', color: '#C0392B', flex: 1, align: 'end', size: 'lg' },
            ],
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'vertical', margin: 'md', spacing: 'xs',
            contents: [
              { type: 'text', text: `👤 ${displayName}`, size: 'sm', color: '#333333' },
              { type: 'text', text: `📦 ${address}`, size: 'sm', color: '#555555', wrap: true },
            ],
          },
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: 'md',
        contents: [{
          type: 'button',
          action: { type: 'message', label: '✅ ยืนยันออเดอร์', text: `ยืนยัน ${orderId}` },
          style: 'primary', color: '#27AE60',
        }],
      },
    },
  };
}

function packingListFlex(orders) {
  if (orders.length === 0) {
    return {
      type: 'flex', altText: '📦 ไม่มีออเดอร์รอ Packing',
      contents: {
        type: 'bubble',
        body: { type: 'box', layout: 'vertical', paddingAll: 'xl',
          contents: [{ type: 'text', text: '✅ ไม่มีออเดอร์รอ Packing ครับ', align: 'center', color: '#888888' }] },
      },
    };
  }

  const { calcShipping } = require('./menu');

  const bubbles = orders.map(o => {
    const items = o.items || [];
    const { fee } = calcShipping(items);
    const itemsTotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const grandTotal = itemsTotal + fee;

    const itemRows = items.map(it => ({
      type: 'box', layout: 'horizontal', paddingTop: 'xs',
      contents: [
        { type: 'text', text: `• ${it.name}`, flex: 5, size: 'sm', color: '#333333', wrap: true },
        { type: 'text', text: `×${it.qty}`, flex: 1, size: 'sm', align: 'center', color: '#555555' },
        { type: 'text', text: `${it.price * it.qty}฿`, flex: 2, size: 'sm', align: 'end', weight: 'bold', color: '#C0392B' },
      ],
    }));

    return {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#E67E22', paddingAll: '14px',
        contents: [
          { type: 'text', text: o.orderId, size: 'xs', color: '#FDE8CC' },
          { type: 'text', text: o.displayName, weight: 'bold', color: '#FFFFFF', size: 'lg', margin: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'xs',
        contents: [
          { type: 'text', text: '🛍 รายการสินค้า', size: 'xs', weight: 'bold', color: '#888888' },
          ...itemRows,
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal', margin: 'sm',
            contents: [
              { type: 'text', text: 'ค่าสินค้า', flex: 3, size: 'xs', color: '#888888' },
              { type: 'text', text: `${itemsTotal}฿`, flex: 1, size: 'xs', align: 'end', color: '#555555' },
            ],
          },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ค่าส่ง', flex: 3, size: 'xs', color: '#888888' },
              { type: 'text', text: `${fee}฿`, flex: 1, size: 'xs', align: 'end', color: '#555555' },
            ],
          },
          {
            type: 'box', layout: 'horizontal', marginTop: 'xs',
            contents: [
              { type: 'text', text: '💰 รวมทั้งหมด', flex: 3, size: 'sm', weight: 'bold', color: '#1a1a1a' },
              { type: 'text', text: `${grandTotal}฿`, flex: 1, size: 'sm', weight: 'bold', align: 'end', color: '#C0392B' },
            ],
          },
          { type: 'separator', margin: 'md' },
          { type: 'text', text: '📍 ที่อยู่จัดส่ง', size: 'xs', weight: 'bold', color: '#888888', margin: 'sm' },
          { type: 'text', text: o.address || '-', size: 'sm', color: '#1A5276', wrap: true, margin: 'xs' },
        ],
      },
    };
  });

  return {
    type: 'flex',
    altText: `📦 Packing ${orders.length} ออเดอร์ — เลื่อนดูทีละรายการ`,
    contents: orders.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles },
  };
}

function pendingShipmentFlex(orders) {
  if (orders.length === 0) {
    return {
      type: 'flex',
      altText: '📋 ไม่มีออเดอร์รอจัดส่ง',
      contents: {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical', backgroundColor: '#7D3C98', paddingAll: '16px',
          contents: [{ type: 'text', text: '📋 รายการรอจัดส่ง', weight: 'bold', color: '#FFFFFF', size: 'lg' }],
        },
        body: {
          type: 'box', layout: 'vertical', paddingAll: 'xl',
          contents: [{ type: 'text', text: '✅ ไม่มีออเดอร์รอจัดส่งครับ', align: 'center', color: '#888888' }],
        },
      },
    };
  }

  const rows = [];
  orders.forEach((o, i) => {
    if (i > 0) rows.push({ type: 'separator', margin: 'md' });
    const addrLines = (o.address || '').split(/\n|โทร:|Tel:|เบอร์:/).map(s => s.trim()).filter(Boolean);
    const addrText  = addrLines[0] || '';
    const phoneText = addrLines.find(s => /^0\d{8,9}$/.test(s.replace(/\D/g,''))) || '';

    rows.push({
      type: 'box', layout: 'vertical', paddingTop: 'sm', paddingBottom: 'sm', spacing: 'xs',
      contents: [
        // หัว: ลำดับ + ชื่อ + ยอด
        {
          type: 'box', layout: 'horizontal',
          contents: [
            { type: 'text', text: `${i + 1}.`, flex: 0, size: 'sm', weight: 'bold', color: '#7D3C98' },
            { type: 'text', text: o.displayName, flex: 1, size: 'sm', weight: 'bold', color: '#1a1a1a', margin: 'sm' },
            { type: 'text', text: `${o.total}฿`, flex: 0, size: 'xs', color: '#C0392B', weight: 'bold', gravity: 'center' },
          ],
        },
        // ที่อยู่
        { type: 'text', text: `📦 ${o.address || '-'}`, size: 'xs', color: '#555555', margin: 'xs', wrap: true },
        // Order ID
        { type: 'text', text: o.orderId, size: 'xs', color: '#AAAAAA', margin: 'xs' },
      ],
    });
  });

  rows.push({ type: 'separator', margin: 'md' });
  rows.push({
    type: 'text',
    text: '📌 จัดเรียงสลิปตามลำดับด้านบน\nแล้วถ่ายรูปส่งได้เลยครับ',
    size: 'xs', color: '#888888', margin: 'md', wrap: true,
  });

  return {
    type: 'flex',
    altText: `📋 รายการรอจัดส่ง ${orders.length} ออเดอร์`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#7D3C98', paddingAll: '16px',
        contents: [
          { type: 'text', text: '📋 รายการรอจัดส่ง', weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: `${orders.length} ออเดอร์`, color: '#D7BDE2', size: 'xs' },
        ],
      },
      body: { type: 'box', layout: 'vertical', spacing: 'none', contents: rows },
    },
  };
}

function adminTrackingReviewFlex(pairs, unpairedTrackings, unpairedOrders, trackingList = []) {
  const bodyContents = [];

  // แสดง tracking list แบบมีหมายเลข (สำหรับเรียงลำดับใหม่)
  if (trackingList.length > 0) {
    bodyContents.push({ type: 'text', text: '📦 Tracking ที่อ่านได้:', size: 'xs', weight: 'bold', color: '#555555' });
    trackingList.forEach((t, i) => {
      bodyContents.push({
        type: 'box', layout: 'horizontal', paddingTop: 'xs',
        action: { type: 'clipboard', label: 'คัดลอก', clipboardText: t },
        contents: [
          { type: 'text', text: `${i + 1}.`, flex: 0, size: 'xs', color: '#7D3C98', weight: 'bold' },
          { type: 'text', text: `${t}  📋`, flex: 1, size: 'xs', color: '#7D3C98', weight: 'bold', margin: 'sm' },
        ],
      });
    });
    bodyContents.push({ type: 'separator', margin: 'md' });
  }

  // แสดงจับคู่ปัจจุบัน
  if (pairs.length > 0) {
    bodyContents.push({ type: 'text', text: '👤 จับคู่กับออเดอร์:', size: 'xs', weight: 'bold', color: '#555555', margin: 'sm' });
    pairs.forEach((pair, i) => {
      const letter = String.fromCharCode(65 + i); // A, B, C...
      const trackIdx = trackingList.indexOf(pair.trackingNo) + 1;
      const addrShort = (pair.address || '').slice(0, 35);
      bodyContents.push({
        type: 'box', layout: 'vertical', paddingTop: 'xs', paddingBottom: 'xs',
        contents: [
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: `${letter}.`, flex: 0, size: 'sm', weight: 'bold', color: '#27AE60' },
              { type: 'text', text: pair.displayName, flex: 3, size: 'sm', color: '#1a1a1a', margin: 'sm', weight: 'bold' },
              { type: 'text', text: `← #${trackIdx}`, flex: 1, size: 'xs', color: '#7D3C98', align: 'end', gravity: 'center' },
            ],
          },
          {
            type: 'text', text: addrShort, size: 'xs', color: '#888888',
            margin: 'xs', wrap: true,
          },
        ],
      });
    });
  }

  if (unpairedTrackings.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'sm' });
    bodyContents.push({ type: 'text', text: '❓ tracking เกิน:', size: 'xs', color: '#E74C3C' });
    unpairedTrackings.forEach(t => {
      bodyContents.push({ type: 'text', text: t, size: 'xs', color: '#E74C3C' });
    });
  }

  if (unpairedOrders.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'sm' });
    bodyContents.push({ type: 'text', text: '⚠️ ออเดอร์ไม่มี tracking:', size: 'xs', color: '#E67E22' });
    unpairedOrders.forEach(o => {
      bodyContents.push({ type: 'text', text: `${o.displayName}`, size: 'xs', color: '#E67E22' });
    });
  }

  // คำแนะนำเรียงลำดับใหม่
  if (trackingList.length > 1 && pairs.length > 0) {
    bodyContents.push({ type: 'separator', margin: 'md' });
    bodyContents.push({
      type: 'text',
      text: `ลำดับผิด? พิมพ์เลขใหม่ เช่น: 2 1 3\n(tracking ที่ไหนไปออเดอร์ A B C)`,
      size: 'xs', color: '#888888', wrap: true, margin: 'sm',
    });
  }

  return {
    type: 'flex',
    altText: `📋 ทบทวน ${pairs.length} รายการ — รอยืนยัน`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', backgroundColor: '#7D3C98', paddingAll: '16px',
        contents: [
          { type: 'text', text: '📋 ทบทวนก่อนยืนยัน', weight: 'bold', color: '#FFFFFF', size: 'lg' },
          { type: 'text', text: `${pairs.length} รายการ`, color: '#D7BDE2', size: 'xs' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'none',
        contents: bodyContents.length > 0 ? bodyContents : [
          { type: 'text', text: 'ไม่พบรายการที่จับคู่ได้', color: '#888888', align: 'center' },
        ],
      },
      ...(pairs.length > 0 ? {
        footer: {
          type: 'box', layout: 'vertical', paddingAll: 'md',
          contents: [{
            type: 'button',
            action: { type: 'message', label: `✅ ยืนยัน — แจ้งลูกค้า ${pairs.length} คน`, text: 'ยืนยัน tracking' },
            style: 'primary', color: '#27AE60',
          }],
        },
      } : {}),
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
  { label: '➕ สั่งเพิ่ม', text: 'เมนู' },
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

const QR_QTY = qr([
  { label: '1 ชิ้น', text: '1' },
  { label: '2 ชิ้น', text: '2' },
  { label: '3 ชิ้น', text: '3' },
  { label: '4 ชิ้น', text: '4' },
  { label: '5 ชิ้น', text: '5' },
]);

module.exports = {
  menuFlex,
  welcomeFlex,
  cartFlex,
  paymentFlex,
  slipReceivedFlex,
  orderConfirmedFlex,
  shippedFlex,
  statusFlex,
  cancelConfirmFlex,
  catalogFlex,
  qtyPickerFlex,
  adminOrderFlex,
  adminTrackingReviewFlex,
  pendingShipmentFlex,
  packingListFlex,
  QR_START,
  QR_ORDERING,
  QR_CONFIRM,
  QR_CANCEL,
  QR_MENU,
  QR_QTY,
  adminQR,
};
