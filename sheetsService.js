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

module.exports = { appendOrder };
