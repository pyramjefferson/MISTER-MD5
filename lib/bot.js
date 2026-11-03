const fs = require('fs'), path = require('path'), pino = require('pino');
const {
  default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion,
  Browsers, makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const config = require('../config');
const { handle, onGroupUpdate } = require('./handler');

const SESS = path.join(__dirname, '..', 'sessions');
const bots = new Map();
const logger = pino({ level: 'silent' });

// Session réellement liée à un compte WhatsApp (et pas juste un code demandé)
const isPaired = c => !!(c && (c.registered || c.account));
const isConnected = n => { const s = bots.get(n); return !!(s && isPaired(s.authState.creds)); };
const count = () => bots.size;
const rmDir = n => fs.rmSync(path.join(SESS, n), { recursive: true, force: true });

async function resetSession(n) {
  const s = bots.get(n);
  if (s) { s._manual = true; try { s.end(undefined); } catch {} bots.delete(n); }
  rmDir(n);
}

// Attend que le socket soit prêt (premier événement "qr") avant de demander le code
const waitReady = sock => new Promise(res => {
  const t = setTimeout(res, 10000);
  const f = u => { if (u.qr) { clearTimeout(t); sock.ev.off('connection.update', f); res(); } };
  sock.ev.on('connection.update', f);
});

async function startBot(number, wantPair = false) {
  const dir = path.join(SESS, number);
  fs.mkdirSync(dir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version, logger, printQRInTerminal: false,
    browser: Browsers.ubuntu('Chrome'),
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    markOnlineOnConnect: false
  });
  bots.set(number, sock);
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (sock._manual) return;
    if (connection === 'open') {
      console.log(`[${number}] connecté`);
      try {
        await sock.sendMessage(sock.user.id.split(':')[0] + '@s.whatsapp.net', {
          text: `✅ *${config.botName}* connecté !\nTape *.menu* pour voir les 100 commandes.\n\n👑 ${config.ownerName}`
        });
      } catch {}
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`[${number}] connexion fermée (code ${code})`);
      if (bots.get(number) === sock) bots.delete(number);
      if (code === DisconnectReason.loggedOut) {
        rmDir(number);
        console.log(`[${number}] déconnecté depuis le téléphone, session supprimée`);
      } else if (isPaired(sock.authState.creds) || code === DisconnectReason.restartRequired) {
        // appareil lié (ou redémarrage demandé juste après le pairing) → on se reconnecte
        setTimeout(() => startBot(number).catch(e => console.error(e.message)), 3000);
      } else {
        // pairing jamais terminé : on NE se reconnecte PAS (ça invaliderait le code affiché)
        rmDir(number);
      }
    }
  });
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) { try { await handle(sock, m); } catch (e) { console.error('handler:', e.message); } }
  });
  sock.ev.on('group-participants.update', u => onGroupUpdate(sock, u).catch(() => {}));

  let code = null;
  if (wantPair && !isPaired(state.creds)) {
    try {
      await waitReady(sock);
      await new Promise(r => setTimeout(r, 1000));
      code = await sock.requestPairingCode(number);
      console.log(`[${number}] code de pairing généré`);
    } catch (e) {
      console.error(`[${number}] échec requestPairingCode : ${e.message}`);
      await resetSession(number);
      throw e;
    }
  }
  return code;
}

async function restoreAll() {
  if (!fs.existsSync(SESS)) return;
  for (const n of fs.readdirSync(SESS)) {
    try {
      const creds = JSON.parse(fs.readFileSync(path.join(SESS, n, 'creds.json'), 'utf8'));
      if (isPaired(creds)) await startBot(n); else rmDir(n);
    } catch { rmDir(n); }
  }
}

module.exports = { startBot, restoreAll, resetSession, isConnected, count };
