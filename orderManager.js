const { MENU, FLAT_ITEMS } = require('./menu');
const { appendOrder, updateOrderStatus, getPackingOrders, getOrdersByStatus, getOrdersByStatuses } = require('./sheetsService');
const { extractTrackingNumbers } = require('./visionService');
const {
  welcomeFlex, cartFlex, paymentFlex,
  slipReceivedFlex, orderConfirmedFlex, shippedFlex,
  menuFlex, statusFlex, cancelConfirmFlex, catalogFlex, qtyPickerFlex, adminOrderFlex, adminTrackingReviewFlex, pendingShipmentFlex, packingListFlex, pendingOrdersOverviewFlex,
  QR_START, QR_ORDERING, QR_CONFIRM, QR_CANCEL, QR_MENU, adminQR,
} = require('./messages');

const PROMPTPAY = process.env.PROMPTPAY_NUMBER || '0931726399';
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || '';

// userId → { state, cart, orderId, displayName, address, cancelPending }
const userStates = {};

// orderId → { userId, displayName, status, total, items, address, trackingNo }
// status: รอยืนยัน | กำลัง Packing | รอส่ง | รออนุมัติยกเลิก | จัดส่งแล้ว | ยกเลิก
const orderStatus = {};

// userId → orderId (most recent placed order)
const userLastOrder = {};

// เก็บ tracking pairs ที่ admin กำลังรอยืนยัน
// adminUserId → [{orderId, trackingNo, userId, displayName}]
const adminPendingMatches = {};

// queue สำหรับกรอก tracking ทีละรายการ
// adminUserId → { orders: [...], index: 0, results: [...] }
const adminTrackingQueue = {};

// เก็บ tracking list + order list สำหรับให้ admin เรียงลำดับใหม่
// adminUserId → { trackings: [...], orders: [...] }
const adminPendingData = {};

function getState(userId) {
  if (!userStates[userId]) {
    userStates[userId] = { state: 'idle', cart: [], orderId: null, displayName: '', address: '', name: '', addressLine: '', phone: '', cancelPending: null, pendingItem: null, pendingQty: 1, prevState: null };
  }
  return userStates[userId];
}

function resetState(userId) {
  userStates[userId] = { state: 'idle', cart: [], orderId: null, displayName: '', address: '', name: '', addressLine: '', phone: '', cancelPending: null, pendingItem: null, pendingQty: 1, prevState: null };
}

function isOpenNow() {
  const bkkHour = (new Date().getUTCHours() + 7) % 24;
  return bkkHour >= 8 && bkkHour < 20;
}

// วันหยุดนักขัตฤกษ์ไทย (MM-DD) — ปรับทุกปี
const THAI_HOLIDAYS = new Set([
  '01-01', // ขึ้นปีใหม่
  '04-06', // วันจักรี
  '04-13','04-14','04-15', // สงกรานต์
  '05-01', // วันแรงงาน
  '08-12', // วันแม่
  '10-13', // วันนวมินทร์มหาราช
  '10-23', // วันปิยมหาราช
  '12-05', // วันพ่อ / วันชาติ
  '12-10', // วันรัฐธรรมนูญ
  '12-31', // วันสิ้นปี
]);

function isHolidayDate(d) {
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return d.getUTCDay() === 0 || THAI_HOLIDAYS.has(`${mm}-${dd}`);
}

// คืนข้อความแจ้งลูกค้าถ้าวันนี้ไม่จัดส่ง
function getShippingNote() {
  const now  = new Date();
  const bkk  = new Date(now.getTime() + 7 * 60 * 60 * 1000); // UTC+7
  if (!isHolidayDate(bkk)) return ''; // วันทำงานปกติ

  const dayType = bkk.getUTCDay() === 0 ? 'วันอาทิตย์' : 'วันหยุดนักขัตฤกษ์';

  // หาวันทำการถัดไป
  const next = new Date(bkk);
  do { next.setUTCDate(next.getUTCDate() + 1); } while (isHolidayDate(next));

  const DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
  const nextStr = `วัน${DAYS[next.getUTCDay()]}ที่ ${next.getUTCDate()}/${next.getUTCMonth() + 1}`;

  return `\n\n📅 วันนี้${dayType} — ไม่มีการจัดส่ง\nออเดอร์จะจัดส่ง${nextStr} ครับ 🙏`;
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

function addToCart(state, item) {
  const existing = state.cart.find(i => i.name === item.name);
  if (existing) {
    existing.qty += 1;
    existing.subtotal = existing.price * existing.qty;
    return existing;
  }
  const newItem = { ...item, qty: 1, subtotal: item.price };
  state.cart.push(newItem);
  return newItem;
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

  // ─── รับรูปภาพ ──────────────────────────────────────────────
  if (event.message.type === 'image') {

    // Admin ส่งรูปสลิปไปรษณีไทย → OCR tracking numbers
    // (ข้ามถ้า admin กำลังสั่งของเอง = waiting_slip)
    if (ADMIN_USER_ID && userId === ADMIN_USER_ID && state.state !== 'waiting_slip') {
      await send(client, event.replyToken, {
        type: 'text', text: '🔍 กำลังอ่าน tracking...',
      });
      try {
        const { trackingNumbers, rawText, imageSize, statusCode } = await extractTrackingNumbers(event.message.id);

        if (trackingNumbers.length === 0) {
          const preview = rawText.slice(0, 300) || '(ไม่มีข้อความ)';
          const sizekb  = (imageSize / 1024).toFixed(1);
          await client.pushMessage({
            to: ADMIN_USER_ID,
            messages: [{
              type: 'text',
              text: `⚠️ อ่านเลข tracking ไม่พบครับ\n\n📊 debug:\n- HTTP: ${statusCode}\n- ขนาดรูป: ${sizekb} KB\n\nOCR อ่านได้:\n────────────\n${preview}\n────────────\nลองถ่ายใหม่ให้เห็นเลขชัดๆ ครับ`,
            }],
          });
          return;
        }

        // ดึง orders "รอส่ง" จาก Sheets (ไม่หายถ้า restart)
        const sheetPackingOrders = await getOrdersByStatus('รอส่ง');
        const pendingOrders = sheetPackingOrders
          .sort((a, b) => a.orderId.localeCompare(b.orderId))
          .map(o => ({ orderId: o.orderId, userId: o.userId, displayName: o.displayName, address: o.address, total: o.total }));

        // จับคู่ positional — ชื่อลูกค้ามาจากระบบ ไม่ใช่ OCR
        const pairs = [];
        trackingNumbers.forEach((trackingNo, i) => {
          if (i < pendingOrders.length) {
            const o = pendingOrders[i];
            pairs.push({ orderId: o.orderId, trackingNo, userId: o.userId, displayName: o.displayName, address: o.address || '' });
          }
        });
        const unpairedTrackings = trackingNumbers.slice(pendingOrders.length);
        const unpairedOrders    = pendingOrders.slice(trackingNumbers.length);

        adminPendingMatches[userId] = pairs;
        adminPendingData[userId] = { trackings: trackingNumbers, allOrders: pendingOrders };

        await client.pushMessage({
          to: ADMIN_USER_ID,
          messages: [adminTrackingReviewFlex(pairs, unpairedTrackings, unpairedOrders, trackingNumbers, pendingOrders)],
        });
      } catch (err) {
        console.error('[Admin OCR error]', err.message);
        await client.pushMessage({
          to: ADMIN_USER_ID,
          messages: [{ type: 'text', text: `❌ เกิดข้อผิดพลาด: ${err.message}` }],
        });
      }
      return;
    }

    // ลูกค้าส่งสลิปโอนเงิน
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

      // แจ้ง admin — Flex Message (ปุ่มอยู่ถาวร ไม่หายเมื่อเลื่อน)
      if (ADMIN_USER_ID) {
        try {
          await client.pushMessage({
            to: ADMIN_USER_ID,
            messages: [
              adminOrderFlex(orderId, state.cart, total, state.address, state.displayName),
              {
                type: 'text',
                text: `📝 จัดส่ง: พิมพ์\n"จัดส่ง ${orderId} [เลขพัสดุ]"`,
              },
            ],
          });
        } catch (err) { console.error('Push admin error:', err.message); }
      }

      const shipNote = getShippingNote();
      const msgs = [slipReceivedFlex(orderId)];
      if (shipNote) msgs.push({ type: 'text', text: `📅 แจ้งเพื่อทราบ${shipNote}` });
      await send(client, event.replyToken, msgs);
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

    // ล้างประวัติทั้งหมด (สำหรับทดสอบ)
    // ออเดอร์รอดำเนินการทั้งหมด (รอยืนยัน + กำลัง Packing + รอส่ง)
    if (['ออเดอร์', 'orders', 'listorder', 'รายการออเดอร์', 'ดูออเดอร์'].includes(lower)) {
      await send(client, event.replyToken, { type: 'text', text: '⏳ กำลังดึงข้อมูล...' });
      getOrdersByStatuses(['รอยืนยัน', 'กำลัง Packing', 'รอส่ง']).then(orders => {
        if (orders.length === 0) {
          return client.pushMessage({ to: userId, messages: [{ type: 'text', text: '✅ ไม่มีออเดอร์รอดำเนินการครับ' }] });
        }
        const ICONS = { 'รอยืนยัน': '⏳', 'กำลัง Packing': '📦', 'รอส่ง': '📫' };
        const byStatus = {};
        orders.forEach(o => { if (!byStatus[o.status]) byStatus[o.status] = []; byStatus[o.status].push(o); });
        let text = `📋 ออเดอร์รอดำเนินการ (${orders.length} รายการ)\n`;
        ['รอยืนยัน', 'กำลัง Packing', 'รอส่ง'].forEach(s => {
          const list = byStatus[s] || [];
          if (!list.length) return;
          text += `\n${ICONS[s]} ${s} (${list.length})\n`;
          list.forEach(o => { text += `  • ${o.displayName}  ${o.total}฿\n`; });
        });
        return client.pushMessage({ to: userId, messages: [{ type: 'text', text: text.trim() }] });
      }).catch(err => {
        console.error('[orders]', err.message);
        client.pushMessage({ to: userId, messages: [{ type: 'text', text: `❌ error: ${err.message}` }] });
      });
      return;
    }

    // พร้อมส่ง ORD... → เปลี่ยนสถานะ "รอส่ง"
    const readyMatch = text.match(/^พร้อมส่ง\s+(ORD\S+)/i);
    if (readyMatch) {
      const orderId = readyMatch[1].toUpperCase();
      await updateOrderStatus(orderId, 'รอส่ง');
      if (orderStatus[orderId]) orderStatus[orderId].status = 'รอส่ง';
      await send(client, event.replyToken, {
        type: 'text',
        text: `✅ ${orderId}\nสถานะ → 📫 รอส่งไปรษณีย์แล้วครับ`,
      });
      return;
    }

    if (['ล้างประวัติ', 'ล้างข้อมูล', 'reset'].includes(lower)) {
      Object.keys(orderStatus).forEach(k => delete orderStatus[k]);
      Object.keys(userStates).forEach(k => delete userStates[k]);
      Object.keys(userLastOrder).forEach(k => delete userLastOrder[k]);
      Object.keys(adminPendingMatches).forEach(k => delete adminPendingMatches[k]);
      Object.keys(adminPendingData).forEach(k => delete adminPendingData[k]);
      Object.keys(adminTrackingQueue).forEach(k => delete adminTrackingQueue[k]);
      await send(client, event.replyToken, {
        type: 'text', text: '🗑 ล้างประวัติเรียบร้อยครับ\nออเดอร์และสถานะทั้งหมดถูกล้างแล้ว',
      });
      return;
    }

    // ดูรายการ Packing — อ่านจาก Sheets
    if (['packing', 'แพ็ค', 'แพ็คของ', 'จัดของ', 'ดูpacking'].includes(lower)) {
      // ตอบทันทีก่อน (replyToken timeout 1 นาที)
      await send(client, event.replyToken, { type: 'text', text: '⏳ กำลังดึงข้อมูล Packing...' });
      // แล้วค่อย push ผลลัพธ์ (ไม่ขึ้นกับ replyToken)
      getPackingOrders().then(sheetOrders => {
        if (sheetOrders.length === 0) {
          return client.pushMessage({ to: userId, messages: [{ type: 'text', text: '✅ ไม่มีออเดอร์รอ Packing ครับ' }] });
        }
        const { FLAT_ITEMS } = require('./menu');
        const orders = sheetOrders.map(o => {
          const items = (o.itemsStr || '').split(',').map(s => {
            const m = s.trim().match(/^(.+?)x(\d+)$/i);
            if (!m) return { name: s.trim(), price: 0, qty: 1, subtotal: 0, weight: 0 };
            const name = m[1].trim();
            const qty  = parseInt(m[2]) || 1;
            const found = FLAT_ITEMS.find(fi => fi.name === name);
            const price = found ? found.price : 0;
            return { name, price, qty, subtotal: price * qty, weight: found ? (found.weight || 0) : 0 };
          });
          return { orderId: o.orderId, displayName: o.displayName, items, total: o.total, address: o.address };
        });
        // ส่ง itemsStr ไปด้วยเผื่อ items parse ไม่ได้
        const enriched = orders.map((o, idx) => ({ ...o, itemsStr: sheetOrders[idx]?.itemsStr || '' }));
        return client.pushMessage({ to: userId, messages: [packingListFlex(enriched)] });
      }).catch(err => {
        console.error('[packing] error:', err.message);
        client.pushMessage({ to: userId, messages: [{ type: 'text', text: `❌ packing error: ${err.message}` }] });
      });
      return;
    }

    // รายการรอจัดส่ง → เริ่ม sequential tracking entry (อ่านจาก Sheets)
    if (['รายการส่ง', 'รายการจัดส่ง', 'ค้างส่ง'].includes(lower)) {
      await send(client, event.replyToken, { type: 'text', text: '⏳ กำลังดึงรายการจาก Sheets...' });
      const sheetPending = await getOrdersByStatus('รอส่ง');
      const pending = sheetPending
        .sort((a, b) => a.orderId.localeCompare(b.orderId))
        .map(o => ({ orderId: o.orderId, displayName: o.displayName, total: o.total, userId: o.userId, address: o.address || '' }));

      if (pending.length === 0) {
        await client.pushMessage({ to: userId, messages: [{ type: 'text', text: '✅ ไม่มีออเดอร์รอจัดส่งครับ' }] });
        return;
      }

      adminTrackingQueue[userId] = { orders: pending, index: 0, results: [] };
      const first = pending[0];
      await client.pushMessage({
        to: userId,
        messages: [
          pendingShipmentFlex(pending),
          { type: 'text', text: `กรอก tracking ทีละรายการครับ 👇\n\n📦 1/${pending.length} — ${first.displayName}\nพิมพ์เลข tracking:` },
        ],
      });
      return;
    }

    // กำลังกรอก tracking queue ทีละรายการ
    const queue = adminTrackingQueue[userId];
    if (queue && queue.index < queue.orders.length) {
      const cur = queue.orders[queue.index];
      const total = queue.orders.length;

      const trackingInput = text.trim().replace(/\s+/g, '').toUpperCase();
      if (!/^[A-Z]{2}\d{8,11}[A-Z]{2}$/.test(trackingInput)) {
        await send(client, event.replyToken, {
          type: 'text',
          text: `⚠️ กรุณากรอกเลข tracking ให้ถูกต้องครับ\nเช่น: EF123456789TH\n\n📦 ${queue.index + 1}/${total} — ${cur.displayName}\nพิมพ์เลข tracking:`,
        });
        return;
      }

      queue.results.push({ orderId: cur.orderId, trackingNo: trackingInput, userId: cur.userId, displayName: cur.displayName });
      queue.index++;

      if (queue.index >= total) {
        adminPendingMatches[userId] = queue.results;
        delete adminTrackingQueue[userId];
        await send(client, event.replyToken, adminTrackingReviewFlex(queue.results, [], []));
      } else {
        const next = queue.orders[queue.index];
        await send(client, event.replyToken, {
          type: 'text',
          text: `✅ ${trackingInput} → ${cur.displayName}\n\n📦 ${queue.index + 1}/${total} — ${next.displayName}\nพิมพ์เลข tracking:`,
        });
      }
      return;
    }

    // เรียงลำดับใหม่ — admin พิมพ์ "2 1 3" เพื่อสลับ tracking
    // ─── Letter-based tracking assignment: "D B F" ──────────────
    if (/^[A-Za-z](\s+[A-Za-z])*$/.test(text.trim()) && adminPendingData[userId]) {
      const allOrders = adminPendingData[userId].allOrders || adminPendingData[userId].orders || [];
      const trackings  = adminPendingData[userId].trackings || [];

      if (!allOrders.length || !trackings.length) {
        await send(client, event.replyToken, { type: 'text', text: '⚠️ ข้อมูลหมดอายุ กรุณาส่งรูปใบเสร็จใหม่ครับ' });
        return;
      }

      const letters   = text.trim().toUpperCase().split(/\s+/);
      const maxIdx    = allOrders.length;
      const maxLetter = String.fromCharCode(64 + maxIdx);

      if (letters.length !== trackings.length) {
        await send(client, event.replyToken, {
          type: 'text',
          text: `⚠️ ต้องพิมพ์ ${trackings.length} ตัวอักษร\nเช่น: ${Array.from({length: trackings.length}, (_, i) => String.fromCharCode(65+i)).join(' ')}`,
        });
        return;
      }

      const invalidL = letters.filter(l => l.charCodeAt(0) < 65 || l.charCodeAt(0) > 64 + maxIdx);
      if (invalidL.length > 0) {
        await send(client, event.replyToken, {
          type: 'text',
          text: `⚠️ ตัวอักษร "${invalidL.join(', ')}" ไม่ถูกต้อง\nใช้ได้ A–${maxLetter} เท่านั้นครับ`,
        });
        return;
      }

      if (new Set(letters).size !== letters.length) {
        await send(client, event.replyToken, { type: 'text', text: '⚠️ ตัวอักษรซ้ำกัน ใช้แต่ละตัวครั้งเดียวครับ' });
        return;
      }

      const letterMap = {};
      allOrders.forEach((o, i) => { letterMap[String.fromCharCode(65 + i)] = o; });

      const newPairs = letters.map((letter, i) => {
        const o = letterMap[letter];
        return { orderId: o.orderId, trackingNo: trackings[i], userId: o.userId, displayName: o.displayName, address: o.address || '' };
      });
      const usedSet    = new Set(letters);
      const newUnpaired = allOrders.filter((_, i) => !usedSet.has(String.fromCharCode(65 + i)));

      adminPendingMatches[userId] = newPairs;
      adminPendingData[userId].allOrders = allOrders;
      await send(client, event.replyToken, adminTrackingReviewFlex(newPairs, [], newUnpaired, trackings, allOrders));
      return;
    }

    // ยืนยัน tracking batch (หลัง OCR review)
    if (lower === 'ยืนยัน tracking') {
      const matches = adminPendingMatches[userId];
      if (!matches || matches.length === 0) {
        await send(client, event.replyToken, { type: 'text', text: '⚠️ ไม่มี tracking รอยืนยันครับ\nกรุณาส่งรูปสลิปไปรษณีไทยก่อนครับ' });
        return;
      }
      let successCount = 0;
      for (const match of matches) {
        // อัปเดต Sheets โดยตรง — ไม่ต้องง้อ in-memory orderStatus
        updateOrderStatus(match.orderId, 'จัดส่งแล้ว', match.trackingNo)
          .catch(e => console.error('Sheets ship error:', e.message));
        // อัปเดต memory ถ้ามี
        if (orderStatus[match.orderId]) {
          orderStatus[match.orderId].status = 'จัดส่งแล้ว';
          orderStatus[match.orderId].trackingNo = match.trackingNo;
        }
        // push ลูกค้า
        if (match.userId) {
          try {
            await client.pushMessage({ to: match.userId, messages: [shippedFlex(match.orderId, match.trackingNo)] });
            successCount++;
          } catch (err) { console.error('Push customer error:', err.message); }
        }
      }
      delete adminPendingMatches[userId];
      delete adminPendingData[userId];
      await send(client, event.replyToken, {
        type: 'text',
        text: `✅ แจ้งลูกค้าแล้ว ${successCount} คน\n📋 อัปเดต Sheets เรียบร้อยครับ`,
      });
      return;
    }

    const confirmMatch = text.match(/^ยืนยัน\s+(ORD\S+)/i);
    const shippedMatch = text.match(/^จัดส่ง\s+(ORD\S+)(?:\s+(.+))?/i);
    const approvecancelMatch = text.match(/^อนุมัติยกเลิก\s+(ORD\S+)/i);

    if (confirmMatch) {
      const orderId = confirmMatch[1].toUpperCase();
      const order = orderStatus[orderId];
      if (order && order.status === 'รอยืนยัน') {
        order.status = 'กำลัง Packing';
        updateOrderStatus(orderId, 'กำลัง Packing').catch(e => console.error('Sheets confirm error:', e.message));
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
        updateOrderStatus(orderId, 'จัดส่งแล้ว', trackingNo).catch(e => console.error('Sheets ship error:', e.message));
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

  // ─── แคตตาล็อกรูปสินค้า ──────────────────────────────────────
  if (['เมนู', 'menu', 'สินค้า', 'ดูเมนู', 'แคตตาล็อก', 'catalog', 'รูปสินค้า'].includes(lower)) {
    await send(client, event.replyToken, menuFlex());
    return;
  }

  // ─── เมนูแบบข้อความ (ทุกรายการ) ─────────────────────────────
  if (['ดูเมนูทั้งหมด', 'เมนูทั้งหมด', 'รายการทั้งหมด'].includes(lower)) {
    await send(client, event.replyToken, { type: 'text', text: getMenuText(), quickReply: QR_START });
    return;
  }

  // ─── โปรโมชั่น ───────────────────────────────────────────────
  if (['โปรโมชั่น', 'promotion', 'โปร'].includes(lower)) {
    await send(client, event.replyToken, {
      type: 'text',
      text: '🎁 ขณะนี้ยังไม่มีโปรโมชั่นพิเศษครับ\n\nติดตามข่าวสารได้ทาง LINE นี้เลยครับ 😊',
    });
    return;
  }

  // ─── สินค้าแนะนำ ─────────────────────────────────────────────
  if (['สินค้าแนะนำ', 'แนะนำ', 'ขายดี'].includes(lower)) {
    await send(client, event.replyToken, {
      type: 'text',
      text: '⭐ สินค้าแนะนำของร้าน\n\n🐷 หมูทุบ — สูตรต้นตำรับ\n🐷 หมูสวรรค์ — ขายดีอันดับ 1\n🌶️ น้ำพริกกากหมู — รสเด็ดประจำร้าน\n\nกด "สั่งสินค้า" เพื่อเลือกสินค้าได้เลยครับ 🛒',
    });
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
      // ยกเลิกระหว่าง Packing / รอส่ง — ต้องรอ admin อนุมัติ
      if (order) order.status = 'รออนุมัติยกเลิก';
      const statusLabel = order?.status === 'รอส่ง' ? 'รอส่งไปรษณีย์' : 'กำลัง Packing';
      if (ADMIN_USER_ID) {
        try {
          await client.pushMessage({
            to: ADMIN_USER_ID,
            messages: [{ type: 'text', text: `🚨 ลูกค้า "${state.displayName}" ขอยกเลิกออเดอร์ #${orderId}\n📦 ขณะ${statusLabel} — มีค่า Packing\n\nพิมพ์ "อนุมัติยกเลิก ${orderId}" เพื่ออนุมัติ` }],
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

  // ─── สั่ง N ชิ้น (จาก catalog buttons) ──────────────────────────
  const orderQtyMatch = text.match(/^สั่ง\s+(\d+)\s+(.+)$/);
  if (orderQtyMatch && (state.state === 'idle' || state.state === 'ordering')) {
    const qty = Math.min(parseInt(orderQtyMatch[1]), 20);
    const itemName = orderQtyMatch[2].trim();
    const item = findItem(itemName);
    if (item && qty >= 1) {
      if (state.state === 'idle') {
        state.state = 'ordering';
        state.cart = [];
      }
      for (let i = 0; i < qty; i++) {
        addToCart(state, item);
      }
      const cartItem = state.cart.find(i => i.name === item.name);
      const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
      await send(client, event.replyToken, {
        type: 'text',
        text: `✅ ${item.name} ×${cartItem.qty}  (${cartItem.subtotal} บาท)\n🛒 รวม ${total} บาท\n\nกด ➕ สั่งเพิ่ม หรือ ✅ สั่งครบแล้ว`,
        quickReply: QR_ORDERING,
      });
      return;
    }
  }

  // ─── State machine ────────────────────────────────────────────

  if (state.state === 'idle') {
    if (['สั่ง', 'order', 'ออเดอร์', 'สั่งซื้อ'].includes(lower)) {
      state.state = 'ordering';
      state.cart = [];
      const offHoursNote = !isOpenNow()
        ? '\n\n⏰ ขณะนี้นอกเวลาทำการ (08:00–20:00 น.)\nร้านจะดำเนินการในวันทำการถัดไปครับ 🙏'
        : '';
      const holidayNote = getShippingNote();
      try {
        await send(client, event.replyToken, [
          catalogFlex(),
          { type: 'text', text: `🛒 กด 1 / 2 / 3 ชิ้น ที่สินค้าที่ต้องการครับ!${offHoursNote}${holidayNote}`, quickReply: QR_ORDERING },
        ]);
      } catch (err) {
        console.error('catalogFlex error:', err.message);
        await send(client, event.replyToken, { type: 'text', text: getMenuText(), quickReply: QR_ORDERING });
      }
      return;
    }

    // ─── กด สั่งเลย (idle) → เพิ่มทันที ────────────────────────
    const catalogItem = findItem(text);
    if (catalogItem) {
      state.state = 'ordering';
      const added = addToCart(state, catalogItem);
      const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
      await send(client, event.replyToken, {
        type: 'text',
        text: `✅ ${catalogItem.name} ×${added.qty}  (${added.subtotal} บาท)\n🛒 รวม ${total} บาท\n\nกด ➕ สั่งเพิ่ม หรือ ✅ สั่งครบแล้ว`,
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

  if (state.state === 'ordering' || state.state === 'confirming') {
    if (lower.startsWith('ลบ ')) {
      const itemName = text.slice(3).trim();
      const idx = state.cart.findIndex(i => i.name.toLowerCase() === itemName.toLowerCase());
      if (idx !== -1) {
        const removed = state.cart[idx];
        state.cart.splice(idx, 1);
        state.state = 'ordering';
        if (state.cart.length === 0) {
          try {
            await send(client, event.replyToken, [
              catalogFlex(),
              { type: 'text', text: `🗑 ลบ "${removed.name}" แล้วครับ\n\n🛒 ตะกร้าว่างแล้ว — เลือกสินค้าได้เลย!`, quickReply: QR_ORDERING },
            ]);
          } catch (_) {
            await send(client, event.replyToken, { type: 'text', text: `🗑 ลบ "${removed.name}" แล้วครับ\nตะกร้าว่างแล้ว`, quickReply: QR_ORDERING });
          }
        } else {
          await send(client, event.replyToken, { ...cartFlex(state.cart, false), quickReply: QR_ORDERING });
        }
      } else {
        await send(client, event.replyToken, {
          type: 'text', text: `⚠️ ไม่พบ "${itemName}" ในตะกร้าครับ`, quickReply: QR_ORDERING,
        });
      }
      return;
    }

    if (text.startsWith('เพิ่ม ')) {
      const itemName = text.replace(/^เพิ่ม\s+/, '').trim();
      const cartItem = state.cart.find(i => i.name.toLowerCase() === itemName.toLowerCase());
      if (cartItem) {
        addToCart(state, cartItem);
        state.state = 'ordering';
        await send(client, event.replyToken, { ...cartFlex(state.cart, false), quickReply: QR_ORDERING });
      } else {
        await send(client, event.replyToken, {
          type: 'text', text: `⚠️ ไม่พบ "${itemName}" ในตะกร้าครับ`, quickReply: QR_ORDERING,
        });
      }
      return;
    }
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
      state.state = 'waiting_address';
      await send(client, event.replyToken, [
        cartFlex(state.cart, false),
        { type: 'text', text: '📦 กรุณาพิมพ์ที่อยู่จัดส่ง\n\nตัวอย่าง:\nสมชาย ใจดี 0812345678\n123 ม.4 ต.บ้านใหม่ อ.เมือง\nจ.ชุมพร 86000', quickReply: QR_CANCEL },
      ]);
      return;
    }

    // ─── กด สั่งเลย (ordering) → เพิ่มทันที ───────────────────
    const isSingleLine = !text.includes('\n');
    const hasExplicitQty = /[xX×*]\s*\d+/.test(text) || /\s+\d+\s*(ชิ้น|อัน|กล่อง|ถุง)?$/.test(text);
    if (isSingleLine && !hasExplicitQty) {
      const tapItem = findItem(text);
      if (tapItem) {
        const added = addToCart(state, tapItem);
        const total = state.cart.reduce((s, i) => s + i.price * i.qty, 0);
        await send(client, event.replyToken, {
          type: 'text',
          text: `✅ ${tapItem.name} ×${added.qty}  (${added.subtotal} บาท)\n🛒 รวม ${total} บาท\n\nกด ➕ สั่งเพิ่ม หรือ ✅ สั่งครบแล้ว`,
          quickReply: QR_ORDERING,
        });
        return;
      }
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

  // ─── waiting_qty: กด +/- และ เพิ่มลงตะกร้า ────────────────────
  if (state.state === 'waiting_qty') {
    const item = state.pendingItem;

    if (lower.startsWith('qty+')) {
      state.pendingQty = Math.min((state.pendingQty || 1) + 1, 20);
      await send(client, event.replyToken, qtyPickerFlex(item, state.pendingQty));
      return;
    }

    if (lower.startsWith('qty-')) {
      state.pendingQty = Math.max((state.pendingQty || 1) - 1, 1);
      await send(client, event.replyToken, qtyPickerFlex(item, state.pendingQty));
      return;
    }

    if (lower.startsWith('ลงตะกร้า')) {
      const qty = state.pendingQty || 1;
      const parsed = { ...item, qty, subtotal: item.price * qty };
      state.cart.push(parsed);
      state.state = 'ordering';
      state.pendingItem = null;
      state.pendingQty = 1;
      state.prevState = null;
      const total = state.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
      try {
        await send(client, event.replyToken, [
          catalogFlex(),
          {
            type: 'text',
            text: `✅ เพิ่ม "${item.name}" ×${qty} แล้วครับ!\n🛒 ตะกร้า ${state.cart.length} รายการ รวม ${total} บาท\n\nสั่งเพิ่มหรือกด "สั่งครบแล้ว"`,
            quickReply: QR_ORDERING,
          },
        ]);
      } catch (err) {
        await send(client, event.replyToken, {
          type: 'text',
          text: `✅ เพิ่ม "${item.name}" ×${qty} แล้ว รวม ${total} บาท`,
          quickReply: QR_ORDERING,
        });
      }
      return;
    }

    // fallback: แสดง picker อีกครั้ง
    await send(client, event.replyToken, qtyPickerFlex(item, state.pendingQty || 1));
    return;
  }

  if (state.state === 'confirming') {
    if (['ยืนยัน', 'confirm', 'ok', 'โอเค', 'ตกลง'].includes(lower)) {
      state.state = 'waiting_name';
      await send(client, event.replyToken, {
        type: 'text',
        text: '👤 กรุณาพิมพ์ชื่อ-สกุล ผู้รับสินค้า',
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
    await send(client, event.replyToken, paymentFlex(state.orderId, total, state.cart));
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

// ─── รับออเดอร์จาก LIFF (ครบวงจร: items + address + slip) ────
async function handleLiffOrder({ userId, displayName, items, address, slip }, client) {
  const { calcShipping, FLAT_ITEMS } = require('./menu');

  const cart = items.map(i => ({
    name: i.name, price: i.price, qty: i.qty,
    subtotal: i.price * i.qty,
    weight: (FLAT_ITEMS.find(m => m.name === i.name) || {}).weight || 0,
  }));

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const { fee: shipFee, totalWeight } = calcShipping(cart);
  const grandTotal = total + shipFee;
  const orderId = generateOrderId();

  // บันทึก state
  const state = getState(userId);
  state.displayName = displayName;
  state.cart = cart;
  state.address = address;
  state.orderId = orderId;
  state.state = 'waiting_slip';

  // บันทึก Sheets
  const timestamp = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  try {
    await appendOrder({
      orderId, displayName, userId,
      items: cart.map(i => `${i.name}x${i.qty}`).join(', '),
      total: grandTotal, address, status: 'รอยืนยัน', timestamp,
    });
  } catch (err) { console.error('Sheets error:', err.message); }

  // บันทึก orderStatus
  orderStatus[orderId] = {
    userId, displayName, status: 'รอยืนยัน',
    total: grandTotal, items: [...cart], address, trackingNo: '',
  };
  userLastOrder[userId] = orderId;

  // แจ้ง admin
  if (ADMIN_USER_ID) {
    try {
      await client.pushMessage({
        to: ADMIN_USER_ID,
        messages: [
          adminOrderFlex(orderId, cart, grandTotal, address, displayName),
          { type: 'text', text: `📝 จัดส่ง: พิมพ์\n"จัดส่ง ${orderId} [เลขพัสดุ]"` },
        ],
      });
      // ส่งสลิปให้ admin ดูด้วย (ถ้ามี)
      if (slip) {
        await client.pushMessage({
          to: ADMIN_USER_ID,
          messages: [{ type: 'text', text: `🧾 สลิปจาก ${displayName} — ${orderId}` }],
        });
      }
    } catch (err) { console.error('Push admin error:', err.message); }
  }

  // แจ้งลูกค้า
  const shipNote = getShippingNote();
  const liffMsgs = [slipReceivedFlex(orderId)];
  if (shipNote) liffMsgs.push({ type: 'text', text: `📅 แจ้งเพื่อทราบ${shipNote}` });
  await client.pushMessage({ to: userId, messages: liffMsgs });

  // reset state
  resetState(userId);

  return orderId;
}

function getOrdersByUser(userId) {
  return Object.entries(orderStatus)
    .filter(([, o]) => o.userId === userId)
    .sort(([a], [b]) => b.localeCompare(a)) // ล่าสุดก่อน
    .map(([orderId, o]) => ({
      orderId,
      status: o.status,
      total: o.total,
      items: o.items || [],
      address: o.address || '',
      trackingNo: o.trackingNo || '',
    }));
}

module.exports = { handleMessage, handleLiffOrder, getOrdersByUser };
