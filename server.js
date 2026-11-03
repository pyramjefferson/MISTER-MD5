const express = require('express'), path = require('path');
const { startBot, restoreAll, resetSession, isConnected, count } = require('./lib/bot');
const cmds = require('./lib/commands');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (q, r) => r.send('ok'));
app.get('/stats', (q, r) => r.json({ sessions: count(), commands: cmds.size }));

const last = new Map();
app.post('/pair', async (req, res) => {
  const number = String(req.body.number || '').replace(/\D/g, '');
  if (number.length < 8 || number.length > 15)
    return res.status(400).json({ error: 'Numéro invalide. Format international sans + ni espaces (ex: 50940217685).' });
  if (Date.now() - (last.get(number) || 0) < 30000)
    return res.status(429).json({ error: 'Attends 30 secondes avant de réessayer.' });
  last.set(number, Date.now());
  try {
    if (isConnected(number)) return res.json({ connected: true });
    await resetSession(number);
    const code = await startBot(number, true);
    res.json({ code: code && code.match(/.{1,4}/g).join('-') });
  } catch (e) {
    console.error('pair:', e.message);
    res.status(500).json({ error: 'Échec de génération du code. Réessaie dans un instant.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('MISTER-MD site sur le port ' + PORT);
  restoreAll().catch(e => console.error(e.message));
  const url = process.env.RENDER_EXTERNAL_URL;
  if (url) setInterval(() => fetch(url + '/health').catch(() => {}), 10 * 60 * 1000);
});
