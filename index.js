require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { handleMessage } = require('./orderManager');

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: lineConfig.channelAccessToken,
});

const app = express();

// Serve product images from /public/images/
app.use('/images', express.static(require('path').join(__dirname, 'public', 'images')));

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  res.json({ status: 'ok' });
  for (const event of req.body.events) {
    try {
      await handleMessage(event, client);
    } catch (err) {
      console.error('Event error:', err.message);
    }
  }
});

app.get('/', (req, res) => {
  res.send('🐷 หมูทุบแม่บัวเผื่อน Bot is running!');
});

// LIFF Shop page
app.get('/shop', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'shop', 'index.html'));
});

// รับออเดอร์จาก LIFF
app.post('/api/liff-order', express.json(), async (req, res) => {
  try {
    const { userId, displayName, items } = req.body;
    if (!userId || !items || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'invalid data' });
    }
    const { handleLiffOrder } = require('./orderManager');
    const orderId = await handleLiffOrder({ userId, displayName, items, address, slip }, client);
    res.json({ ok: true, orderId });
  } catch (err) {
    console.error('LIFF order error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
