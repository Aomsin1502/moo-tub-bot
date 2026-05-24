const { MENU, FLAT_ITEMS } = require('./menu');
const { appendOrder } = require('./sheetsService');
const {
  welcomeFlex, cartFlex, paymentFlex,
  slipReceivedFlex, orderConfirmedFlex, shippedFlex,
  QR_START, QR_ORDERING, QR_CONFIRM, QR_CANCEL, adminQR,
} = require('./messages');

const PROMPTPAY = process.env.PROMPTPAY_NUMBER || '0931726399';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '';

// userId -> { state, cart, orderId, displayName, address }
const userStates = {};
// orderId -> { userId, displayName, total, address }
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
  t += '❌ ไม่มีเก็บปลายทาง';
  return t;
}

function findItem(text) {
  const norm = text.toLowerCase().trim();
  for (const item of FLAT_ITEMS) {
    if (norm.includes(item.name.toLowerCase())) return item;
  }
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

function reply(client, replyToken, messages) {
  return client.replyMessage({ replyToken, messages: Array.isArray(messages) ? messages : [messages] });
}

async function handleMessage(event, client) {
  // ข้อความต้อนรับเมื่อผู้ใช้ follow OA
  if (event.type === 'follow') {
    try {
      await reply(client, event.replyToken, welcomeFlex());
    } catch (err) { console.error('Welcome error:', err.message); }
    return;
  }

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
      const total = state.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
      const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

      try {
        await appendOrder({
          orderId, displayName: state.displayName, userId,
          items: state.cart.map(i => `${i.name}x${i.qty}`).join(', '),
          total, address: state.address, status: 'รอยืนยัน', timestamp,
        });
      } catch (err) { console.error('Sheets error:', err.message); }

      // แจ้ง admin พร้อม Quick Reply ยืนยัน
      if (ADMIN_USER_ID) {
        const cartLines = state.cart.map(i => `• ${i.name}${i.qty > 1 ? ` x${i.qty}` : ''} = ${i.price * i.qty} บ.`).join('\n');
        try {
          await client.pushMessage({
            to: ADMIN_USER_ID,
            messages: [{
              type: 'text',
              text: `🔔 ออเดอร์ใหม่!\n══════════════\n${cartLines}\n══════════════\n💰 รวม: ${total} บาท\n📦 ที่อยู่: ${state.address}\n👤 ลูกค้า: ${state.displayName}\n🆔 ${orderId}\n\nพิมพ์ "จัดส่ง ${orderId} [เลขพัสดุ]" เมื่อส่ง`,
              quickReply: adminQR(orderId),
            }],
          });
        } catch (err) { console.error('Push admin error:', err.message); }
      }

      orderMap[orderId] = { userId, displayName: state.displayName, total, address: state.address };

      await reply(client, event.replyToken, slipReceivedFlex(orderId));
      resetState(userId);
      return;
    }

    await reply(client, event.replyToken, {
      type: 'text',
      text: '🐷 สวัสดีครับ!\nกด "สั่งสินค้า" หรือ "ดูเมนู" ได้เลยครับ 😊',
      quickReply: QR_START,
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
            messages: [orderConfirmedFlex(orderId)],
          });
        } catch (err) { console.error('Push customer error:', err.message); }
        await reply(client, event.replyToken, {
          type: 'text',
          text: `✅ ยืนยัน #${orderId}\nแจ้งลูกค้า "${order.displayName}" แล้วครับ`,
        });
      } else {
        await reply(client, event.replyToken, {
          type: 'text',
          text: `❌ ไม่พบออเดอร์ #${orderId}\n(server อาจ restart ไปแล้ว)`,
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
            messages: [shippedFlex(orderId, trackingNo)],
          });
        } catch (err) { console.error('Push customer error:', err.message); }
        await reply(client, event.replyToken, {
          type: 'text',
          text: `📦 แจ้งจัดส่ง #${orderId}\nลูกค้า "${order.displayName}" แล้วครับ`,
        });
      } else {
        await reply(client, event.replyToken, {
          type: 'text',
          text: `❌ ไม่พบออเดอร์ #${orderId}`,
        });
      }
      return;
    }
  }

  // รหัส LINE userId
  if (lower === 'รหัสของฉัน' || lower === 'myid') {
    await reply(client, event.replyToken, {
      type: 'text',
      text: `🆔 LINE User ID ของคุณ:\n${userId}`,
    });
    return;
  }

  // ดูเมนู
  if (['เมนู', 'menu', 'สินค้า', 'ดูเมนู'].includes(lower)) {
    await reply(client, event.replyToken, {
      type: 'text',
      text: getMenuText(),
      quickReply: QR_START,
    });
    return;
  }

  // ยกเลิก (ใช้ได้ทุก state)
  if (['ยกเลิก', 'cancel', 'ยกเลิกออเดอร์'].includes(lower)) {
    resetState(userId);
    await reply(client, event.replyToken, {
      type: 'text',
      text: '❌ ยกเลิกออเดอร์แล้วครับ\nสั่งใหม่ได้เลยนะครับ 😊',
      quickReply: QR_START,
    });
    return;
  }

  // ─── State machine ───────────────────────────────────────

  if (state.state === 'idle') {
    if (['สั่ง', 'order', 'ออเดอร์', 'สั่งซื้อ'].includes(lower)) {
      state.state = 'ordering';
      state.cart = [];
      await reply(client, event.replyToken, {
        type: 'text',
        text: '🛒 เริ่มสั่งสินค้าได้เลยครับ!\n\nพิมพ์ชื่อสินค้า เช่น:\n  หมูทุบ 500g\n  หมูสวรรค์ 350g x2\n  น้ำพริกหมูทุบ x3\n\nสั่งได้หลายรายการ กด "สั่งครบแล้ว" เมื่อเสร็จ',
        quickReply: QR_ORDERING,
      });
      return;
    }

    await reply(client, event.replyToken, {
      type: 'text',
      text: '🐷 สวัสดีครับ ร้านหมูทุบแม่บัวเผื่อน!\nกด "ดูเมนู" หรือ "สั่งสินค้า" ได้เลยครับ 😊',
      quickReply: QR_START,
    });
    return;
  }

  if (state.state === 'ordering') {
    if (['ตะกร้า', 'cart', 'ดูตะกร้า'].includes(lower)) {
      if (state.cart.length === 0) {
        await reply(client, event.replyToken, {
          type: 'text',
          text: '🛒 ยังไม่มีสินค้าในตะกร้าครับ\nพิมพ์ชื่อสินค้าที่ต้องการได้เลย',
          quickReply: QR_ORDERING,
        });
      } else {
        await reply(client, event.replyToken, [
          { ...cartFlex(state.cart, false), quickReply: QR_ORDERING },
        ]);
      }
      return;
    }

    if (['จบ', 'เสร็จ', 'สั่งครบ', 'done'].includes(lower)) {
      if (state.cart.length === 0) {
        await reply(client, event.replyToken, {
          type: 'text',
          text: '⚠️ ยังไม่มีสินค้าในตะกร้าครับ\nกรุณาเพิ่มสินค้าก่อนนะครับ',
          quickReply: QR_ORDERING,
        });
        return;
      }
      state.state = 'confirming';
      await reply(client, event.replyToken, cartFlex(state.cart, true));
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

    let replyText = '';
    if (added.length > 0) replyText += added.join('\n') + '\n\n';
    if (notFound.length > 0) replyText += `⚠️ ไม่พบสินค้า: ${notFound.join(', ')}\nลองพิมพ์ใหม่หรือกด "ดูเมนู"\n\n`;
    replyText += `🛒 ตะกร้า ${state.cart.length} รายการ\nกด "สั่งครบแล้ว" เมื่อสั่งครบ`;

    await reply(client, event.replyToken, {
      type: 'text',
      text: replyText,
      quickReply: QR_ORDERING,
    });
    return;
  }

  if (state.state === 'confirming') {
    if (['ยืนยัน', 'confirm', 'ok', 'โอเค', 'ตกลง'].includes(lower)) {
      state.state = 'waiting_address';
      await reply(client, event.replyToken, {
        type: 'text',
        text: '📦 กรุณาพิมพ์ที่อยู่จัดส่งครับ\n\nตัวอย่าง:\nชื่อ-สกุล: แม่มะลิ ใจดี\nที่อยู่: 123 ม.4 ต.บ้านใหม่ อ.เมือง จ.ชุมพร 86000\nโทร: 0812345678',
        quickReply: QR_CANCEL,
      });
      return;
    }
    await reply(client, event.replyToken, {
      type: 'text',
      text: 'กด "ยืนยัน" เพื่อดำเนินการต่อ หรือ "ยกเลิก" เพื่อยกเลิกครับ',
      quickReply: QR_CONFIRM,
    });
    return;
  }

  if (state.state === 'waiting_address') {
    state.address = text;
    state.orderId = generateOrderId();
    state.state = 'waiting_slip';
    const total = state.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    await reply(client, event.replyToken, [
      cartFlex(state.cart, false),
      paymentFlex(state.orderId, total),
    ]);
    return;
  }

  if (state.state === 'waiting_slip') {
    await reply(client, event.replyToken, {
      type: 'text',
      text: '⏳ รอสลิปการโอนเงินอยู่นะครับ\n📸 กรุณาส่งรูปสลิปหลังโอนเงิน 🙏',
      quickReply: QR_CANCEL,
    });
    return;
  }
}

module.exports = { handleMessage };
