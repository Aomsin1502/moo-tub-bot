const { MENU, FLAT_ITEMS } = require('./menu');
const { appendOrder } = require('./sheetsService');

const PROMPTPAY = process.env.PROMPTPAY_NUMBER || '0931726399';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '';

// userId -> { state, cart, orderId, displayName, address }
const userStates = {};
// orderId -> { userId, displayName, total, items, address }
const orderMap = {};

function getState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = { state: 'idle', cart: [], orderId: null, displayName: '', address: '' };
  }
  return userStates[userId];
}

function resetState(userId) {
  userStates[userId] = { state: 'idle', cart: [], orderId: null, displayName: '', address: '' };
}

function generateOrderId() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `ORD${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function getMenuText() {
  let t = '🏪 ร้านหมูทุบแม่บัวเผื่อน\n═══════════════════\n';
  MENU.forEach(cat => {
    t += `\n${cat.category}\n`;
    cat.items.forEach(item => { t += `  • ${item.name} = ${item.price} บ.\n`; });
  });
  t += '\n═══════════════════\n';
  t += '📮 จัดส่งทั่วไทย (ลูกค้าชำระค่าส่งเอง)\n';
  t += '❌ ไม่มีเก็บปลายทาง\n\n';
  t += '💬 พิมพ์ "สั่ง" เพื่อสั่งสินค้าครับ';
  return t;
}

function findItem(text) {
  const norm = text.toLowerCase().trim();
  for (const item of FLAT_ITEMS) {
    if (norm.includes(item.name.toLowerCase())) return item;
  }
  // partial match: all words must appear
  for (const item of FLAT_ITEMS) {
    const words = item.name.toLowerCase().split(' ');
    if (words.length >= 2 && words.every(w => norm.includes(w))) return item;
  }
  return null;
}

function parseOrderLine(line) {
  const qtyMatch = line.match(/[xX×*]\s*(\d+)\s*(?:ชิ้น|อัน|กล่อง|ถุง)?$/) ||
                   line.match(/\s+(\d+)\s*(?:ชิ้น|อัน|กล่อง|ถุง)$/);
  let qty = 1;
  let itemText = line.trim();
  if (qtyMatch) {
    qty = parseInt(qtyMatch[1]);
    itemText = line.slice(0, line.lastIndexOf(qtyMatch[0])).trim();
  }
  const item = findItem(itemText);
  if (item) return { ...item, qty, subtotal: item.price * qty };
  return null;
}

function getCartSummary(cart) {
  let t = '🛒 รายการสั่งซื้อ\n═══════════════════\n';
  let total = 0;
  cart.forEach((item, i) => {
    const sub = item.price * item.qty;
    total += sub;
    t += `${i + 1}. ${item.name}`;
    if (item.qty > 1) t += ` x${item.qty}`;
    t += ` = ${sub} บ.\n`;
  });
  t += `═══════════════════\n💰 รวม: ${total} บาท`;
  return { text: t, total };
}

function getPaymentText(orderId, total) {
  return `💳 ชำระเงิน ออเดอร์ #${orderId}\n═══════════════════\n💰 ยอดสินค้า: ${total} บาท\n⚠️  ค่าส่ง Kerry/Flash จะแจ้งแยกต่างหาก\n\nโอนผ่าน PromptPay:\n📱 ${PROMPTPAY}\n🏦 SCB (แม่บัวเผื่อน)\n\n📸 กรุณาส่งสลิปหลังโอนเงินครับ 🙏`;
}

async function handleMessage(event, client) {
  if (event.type !== 'message') return;
  const userId = event.source.userId;
  const state = getState(userId);

  try {
    const profile = await client.getProfile(userId);
    state.displayName = profile.displayName;
  } catch (_) {}

  // รับสลิป (รูปภาพ)
  if (event.message.type === 'image') {
    if (state.state === 'waiting_slip') {
      const orderId = state.orderId;
      const { text: cartText, total } = getCartSummary(state.cart);
      const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

      try {
        await appendOrder({
          orderId, displayName: state.displayName, userId,
          items: state.cart.map(i => `${i.name}x${i.qty}`).join(', '),
          total, address: state.address, status: 'รอยืนยัน', timestamp,
        });
      } catch (err) { console.error('Sheets error:', err.message); }

      // แจ้ง admin
      if (ADMIN_USER_ID) {
        try {
          await client.pushMessage({
            to: ADMIN_USER_ID,
            messages: [{
              type: 'text',
              text: `🔔 ออเดอร์ใหม่!\n${cartText}\n\n📦 ที่อยู่: ${state.address}\n👤 ลูกค้า: ${state.displayName}\n🆔 ${orderId}\n\nพิมพ์ "ยืนยัน ${orderId}" เพื่อยืนยัน\nพิมพ์ "จัดส่ง ${orderId} [เลขพัสดุ]" เมื่อส่ง`,
            }],
          });
        } catch (err) { console.error('Push admin error:', err.message); }
      }

      // เก็บ order ไว้สำหรับ admin push
      orderMap[orderId] = { userId, displayName: state.displayName, total, address: state.address };

      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `✅ รับสลิปแล้วครับ!\nออเดอร์ #${orderId}\n⏳ รอร้านยืนยันภายใน 30 นาที 🙏` }],
      });
      resetState(userId);
      return;
    }
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '🐷 สวัสดีครับ!\nพิมพ์ "สั่ง" เพื่อสั่งสินค้า หรือ "เมนู" เพื่อดูรายการครับ' }],
    });
    return;
  }

  if (event.message.type !== 'text') return;
  const text = event.message.text.trim();
  const lower = text.toLowerCase();

  // Admin commands
  if (ADMIN_USER_ID && userId === ADMIN_USER_ID) {
    const confirmMatch = text.match(/^ยืนยัน\s+(ORD\S+)/i);
    const shippedMatch = text.match(/^จัดส่ง\s+(ORD\S+)(?:\s+(.+))?/i);

    if (confirmMatch) {
      const orderId = confirmMatch[1].toUpperCase();
      const order = orderMap[orderId];
      if (order) {
        try {
          await client.pushMessage({
            to: order.userId,
            messages: [{ type: 'text', text: `✅ ร้านยืนยันออเดอร์ #${orderId} แล้วครับ!\n🚀 กำลังเตรียมสินค้า\n📮 จะแจ้งเลขพัสดุเมื่อจัดส่งครับ 🙏` }],
          });
        } catch (err) { console.error('Push customer error:', err.message); }
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: `✅ ยืนยัน #${orderId} แจ้งลูกค้า "${order.displayName}" แล้วครับ` }],
        });
      } else {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: `❌ ไม่พบออเดอร์ #${orderId} (server อาจ restart ไปแล้ว)` }],
        });
      }
      return;
    }

    if (shippedMatch) {
      const orderId = shippedMatch[1].toUpperCase();
      const trackingNo = shippedMatch[2] || '';
      const order = orderMap[orderId];
      if (order) {
        try {
          await client.pushMessage({
            to: order.userId,
            messages: [{
              type: 'text',
              text: `📦 จัดส่งออเดอร์ #${orderId} แล้วครับ!${trackingNo ? `\n🚚 เลขพัสดุ: ${trackingNo}` : ''}\nขอบคุณมากครับ 🙏`,
            }],
          });
        } catch (err) { console.error('Push customer error:', err.message); }
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: `📦 แจ้งจัดส่ง #${orderId} ลูกค้า "${order.displayName}" แล้วครับ` }],
        });
      } else {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: `❌ ไม่พบออเดอร์ #${orderId}` }],
        });
      }
      return;
    }
  }

  // รับรหัส LINE userId
  if (lower === 'รหัสของฉัน' || lower === 'myid') {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: `🆔 LINE User ID ของคุณ:\n${userId}` }],
    });
    return;
  }

  // คำสั่งทั่วไป
  if (['เมนู', 'menu', 'สินค้า', 'ดูเมนู'].includes(lower)) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: getMenuText() }],
    });
    return;
  }

  if (['ยกเลิก', 'cancel', 'ยกเลิกออเดอร์'].includes(lower)) {
    resetState(userId);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '❌ ยกเลิกออเดอร์แล้วครับ\nพิมพ์ "สั่ง" เพื่อเริ่มใหม่ หรือ "เมนู" เพื่อดูเมนูครับ 😊' }],
    });
    return;
  }

  // State machine
  if (state.state === 'idle') {
    if (['สั่ง', 'order', 'ออเดอร์', 'สั่งซื้อ'].includes(lower)) {
      state.state = 'ordering';
      state.cart = [];
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: '🛒 เริ่มสั่งสินค้าได้เลยครับ!\n\nพิมพ์ชื่อสินค้าที่ต้องการ เช่น:\n  หมูทุบ 500g\n  หมูสวรรค์ 350g x2\n  น้ำพริกหมูทุบ x3\n\n📋 พิมพ์ "จบ" เมื่อสั่งครบ\n🛒 พิมพ์ "ตะกร้า" เพื่อดูรายการ\n📜 พิมพ์ "เมนู" เพื่อดูรายการสินค้า\n❌ พิมพ์ "ยกเลิก" เพื่อยกเลิก',
        }],
      });
      return;
    }

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: 'text',
        text: '🐷 สวัสดีครับ ร้านหมูทุบแม่บัวเผื่อน!\n\n📜 พิมพ์ "เมนู" เพื่อดูรายการสินค้า\n🛒 พิมพ์ "สั่ง" เพื่อสั่งสินค้าครับ 😊',
      }],
    });
    return;
  }

  if (state.state === 'ordering') {
    if (['ตะกร้า', 'cart', 'ดูตะกร้า'].includes(lower)) {
      if (state.cart.length === 0) {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: '🛒 ยังไม่มีสินค้าในตะกร้าครับ' }],
        });
      } else {
        const { text: cartText } = getCartSummary(state.cart);
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: `${cartText}\n\nพิมพ์ "จบ" เพื่อดำเนินการต่อ` }],
        });
      }
      return;
    }

    if (['จบ', 'เสร็จ', 'สั่งครบ', 'done'].includes(lower)) {
      if (state.cart.length === 0) {
        await client.replyMessage({
          replyToken: event.replyToken,
          messages: [{ type: 'text', text: '⚠️ ยังไม่มีสินค้าในตะกร้าครับ กรุณาเพิ่มสินค้าก่อนนะครับ' }],
        });
        return;
      }
      state.state = 'confirming';
      const { text: cartText } = getCartSummary(state.cart);
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: `${cartText}\n\nพิมพ์ "ยืนยัน" เพื่อดำเนินการต่อ\nหรือ "ยกเลิก" เพื่อยกเลิก` }],
      });
      return;
    }

    // parse สินค้า
    const lines = text.split('\n').filter(l => l.trim());
    const added = [];
    const notFound = [];
    for (const line of lines) {
      const parsed = parseOrderLine(line.trim());
      if (parsed) {
        state.cart.push(parsed);
        added.push(`✅ ${parsed.name}${parsed.qty > 1 ? ` x${parsed.qty}` : ''} = ${parsed.subtotal} บ.`);
      } else {
        notFound.push(`"${line.trim()}"`);
      }
    }

    let reply = '';
    if (added.length > 0) reply += added.join('\n') + '\n\n';
    if (notFound.length > 0) reply += `⚠️ ไม่พบสินค้า: ${notFound.join(', ')}\nลองพิมพ์ใหม่หรือดูเมนูด้วย "เมนู"\n\n`;
    reply += `🛒 ตะกร้า ${state.cart.length} รายการ\nพิมพ์ "จบ" เมื่อสั่งครบ หรือ "ตะกร้า" เพื่อดูรายการ`;

    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: reply }],
    });
    return;
  }

  if (state.state === 'confirming') {
    if (['ยืนยัน', 'confirm', 'ok', 'โอเค', 'ตกลง'].includes(lower)) {
      state.state = 'waiting_address';
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{
          type: 'text',
          text: '📦 กรุณาส่งที่อยู่จัดส่งครับ\n\nตัวอย่าง:\nชื่อ-สกุล: แม่มะลิ ใจดี\nที่อยู่: 123 ม.4 ต.บ้านใหม่ อ.เมือง จ.ชุมพร 86000\nโทร: 0812345678',
        }],
      });
      return;
    }
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: 'พิมพ์ "ยืนยัน" เพื่อดำเนินการต่อ หรือ "ยกเลิก" เพื่อยกเลิกครับ' }],
    });
    return;
  }

  if (state.state === 'waiting_address') {
    state.address = text;
    state.orderId = generateOrderId();
    state.state = 'waiting_slip';
    const { text: cartText, total } = getCartSummary(state.cart);
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [
        { type: 'text', text: cartText },
        { type: 'text', text: getPaymentText(state.orderId, total) },
      ],
    });
    return;
  }

  if (state.state === 'waiting_slip') {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [{ type: 'text', text: '⏳ รอสลิปการโอนเงินอยู่นะครับ\n📸 กรุณาส่งรูปสลิปหลังโอนเงินครับ 🙏\n\nหรือพิมพ์ "ยกเลิก" เพื่อยกเลิก' }],
    });
    return;
  }
}

module.exports = { handleMessage };
