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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
