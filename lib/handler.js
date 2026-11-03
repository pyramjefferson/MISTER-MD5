const { normalizeMessageContent, jidNormalizedUser, downloadMediaMessage } = require('@whiskeysockets/baileys');
const logger = require('pino')({ level: 'silent' });
const config = require('../config');
const settings = require('./settings');
const cmds = require('./commands');

const num = j => (j || '').split('@')[0].split(':')[0];
const S = settings.data;

function adminInfo(meta, sock) {
  const me = [num(sock.user?.id), num(sock.user?.lid)].filter(Boolean);
  const match = (p, ids) => ids.some(i => i && [p.id, p.lid, p.phoneNumber].some(x => num(x) === i));
  return {
    admins: meta.participants.filter(p => p.admin),
    botIsAdmin: meta.participants.some(p => p.admin && match(p, me)),
    isAdminOf: n => meta.participants.some(p => p.admin && match(p, [n]))
  };
}

async function handle(sock, m) {
  if (!m.message) return;
  const jid = m.key.remoteJid;
  if (!jid || jid === 'status@broadcast') return;
  const content = normalizeMessageContent(m.message) || {};
  const text = content.conversation || content.extendedTextMessage?.text ||
    content.imageMessage?.caption || content.videoMessage?.caption || '';
  const isGroup = jid.endsWith('@g.us');
  const rawSender = m.key.fromMe ? sock.user.id : (isGroup ? (m.key.participant || m.participant) : jid);
  const sender = jidNormalizedUser(rawSender);
  const senderNum = num(sender);
  const botNum = num(sock.user.id);
  const isOwner = !!m.key.fromMe || senderNum === config.ownerNumber || senderNum === botNum;

  if (S.autoread) sock.readMessages([m.key]).catch(() => {});

  // Anti-lien
  if (isGroup && S.antilink[jid] && !m.key.fromMe && /chat\.whatsapp\.com\/[A-Za-z0-9]/i.test(text) && !isOwner) {
    try {
      const meta = await sock.groupMetadata(jid);
      const info = adminInfo(meta, sock);
      if (!info.isAdminOf(senderNum) && info.botIsAdmin) {
        await sock.sendMessage(jid, { delete: m.key });
        await sock.sendMessage(jid, { text: `🚫 @${senderNum} les liens de groupe sont interdits ici.`, mentions: [sender] });
        return;
      }
    } catch {}
  }

  const prefix = S.prefix;
  if (!text.startsWith(prefix)) return;
  if (S.mode === 'private' && !isOwner) return;
  const [raw, ...args] = text.slice(prefix.length).trim().split(/\s+/);
  const cmd = cmds.get((raw || '').toLowerCase());
  if (!cmd) return;

  const ci = content.extendedTextMessage?.contextInfo || {};
  const qm = ci.quotedMessage ? normalizeMessageContent(ci.quotedMessage) : null;
  const quotedText = qm ? (qm.conversation || qm.extendedTextMessage?.text || qm.imageMessage?.caption || '') : '';
  const digits = (args[0] || '').replace(/\D/g, '');
  const target = ci.mentionedJid?.[0] || ci.participant || (digits.length > 6 ? digits + '@s.whatsapp.net' : null);

  const c = {
    sock, m, jid, args, prefix, isGroup, sender, senderNum, isOwner, target, config, settings,
    text: args.join(' ') || quotedText,
    reply: t => sock.sendMessage(jid, { text: t }, { quoted: m }),
    getMedia: async kinds => {
      let wrap = null, type = kinds.find(k => content[k]);
      if (type) wrap = m;
      else if (qm && (type = kinds.find(k => qm[k]))) wrap = { key: { remoteJid: jid, id: ci.stanzaId, participant: ci.participant, fromMe: false }, message: ci.quotedMessage };
      if (!wrap) return null;
      return { type, buf: await downloadMediaMessage(wrap, 'buffer', {}, { logger, reuploadRequest: sock.updateMediaMessage }) };
    },
    react: e => sock.sendMessage(jid, { react: { text: e, key: m.key } }).catch(() => {})
  };

  if (cmd.owner && !isOwner) return c.reply('⛔ Commande réservée au propriétaire.');
  if (cmd.group && !isGroup) return c.reply('👥 Cette commande fonctionne uniquement dans un groupe.');
  if (cmd.group) {
    c.meta = await sock.groupMetadata(jid);
    const info = adminInfo(c.meta, sock);
    c.isAdmin = isOwner || info.isAdminOf(senderNum);
    c.botIsAdmin = info.botIsAdmin;
    c.admins = info.admins;
    if (cmd.admin && !c.isAdmin) return c.reply('⛔ Réservé aux admins du groupe.');
    if (cmd.botAdmin && !c.botIsAdmin) return c.reply('⚠️ Je dois être admin du groupe pour faire ça.');
  }
  if (cmd.usage && !c.text && !(cmd.target && target)) return c.reply(`ℹ️ Usage : *${prefix}${cmd.name} ${cmd.usage}*`);
  if (cmd.target && !target) return c.reply(`ℹ️ Mentionne quelqu'un, réponds à son message ou donne son numéro.\nUsage : *${prefix}${cmd.name} @user*`);

  if (S.autotyping) sock.sendPresenceUpdate('composing', jid).catch(() => {});
  try {
    await cmd.run(c);
  } catch (e) {
    console.error(`cmd ${cmd.name}:`, e.message);
    c.reply('❌ Erreur : ' + (e.message || 'inconnue'));
  }
}

async function onGroupUpdate(sock, u) {
  if (!S.welcome[u.id] || u.action !== 'add') return;
  const meta = await sock.groupMetadata(u.id);
  const ids = u.participants.map(p => (typeof p === 'string' ? p : p.phoneNumber || p.id));
  await sock.sendMessage(u.id, {
    text: `👋 Bienvenue ${ids.map(i => '@' + num(i)).join(' ')} dans *${meta.subject}* !\nTape *${S.prefix}menu* pour voir mes commandes.\n\n> ${config.botName}`,
    mentions: ids
  });
}

module.exports = { handle, onGroupUpdate };
