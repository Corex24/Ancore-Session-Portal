const qrcode = require('qrcode-terminal');

function qrHandler(qr, sessionId, res) {
  console.log('QR Code:', qr);
  res.json({ qr, sessionId });
}

module.exports = qrHandler;