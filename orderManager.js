const { MENU, FLAT_ITEMS } = require('./menu');
const { appendOrder } = require('./sheetsService');
const {
  welcomeFlex, cartFlex, paymentFlex,
  slipReceivedFlex, orderConfirmedFlex, shippedFlex,
  statusFlex, cancelConfirmFlex, catalogFlex,
  QR_START, QR_ORDERING, QR_CONFIRM, QR_CANCEL, QR_MENU, adminQR,
} = require('./messages');

const PROMPTPAY = process.env.PROMPTPAY_NUMBER || '0931726399';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '';

// userId → { state, cart, orderId, displayName, address, cancelPending }
const userStates = {};

// orderId → { userId, displayName, status, total, items, address, trackingNo }
// status: รอยืนยัน | กำลัง Packing | รออนุมัติยกเลิก | จัดส่งแล้ว | ยกเลิก
const orderStatus = {};

// userId → orderId (most recent placed order)
const userLastOrder = {};

function getState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = { state: 'idle', cart: [], orderId: null, displayName: '', address: '', cancelPending: null };
  }
  return userStates[userId];
}

function resetState(userId) {
  userStates[userId] = { state: 'idle', cart: [], orderId: null, displayName: '', address: '', cancelPending: null };
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

function send(client, replyToken, messages) {
  return client.replyMessage({ replyToken, messages: Array.isArray(messages) ? messages : [messages] });
}

async function handleMessage(event, client) {
  // ข้อความต้อนรับเมื่อ Follow OA
  if (event.type === 'follow') {
    try { await send(client, event.replyToken, welcomeFlex()); } catch (e) {}
    return;
  }

  if (event.type !== 'message') return;

  const userId = event.source.userId;
  const state = getState(userId);

  try {
    const profile = await client.getProfile(userId);
    state.displayName = profile.displayName;
  } catch (_) {}

  // ─── รับสลิป (รูปภาพ) ───────────────────────────────────────
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

      // บันทึกสถานะออเดอร์
      orderStatus[orderId] = {
        userId, displayName: state.displayName,
        status: 'รอยืนยัน', total,
        items: [...state.cart],
        address: state.address,
        trackingNo: '',
      };
      userLastOrder[userId] = orderId;

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

      await send(client, event.replyToken, slipReceivedFlex(orderId));
      resetState(userId);
      return;
    }

    await send(client, event.replyToken, {
      type: 'text',
      text: '🐷 สวัสดีครับ! กด "สั่งสินค้า" หรือ "ดูเมนู" ได้เลยครับ 😊',
      quickReply: QR_START,
    });
    return;
  }

  if (event.message.type !== 'text') return;
  const text = event.message.text.trim();
  const lower = text.toLowerCase();

  // ─── Admin commands ────────────────────────────────────────
  if (ADMIN_USER_ID && userId === ADMIN_USER_ID) {
    const confirmMatch = text.match(/^ยืนยัน\s+(ORD\S+)/i);
    const shippedMatch = text.match(/^จัดส่ง\s+(ORD\S+)(?:\s+(.+))?/i);
    const approvecancelMatch = text.match(/^อนุมัติยกเลิก\s+(ORD\S+)/i);

    if (confirmMatch) {
      const orderId = confirmMatch[1].toUpperCase();
      const order = orderStatus[orderId];
      if (order && order.status === 'รอยืนยัน') {
        order.status = 'กำลัง Packing';
        try {
          await client.pushMessage({ to: order.userId, messages: [orderConfirmedFlex(orderId)] });
        } catch (err) { console.error('Push customer error:', err.message); }
        await send(client, event.replyToken, {
          type: 'text',
          text: `✅ ยืนยัน #${orderId}\nสถานะ → กำลัง Packing\nแจ้งลูกค้า "${order.displayName}" แล้วครับ`,
        });
      } else if (order) {
        await send(client, event.replyToken, { type: 'text', text: `⚠️ #${orderId} สถานะปัจจุบัน: ${order.status}` });
      } else {
        await send(client, event.replyToken, { type: 'text', text: `❌ ไม่พบออเดอร์ #${orderId}` });
      }
      return;
    }

    if (shippedMatch) {
      const orderId = shippedMatch[1].toUpperCase();
      const trackingNo = shippedMatch[2] || '';
      const order = orderStatus[orderId];
      if (order) {
        order.status = 'จัดส่งแล้ว';
        order.trackingNo = trackingNo;
        try {
          await client.pushMessage({ to: order.userId, messages: [shippedFlex(orderId, trackingNo)] });
        } catch (err) { console.error('Push customer error:', err.message); }
        await send(client, event.replyToken, {
          type: 'text',
          text: `📦 แจ้งจัดส่ง #${orderId}\nลูกค้า "${order.displayName}" แล้วครับ`,
        });
      } else {
        await send(client, event.replyToken, { type: 'text', text: `❌ ไม่พบออเดอร์ #${orderId}` });
      }
      return;
    }

    if (approvecancelMatch) {
      const orderId = approvecancelMatch[1].toUpperCase();
      const order = orderStatus[orderId];
      if (order && order.status === 'รออนุมัติยกเลิก') {
        order.status = 'ยกเลิก';
        try {
          await client.pushMessage({
            to: order.userId,
            messages: [{
              type: 'text',
              text: `❌ ร้านอนุมัติยกเลิกออเดอร์ #${orderId} แล้วครับ\n📦 กรุณาชำระค่า Packing ตามที่ตกลง\nร้านจะดำเนินการให้ครับ 🙏`,
            }],
          });
        } catch (err) { console.error('Push customer error:', err.message); }
        await send(client, event.replyToken, {
          type: 'text',
          text: `✅ อนุมัติยกเลิก #${orderId}\nแจ้งลูกค้า "${order.displayName}" แล้วครับ`,
        });
      } else if (order) {
        await send(client, event.replyToken, { type: 'text', text: `⚠️ #${orderId} สถานะปัจจุบัน: ${order.status}` });
      } else {
        await send(client, event.replyToken, { type: 'text', text: `❌ ไม่พบออเดอร์ #${orderId}` });
      }
      return;
    }
  }

  // ─── รหัส LINE userId ────────────────────────────────────────
  if (lower === 'รหัสของฉัน' || lower === 'myid') {
    await send(client, event.replyToken, { type: 'text', text: `🆔 LINE User ID ของคุณ:\n${userId}` });
    return;
  }

  // ─── ทดสอบ Flex (diagnostic) ─────────────────────────────────
  if (lower === 'testflex') {
    console.log('🔬 testflex triggered by', userId);
    try {
      await send(client, event.replyToken, {
        type: 'flex',
        altText: 'TEST FLEX',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: 'Flex ทำงานได้!', weight: 'bold', size: 'xl', color: '#27AE60' },
              {
                type: 'image',
                url: 'https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png',
                size: 'full',
                aspectRatio: '20:13',
                aspectMode: 'cover',
              },
            ],
          },
        },
      });
      console.log('✅ testflex sent OK');
    } catch (err) {
      console.error('❌ testflex error:', JSON.stringify(err.response?.data || err.message));
      await send(client, event.replyToken, { type: 'text', text: `❌ Flex error: ${JSON.stringify(err.response?.data || err.message)}` });
    }
    return;
  }

  // ─── แคตตาล็อกรูปสินค้า ──────────────────────────────────────
  if (['เมนู', 'menu', 'สินค้า', 'ดูเมนู', 'แคตตาล็อก', 'catalog', 'รูปสินค้า'].includes(lower)) {
    try {
      await send(client, event.replyToken, [
        catalogFlex(),
        {
          type: 'text',
          text: '🐷 แตะ สั่งเลย ที่รูปสินค้าได้เลยครับ!\nหรือกด "เมนูทั้งหมด" เพื่อดูรายการแบบข้อความ',
          quickReply: QR_MENU,
        },
      ]);
    } catch (err) {
      console.error('❌ catalogFlex error:', err.response?.data || err.message);
      await send(client, event.replyToken, { type: 'text', text: getMenuText(), quickReply: QR_START });
    }
    return;
  }

  // ─── เมนูแบบข้อความ (ทุกรายการ) ─────────────────────────────
  if (['ดูเมนูทั้งหมด', 'เมนูทั้งหมด', 'รายการทั้งหมด'].includes(lower)) {
    await send(client, event.replyToken, { type: 'text', text: getMenuText(), quickReply: QR_START });
    return;
  }

  // ─── ติดต่อร้าน ──────────────────────────────────────────────
  if (['ติดต่อร้าน', 'ติดต่อ', 'โทร'].includes(lower)) {
    await send(client, event.replyToken, {
      type: 'flex',
      altText: '📞 ติดต่อร้านหมูทุบแม่บัวเผื่อน',
      contents: {
        type: 'bubble',
        header: {
          type: 'box', layout: 'vertical', backgroundColor: '#C0392B', paddingAll: '16px',
          contents: [{ type: 'text', text: '📞 ติดต่อร้าน', weight: 'bold', color: '#FFFFFF', size: 'lg' }],
        },
        body: {
          type: 'box', layout: 'vertical', spacing: 'md',
          contents: [
            { type: 'text', text: '🐷 ร้านหมูทุบแม่บัวเผื่อน', weight: 'bold', size: 'md' },
            { type: 'text', text: '📍 ชุมพร', size: 'sm', color: '#555555' },
            { type: 'separator', margin: 'md' },
            {
              type: 'box', layout: 'horizontal', margin: 'md',
              contents: [
                { type: 'text', text: '📱 โทร', flex: 1, color: '#555555', size: 'sm' },
                { type: 'text', text: `${PROMPTPAY}`, flex: 2, weight: 'bold', color: '#C0392B' },
              ],
            },
            { type: 'text', text: 'สั่งซื้อผ่าน LINE นี้ได้เลยครับ\nทีมงานพร้อมให้บริการครับ 😊', wrap: true, size: 'sm', color: '#555555', margin: 'md' },
          ],
        },
        footer: {
          type: 'box', layout: 'vertical',
          contents: [{
            type: 'button',
            action: { type: 'uri', label: '📞 โทรหาร้าน', uri: `tel:${PROMPTPAY}` },
            style: 'primary', color: '#C0392B',
          }],
        },
      },
    });
    return;
  }

  // ─── เช็กสถานะออเดอร์ ────────────────────────────────────────
  if (['สถานะ', 'เช็กสถานะ', 'ออเดอร์ของฉัน', 'เช็คสถานะ'].includes(lower)) {
    const lastOrderId = userLastOrder[userId];
    if (!lastOrderId || !orderStatus[lastOrderId]) {
      await send(client, event.replyToken, {
        type: 'text',
        text: '📦 ไม่พบออเดอร์ของคุณครับ\n(ข้อมูลจะหายถ้า server รีสตาร์ท)\nหากมีปัญหา กรุณาติดต่อร้านโดยตรงครับ',
        quickReply: QR_START,
      });
    } else {
      await send(client, event.replyToken, statusFlex(lastOrderId, orderStatus[lastOrderId]));
    }
    return;
  }

  // ─── ยืนยันยกเลิก ────────────────────────────────────────────
  if (lower === 'ยืนยันยกเลิก') {
    const cp = state.cancelPending;
    if (!cp) {
      await send(client, event.replyToken, { type: 'text', text: 'ไม่มีออเดอร์ที่รอยกเลิกอยู่ครับ', quickReply: QR_START });
      return;
    }
    const { orderId, hasFee } = cp;
    const order = orderStatus[orderId];
    state.cancelPending = null;

    if (!hasFee) {
      // ยกเลิกก่อน Packing — ยกเลิกได้เลย
      if (order) order.status = 'ยกเลิก';
      if (ADMIN_USER_ID) {
        try {
          await client.pushMessage({
            to: ADMIN_USER_ID,
            messages: [{ type: 'text', text: `🚨 ลูกค้า "${state.displayName}" ยกเลิกออเดอร์ #${orderId}\n💰 รวม: ${order ? order.total : '-'} บาท\n⚠️ กรุณาคืนเงินลูกค้าครับ` }],
          });
        } catch (err) {}
      }
      await send(client, event.replyToken, {
        type: 'text',
        text: `✅ ยกเลิกออเดอร์ #${orderId} แล้วครับ\nร้านจะดำเนินการคืนเงินให้ครับ 🙏`,
        quickReply: QR_START,
      });
    } else {
      // ยกเลิกระหว่าง Packing — ต้องรอ admin อนุมัติ
      if (order) order.status = 'รออนุมัติยกเลิก';
      if (ADMIN_USER_ID) {
        try {
          await client.pushMessage({
            to: ADMIN_USER_ID,
            messages: [{ type: 'text', text: `🚨 ลูกค้า "${state.displayName}" ขอยกเลิกออเดอร์ #${orderId}\n📦 ขณะกำลัง Packing — มีค่า Packing\n\nพิมพ์ "อนุมัติยกเลิก ${orderId}" เพื่ออนุมัติ` }],
          });
        } catch (err) {}
      }
      await send(client, event.replyToken, {
        type: 'text',
        text: `📨 ส่งคำขอยกเลิกออเดอร์ #${orderId} แล้วครับ\nรอร้านดำเนินการ — จะแจ้งยอดค่า Packing ให้ทราบครับ 🙏`,
        quickReply: QR_START,
      });
    }
    return;
  }

  // ─── ไม่ยกเลิก ───────────────────────────────────────────────
  if (lower === 'ไม่ยกเลิก') {
    state.cancelPending = null;
    await send(client, event.replyToken, {
      type: 'text',
      text: '👍 รับทราบครับ ออเดอร์ยังดำเนินอยู่ตามปกติครับ 😊',
      quickReply: QR_START,
    });
    return;
  }

  // ─── ยกเลิกออเดอร์ (post-order) ─────────────────────────────
  if (lower === 'ยกเลิกออเดอร์') {
    await send(client, event.replyToken, {
      type: 'text',
      text: '❌ ไม่สามารถยกเลิกได้ครับ\n\nเนื่องจากท่านชำระเงินแล้ว ทางร้านไม่รับยกเลิกออเดอร์หลังจากชำระเงินทุกกรณีครับ\n\nหากมีปัญหา กรุณาติดต่อร้านโดยตรงครับ 🙏',
      quickReply: QR_START,
    });
    return;
  }

  // ─── ยกเลิก (ยกเลิก flow การสั่ง) ───────────────────────────
  if (['ยกเลิก', 'cancel', 'ยกเลิกการสั่ง'].includes(lower)) {
    if (state.state !== 'idle') {
      resetState(userId);
      await send(client, event.replyToken, {
        type: 'text',
        text: '❌ ยกเลิกออเดอร์แล้วครับ\nสั่งใหม่ได้เลยนะครับ 😊',
        quickReply: QR_START,
      });
    } else {
      await send(client, event.replyToken, {
        type: 'text',
        text: '🛒 ไม่มีออเดอร์ที่กำลังสั่งอยู่ครับ\nกด "สั่งสินค้า" เพื่อเริ่มได้เลยครับ 😊',
        quickReply: QR_START,
      });
    }
    return;
  }

  // ─── State machine ────────────────────────────────────────────

  if (state.state === 'idle') {
    if (['สั่ง', 'order', 'ออเดอร์', 'สั่งซื้อ'].includes(lower)) {
      state.state = 'ordering';
      state.cart = [];
      await send(client, event.replyToken, {
        type: 'text',
        text: '🛒 เริ่มสั่งสินค้าได้เลยครับ!\n\nพิมพ์ชื่อสินค้า เช่น:\n  หมูทุบ 500g\n  หมูสวรรค์ 350g x2\n  น้ำพริกหมูทุบ x3\n\nสั่งได้หลายรายการ กด "สั่งครบแล้ว" เมื่อเสร็จ',
        quickReply: QR_ORDERING,
      });
      return;
    }

    // ─── สั่งจากแคตตาล็อก (tap 🛒 สั่งเลย ขณะ idle) ──────────
    const catalogItem = findItem(text);
    if (catalogItem) {
      state.state = 'ordering';
      state.cart = [{ ...catalogItem, qty: 1, subtotal: catalogItem.price }];
      await send(client, event.replyToken, {
        type: 'text',
        text: `✅ เพิ่ม "${catalogItem.name}" ลงตะกร้าแล้วครับ!\n💰 ${catalogItem.price} บาท\n\nสั่งเพิ่มได้ หรือกด "สั่งครบแล้ว" เพื่อดำเนินการต่อ`,
        quickReply: QR_ORDERING,
      });
      return;
    }

    await send(client, event.replyToken, {
      type: 'text',
      text: '🐷 สวัสดีครับ ร้านหมูทุบแม่บัวเผื่อน!\nกด "ดูเมนู" หรือ "สั่งสินค้า" ได้เลยครับ 😊',
      quickReply: QR_START,
    });
    return;
  }

  if (state.state === 'ordering') {
    if (['ตะกร้า', 'cart', 'ดูตะกร้า'].includes(lower)) {
      if (state.cart.length === 0) {
        await send(client, event.replyToken, {
          type: 'text',
          text: '🛒 ยังไม่มีสินค้าในตะกร้าครับ\nพิมพ์ชื่อสินค้าที่ต้องการได้เลย',
          quickReply: QR_ORDERING,
        });
      } else {
        await send(client, event.replyToken, { ...cartFlex(state.cart, false), quickReply: QR_ORDERING });
      }
      return;
    }

    if (['จบ', 'เสร็จ', 'สั่งครบ', 'done'].includes(lower)) {
      if (state.cart.length === 0) {
        await send(client, event.replyToken, {
          type: 'text',
          text: '⚠️ ยังไม่มีสินค้าในตะกร้าครับ กรุณาเพิ่มสินค้าก่อนนะครับ',
          quickReply: QR_ORDERING,
        });
        return;
      }
      state.state = 'confirming';
      await send(client, event.replyToken, cartFlex(state.cart, true));
      return;
    }

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

    await send(client, event.replyToken, { type: 'text', text: replyText, quickReply: QR_ORDERING });
    return;
  }

  if (state.state === 'confirming') {
    if (['ยืนยัน', 'confirm', 'ok', 'โอเค', 'ตกลง'].includes(lower)) {
      state.state = 'waiting_address';
      await send(client, event.replyToken, {
        type: 'text',
        text: '📦 กรุณาพิมพ์ที่อยู่จัดส่งครับ\n\nตัวอย่าง:\nชื่อ-สกุล: แม่มะลิ ใจดี\nที่อยู่: 123 ม.4 ต.บ้านใหม่ อ.เมือง จ.ชุมพร 86000\nโทร: 0812345678',
        quickReply: QR_CANCEL,
      });
      return;
    }
    await send(client, event.replyToken, {
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
    await send(client, event.replyToken, [
      cartFlex(state.cart, false),
      paymentFlex(state.orderId, total),
    ]);
    return;
  }

  if (state.state === 'waiting_slip') {
    await send(client, event.replyToken, {
      type: 'text',
      text: '⏳ รอสลิปการโอนเงินอยู่นะครับ\n📸 กรุณาส่งรูปสลิปหลังโอนเงิน 🙏',
      quickReply: QR_CANCEL,
    });
    return;
  }
}

module.exports = { handleMessage };
