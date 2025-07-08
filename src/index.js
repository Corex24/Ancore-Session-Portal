const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const uploadToMega = require('./mega');
const generateSessionId = require('./gen-id');
const qrHandler = require('./qr');

const app = express();
const port = process.env.PORT || 3000;
const sessions = new Map();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Logger configuration
const logger = pino({ level: 'fatal' });

// Create WhatsApp session
async function createSession(sessionId, res) {
  const { state, saveCreds } = await useMultiFileAuthState(`./temp/${sessionId}`);
  const sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrHandler(qr, sessionId, res);
    }
    if (connection === 'close') {
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
        createSession(sessionId);
      } else {
        sessions.delete(sessionId);
      }
    }
    if (connection === 'open') {
      console.log(`Session ${sessionId} connected`);
      await saveCreds();
      const credsPath = path.join(__dirname, '../temp', sessionId, 'creds.json');
      const publicUrl = await uploadToMega(credsPath);
      const phoneNumber = sock.user.id.split(':')[0];
      await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
        text: `Session ID: ${sessionId}`
      });
      await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
        text: `> ╔════════════════════╗
> ║  *𝗔𝗡𝗖𝗢𝗥𝗘 �_L𝗜𝗡𝗞𝗘𝗗*  ║
> ╚════════════════════╝
>
> *WhatsApp Channel:*  
> https://whatsapp.com/channel/0029Vb6nHar2phHORBFhOn3p
>
> *Telegram Channel:*  
> https://t.me/+fr3SZ2MYyv4wMzU0
>
> _Not sure where to deploy or can't handle it yourself?_  
> *No worries!*  
> We’ll take care of it for you for less than *$1.5/month.*
>
> *Contact Support:*  
> https://t.me/corex2410
>
> _The bot is completely free and_  
> _you can deploy it anywhere you wish._
>
> — *Made by Corex with 💙* —`
      });
    }
  });

  sessions.set(sessionId, sock);
  return sock;
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/main.html'));
});

app.get('/pair', async (req, res) => {
  const phoneNumber = req.query.phoneNumber;
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
  try {
    const sessionId = generateSessionId(phoneNumber);
    const sock = await createSession(sessionId);
    const code = await sock.requestPairingCode(phoneNumber);
    res.json({ code });
  } catch (error) {
    res.status(500).json({ error: 'Failed to initiate pairing' });
  }
});

app.get('/check-session', async (req, res) => {
  const sessionName = req.query.name;
  if (!sessionName || !/^[a-zA-Z0-9]{3,20}$/.test(sessionName)) {
    return res.json({ available: false, message: 'Invalid session ID' });
  }
  const sessionId = `ANCORE_${sessionName}`;
  const sessionExists = sessions.has(sessionId);
  res.json({ available: !sessionExists });
});

app.get('/qr', async (req, res) => {
  const sessionId = req.query.session || generateSessionId();
  await createSession(sessionId, res);
});

app.listen(port, () => console.log(`Server running on port ${port}`));