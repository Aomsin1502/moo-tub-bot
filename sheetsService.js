const { google } = require('googleapis');

async function getSheets() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON || !process.env.GOOGLE_SHEET_ID) {
    return null;
  }
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function appendOrder(data) {
  const sheets = await getSheets();
  if (!sheets) {
    console.log('[Sheets] ไม่ได้ตั้งค่า — บันทึกที่ console แทน:', JSON.stringify(data));
    return;
  }
  const row = [
    data.timestamp,
    data.orderId,
    data.displayName,
    data.userId,
    data.items,
    data.total,
    data.address,
    data.status,
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: 'ออเดอร์!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

async function updateOrderStatus(orderId, status, trackingNo = '') {
  const sheets = await getSheets();
  if (!sheets) {
    console.log('[Sheets] updateOrderStatus:', orderId, status, trackingNo);
    return;
  }
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'ออเดอร์!B:B',
    });
    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(row => row[0] === orderId);
    if (rowIndex === -1) {
      console.log('[Sheets] ไม่พบ orderId:', orderId);
      return;
    }
    const sheetRow = rowIndex + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `ออเดอร์!H${sheetRow}:I${sheetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[status, trackingNo]] },
    });
    console.log('[Sheets] updated row', sheetRow, '→', status, trackingNo);
  } catch (err) {
    console.error('[Sheets] updateOrderStatus error:', err.message);
  }
}

// อ่านออเดอร์ตาม status จาก Sheets
async function getOrdersByStatus(status) {
  const sheets = await getSheets();
  if (!sheets) return [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'ออเดอร์!A:H',
    });
    const rows = res.data.values || [];
    return rows
      .filter(row => row[7] === status)
      .map(row => ({
        orderId:     row[1] || '',
        displayName: row[2] || '',
        userId:      row[3] || '',
        itemsStr:    row[4] || '',
        total:       Number(row[5]) || 0,
        address:     row[6] || '',
        status:      row[7] || '',
      }));
  } catch (err) {
    console.error(`[Sheets] getOrdersByStatus(${status}) error:`, err.message);
    return [];
  }
}

// ดึงออเดอร์หลาย status พร้อมกัน
async function getOrdersByStatuses(statuses) {
  const sheets = await getSheets();
  if (!sheets) return [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'ออเดอร์!A:H',
    });
    const rows = res.data.values || [];
    const set = new Set(statuses);
    return rows
      .filter(row => set.has(row[7]))
      .map(row => ({
        orderId:     row[1] || '',
        displayName: row[2] || '',
        userId:      row[3] || '',
        itemsStr:    row[4] || '',
        total:       Number(row[5]) || 0,
        address:     row[6] || '',
        status:      row[7] || '',
        timestamp:   row[0] || '',
      }));
  } catch (err) {
    console.error('[Sheets] getOrdersByStatuses error:', err.message);
    return [];
  }
}

// ดึงออเดอร์ทั้งหมดของ userId จาก Sheets (สูงสุด 3 pending + จัดส่งล่าสุด)
async function getOrdersByUserId(userId) {
  const sheets = await getSheets();
  if (!sheets) return [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'ออเดอร์!A:I',
    });
    const rows = res.data.values || [];
    const PENDING = new Set(['รอยืนยัน', 'รอแพค', 'รอส่ง']);
    const all = rows
      .filter(row => row[3] === userId)
      .map(row => ({
        orderId:    row[1] || '',
        displayName: row[2] || '',
        userId:     row[3] || '',
        total:      Number(row[5]) || 0,
        address:    row[6] || '',
        status:     row[7] || '',
        trackingNo: row[8] || '',
      }))
      .sort((a, b) => b.orderId.localeCompare(a.orderId));
    // เอา pending ทั้งหมด + จัดส่งแล้วล่าสุด 1 รายการ จำกัดรวมไม่เกิน 3
    const pending  = all.filter(o => PENDING.has(o.status)).slice(0, 3);
    const shipped  = all.filter(o => o.status === 'จัดส่งแล้ว').slice(0, 1);
    const result   = [...pending, ...shipped].slice(0, 3);
    return result;
  } catch (err) {
    console.error('[Sheets] getOrdersByUserId error:', err.message);
    return [];
  }
}

// backward compat
const getPackingOrders = () => getOrdersByStatus('รอแพค');

module.exports = { appendOrder, updateOrderStatus, getPackingOrders, getOrdersByStatus, getOrdersByStatuses, getOrdersByUserId };
