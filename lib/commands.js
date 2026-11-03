const crypto = require('crypto');
const os = require('os');
const config = require('../config');
const settings = require('./settings');
const S = settings.data;

const cmds = new Map();
const add = (name, cat, desc, run, o = {}) => cmds.set(name, { name, cat, desc, run, ...o });
const pick = a => a[Math.floor(Math.random() * a.length)];
const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const hash = s => [...s.toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const get = async (u, t = 'json') => {
  const r = await fetch(u, { signal: AbortSignal.timeout(15000), headers: { 'user-agent': 'MISTER-MD' } });
  if (!r.ok) throw new Error('Service indisponible (HTTP ' + r.status + ')');
  return t === 'json' ? r.json() : t === 'buf' ? Buffer.from(await r.arrayBuffer()) : r.text();
};
const fmtUp = s => `${Math.floor(s / 86400)}j ${Math.floor(s % 86400 / 3600)}h ${Math.floor(s % 3600 / 60)}m ${Math.floor(s % 60)}s`;
const onoff = (c, store, label) => {
  const v = (c.args[0] || '').toLowerCase();
  if (!['on', 'off'].includes(v)) return c.reply(`ℹ️ Usage : *${c.prefix}${label} on/off*`);
  return v;
};

const ORDER = ['AI', 'DOWNLOAD', 'FUN', 'GENERAL', 'GROUP', 'OWNER', 'SEARCH', 'STICKER', 'TOOLS'];
const ICON = { AI: '🤖', DOWNLOAD: '📥', FUN: '🎉', GENERAL: '⚙️', GROUP: '👥', OWNER: '👑', SEARCH: '🔎', STICKER: '🖼️', TOOLS: '🛠️' };

/* ───────── GENERAL ───────── */
add('menu', 'GENERAL', 'Afficher le menu', async c => {
  c.react('📜');
  const cats = {};
  for (const x of cmds.values()) (cats[x.cat] = cats[x.cat] || []).push(x.name);
  let t = `╭━━〔 *${config.botName}* 〕━━⬣\n┃ 👑 Owner : ${config.ownerName}\n┃ ⚙️ Préfixe : ${S.prefix}\n┃ 🔓 Mode : ${S.mode}\n┃ 📦 Commandes : ${cmds.size}\n┃ ⏱️ Uptime : ${fmtUp(process.uptime())}\n╰━━━━━━━━━━━━━━⬣\n`;
  for (const k of ORDER) { const v = cats[k]; if (!v) continue; t += `\n╭─❏ ${ICON[k]} *${k}* (${v.length})\n${v.map(n => `│ ◦ ${S.prefix}${n}`).join('\n')}\n╰─────────⬣\n`; }
  t += `\n📢 Chaîne : ${config.channelUrl}\n> ${config.botName} • ${config.ownerName}`;
  try {
    await c.sock.sendMessage(c.jid, {
      image: { url: config.imageUrl }, caption: t,
      contextInfo: { forwardingScore: 1, isForwarded: true, forwardedNewsletterMessageInfo: { newsletterJid: config.channelJid, newsletterName: config.botName, serverMessageId: 1 } }
    }, { quoted: c.m });
  } catch { c.reply(t); }
});
add('ping', 'GENERAL', 'Vitesse de réponse', async c => {
  const t = Date.now();
  const s = await c.reply('🏓 ...');
  c.sock.sendMessage(c.jid, { text: `🏓 Pong ! *${Date.now() - t} ms*`, edit: s.key });
});
add('alive', 'GENERAL', 'Le bot est-il en ligne', c => c.reply(`✅ *${config.botName}* est en ligne !\n👑 ${config.ownerName}\n📢 ${config.channelUrl}`));
add('uptime', 'GENERAL', 'Temps de fonctionnement', c => c.reply(`⏱️ Uptime : *${fmtUp(process.uptime())}*`));
add('owner', 'GENERAL', 'Contact du propriétaire', c => {
  const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${config.ownerName}\nTEL;type=CELL;type=VOICE;waid=${config.ownerNumber}:+${config.ownerNumber}\nEND:VCARD`;
  return c.sock.sendMessage(c.jid, { contacts: { displayName: config.ownerName, contacts: [{ vcard }] } }, { quoted: c.m });
});
add('botinfo', 'GENERAL', 'Infos du bot', c => c.reply(`🤖 *${config.botName}*\n👑 Owner : ${config.ownerName}\n⚙️ Préfixe : ${S.prefix}\n🔓 Mode : ${S.mode}\n📦 Commandes : ${cmds.size}\n🟢 Node : ${process.version}\n💾 RAM : ${(process.memoryUsage().rss / 1048576).toFixed(0)} Mo`));
add('time', 'GENERAL', 'Heure actuelle', c => {
  const tz = c.args[0] || config.timezone;
  try { c.reply(`🕒 ${new Date().toLocaleTimeString('fr-FR', { timeZone: tz })} (${tz})`); }
  catch { c.reply('❌ Fuseau invalide. Exemple : America/Port-au-Prince'); }
});
add('date', 'GENERAL', 'Date du jour', c => c.reply('📅 ' + new Date().toLocaleDateString('fr-FR', { timeZone: config.timezone, dateStyle: 'full' })));
add('speed', 'GENERAL', 'Test de vitesse du serveur', c => {
  const t = process.hrtime.bigint(); let x = 0; for (let i = 0; i < 3e6; i++) x += i % 7;
  c.reply(`⚡ Calcul : *${(Number(process.hrtime.bigint() - t) / 1e6).toFixed(1)} ms*\n🧠 CPU : ${os.cpus().length} cœur(s)`);
});
add('site', 'GENERAL', 'Site de connexion du bot', c => c.reply(`🌐 Connecte ton numéro ici :\n${config.siteUrl || 'Site non configuré'}`));

/* ───────── TEXT (20) ───────── */
const T = (name, desc, fn) => add(name, 'TOOLS', desc, c => c.reply(fn(c.text)), { usage: '<texte>' });
T('reverse', 'Inverser un texte', t => [...t].reverse().join(''));
T('upper', 'MAJUSCULES', t => t.toUpperCase());
T('lower', 'minuscules', t => t.toLowerCase());
T('wordcount', 'Compter les mots', t => `📝 Mots : *${t.trim().split(/\s+/).length}*`);
T('base64enc', 'Encoder en Base64', t => Buffer.from(t).toString('base64'));
T('base64dec', 'Décoder du Base64', t => Buffer.from(t, 'base64').toString('utf8'));
const MORSE = { a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.' };
T('morse', 'Texte vers morse', t => [...t.toLowerCase()].map(ch => ch === ' ' ? '/' : MORSE[ch] || '').filter(Boolean).join(' '));
T('say', 'Faire parler le bot', t => t);
const SC = { a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ꜰ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ', k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 'ꜱ', t: 'ᴛ', u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ' };
T('smallcaps', 'ᴘᴇᴛɪᴛᴇs ᴍᴀᴊᴜsᴄᴜʟᴇs', t => [...t.toLowerCase()].map(ch => SC[ch] || ch).join(''));

/* ───────── MATH (10) ───────── */
add('calc', 'TOOLS', 'Calculatrice', c => {
  const e = c.text.replace(/\^/g, '**').replace(/,/g, '.');
  if (!/^[0-9+\-*/().%\s*]+$/.test(e)) return c.reply('❌ Expression invalide. Exemple : 12*(3+4)');
  c.reply(`🧮 ${c.text} = *${Function('"use strict";return (' + e + ')')()}*`);
}, { usage: '12*(3+4)' });
add('random', 'TOOLS', 'Nombre aléatoire', c => { const a = parseInt(c.args[0]) || 1, b = parseInt(c.args[1]) || 100; c.reply(`🎲 *${rnd(Math.min(a, b), Math.max(a, b))}*`); });
add('dice', 'FUN', 'Lancer des dés (ex: 2d6)', c => {
  const [n, f] = (c.args[0] || '1d6').split('d').map(x => parseInt(x));
  if (!n || !f || n > 20 || f > 1000) return c.reply('ℹ️ Exemple : *.dice 2d6*');
  const r = Array.from({ length: n }, () => rnd(1, f));
  c.reply(`🎲 ${r.join(' + ')} = *${r.reduce((a, b) => a + b, 0)}*`);
});
add('coinflip', 'FUN', 'Pile ou face', c => c.reply(`🪙 *${pick(['Pile', 'Face'])}*`));
add('password', 'TOOLS', 'Générer un mot de passe', c => {
  const n = Math.min(Math.max(parseInt(c.args[0]) || 12, 6), 64);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  c.reply('🔐 `' + Array.from(crypto.randomBytes(n), b => chars[b % chars.length]).join('') + '`');
});
add('uuid', 'TOOLS', 'Générer un UUID', c => c.reply('🆔 ' + crypto.randomUUID()));
/* ───────── FUN (15) ───────── */
const L = (name, desc, arr, pre = '') => add(name, 'FUN', desc, c => c.reply(pre + pick(arr)));
L('joke', 'Une blague', ['Pourquoi les plongeurs plongent-ils en arrière ? Parce que sinon ils tombent dans le bateau.', 'Que dit un escargot sur le dos d\'une tortue ? « Wouhou ! »', 'Quel est le comble pour un électricien ? De ne pas être au courant.', 'Pourquoi les maths sont tristes ? Elles ont trop de problèmes.', 'Un développeur n\'a pas de bug… juste des fonctionnalités surprises.'], '😂 ');
L('quote', 'Citation inspirante', ['« Le succès, c\'est tomber sept fois, se relever huit. »', '« Fais de ta vie un rêve, et d\'un rêve une réalité. » — Saint-Exupéry', '« La discipline est le pont entre les objectifs et les accomplissements. »', '« Le meilleur moment pour planter un arbre était il y a 20 ans. Le deuxième meilleur est maintenant. »', '« Ce qui ne te tue pas te rend plus fort. » — Nietzsche'], '💬 ');
L('fact', 'Fait amusant', ['Le miel ne se périme jamais.', 'Les poulpes ont trois cœurs.', 'Un jour sur Vénus dure plus longtemps qu\'une année sur Vénus.', 'Les bananes sont des baies, mais pas les fraises.', 'Haïti a été la première république noire indépendante, en 1804.'], '🧠 ');
L('truth', 'Question vérité', ['Quel est ton plus grand secret ?', 'Quelle est ta plus grande peur ?', 'Quel est le dernier mensonge que tu as dit ?', 'Qui t\'a le plus marqué dans ta vie ?', 'Quelle est ta plus grande honte ?'], '🫣 Vérité : ');
L('dare', 'Défi action', ['Envoie un vocal en chantant.', 'Change ta photo de profil pendant 1h avec ce que le groupe choisit.', 'Écris « Je suis le roi/la reine » en statut.', 'Fais 20 pompes et envoie la preuve.', 'Envoie ton dernier selfie.'], '😈 Défi : ');
L('8ball', 'Boule magique (pose une question)', ['Oui, certainement.', 'Sans aucun doute.', 'Probablement.', 'Je ne sais pas, redemande.', 'Peu probable.', 'Non.', 'Mes sources disent non.'], '🎱 ');
add('ship', 'FUN', 'Compatibilité entre deux noms', c => c.reply(`💞 ${c.text.replace(/\s*[&+x]\s*/i, ' ❤️ ')}\nCompatibilité : *${hash(c.text) % 101}%*`), { usage: 'Nom1 & Nom2' });
add('choose', 'FUN', 'Choisir entre options (a | b | c)', c => {
  const o = c.text.split(/[|,]/).map(x => x.trim()).filter(Boolean);
  if (o.length < 2) return c.reply('ℹ️ Usage : *.choose pizza | riz | pâtes*');
  c.reply(`🤔 Je choisis : *${pick(o)}*`);
}, { usage: 'a | b | c' });
add('rps', 'FUN', 'Pierre-papier-ciseaux', c => {
  const map = { pierre: 0, rock: 0, papier: 1, paper: 1, ciseaux: 2, scissors: 2 }, em = ['🪨 Pierre', '📄 Papier', '✂️ Ciseaux'];
  const u = map[(c.args[0] || '').toLowerCase()]; if (u === undefined) return c.reply('ℹ️ Usage : *.rps pierre/papier/ciseaux*');
  const b = rnd(0, 2), r = u === b ? '🤝 Égalité !' : (u - b + 3) % 3 === 1 ? '🎉 Tu gagnes !' : '😎 Je gagne !';
  c.reply(`Toi : ${em[u]}\nMoi : ${em[b]}\n\n${r}`);
});
/* ───────── GROUP (20) ───────── */
const G = { group: true };
const ga = { group: true, admin: true, botAdmin: true };
add('tagall', 'GROUP', 'Mentionner tout le monde', c => c.sock.sendMessage(c.jid, {
  text: `📢 *${c.text || 'Attention tout le monde !'}*\n\n` + c.meta.participants.map(p => '▫️ @' + p.id.split('@')[0]).join('\n'),
  mentions: c.meta.participants.map(p => p.id)
}, { quoted: c.m }), { group: true, admin: true });
add('hidetag', 'GROUP', 'Message invisible à tous', c => c.sock.sendMessage(c.jid, { text: c.text || '📢', mentions: c.meta.participants.map(p => p.id) }), { group: true, admin: true });
add('tagadmins', 'GROUP', 'Mentionner les admins', c => c.sock.sendMessage(c.jid, {
  text: `🛡️ *${c.text || 'Appel aux admins'}*\n\n` + c.admins.map(p => '▫️ @' + p.id.split('@')[0]).join('\n'), mentions: c.admins.map(p => p.id)
}, { quoted: c.m }), G);
add('admins', 'GROUP', 'Liste des admins', c => c.reply(`🛡️ *Admins (${c.admins.length})*\n` + c.admins.map(p => '• +' + p.id.split('@')[0]).join('\n')), G);
add('members', 'GROUP', 'Nombre de membres', c => c.reply(`👥 *${c.meta.subject}* : ${c.meta.participants.length} membres`), G);
add('kick', 'GROUP', 'Retirer un membre', async c => { await c.sock.groupParticipantsUpdate(c.jid, [c.target], 'remove'); c.reply('👢 Membre retiré.'); }, { ...ga, target: true });
add('add', 'GROUP', 'Ajouter un membre', async c => { const n = (c.args[0] || '').replace(/\D/g, ''); if (n.length < 7) return c.reply('ℹ️ Usage : *.add 50940217685*'); const r = await c.sock.groupParticipantsUpdate(c.jid, [n + '@s.whatsapp.net'], 'add'); c.reply(r?.[0]?.status === '200' ? '✅ Membre ajouté.' : '⚠️ Impossible (confidentialité ou numéro invalide).'); }, ga);
add('promote', 'GROUP', 'Promouvoir admin', async c => { await c.sock.groupParticipantsUpdate(c.jid, [c.target], 'promote'); c.reply('⬆️ Promu admin.'); }, { ...ga, target: true });
add('demote', 'GROUP', 'Retirer le rôle admin', async c => { await c.sock.groupParticipantsUpdate(c.jid, [c.target], 'demote'); c.reply('⬇️ Rôle admin retiré.'); }, { ...ga, target: true });
add('groupinfo', 'GROUP', 'Infos du groupe', c => c.reply(`👥 *${c.meta.subject}*\n👤 Membres : ${c.meta.participants.length}\n🛡️ Admins : ${c.admins.length}\n📅 Créé : ${new Date(c.meta.creation * 1000).toLocaleDateString('fr-FR')}\n📝 ${c.meta.desc || 'Pas de description'}`), G);
add('link', 'GROUP', 'Lien d\'invitation', async c => c.reply('🔗 https://chat.whatsapp.com/' + await c.sock.groupInviteCode(c.jid)), { ...ga, botAdmin: true });
add('revoke', 'GROUP', 'Réinitialiser le lien', async c => { await c.sock.groupRevokeInvite(c.jid); c.reply('♻️ Lien réinitialisé.'); }, ga);
add('mute', 'GROUP', 'Fermer le groupe', async c => { await c.sock.groupSettingUpdate(c.jid, 'announcement'); c.reply('🔇 Groupe fermé (admins seulement).'); }, ga);
add('unmute', 'GROUP', 'Ouvrir le groupe', async c => { await c.sock.groupSettingUpdate(c.jid, 'not_announcement'); c.reply('🔊 Groupe ouvert à tous.'); }, ga);
add('setname', 'GROUP', 'Changer le nom du groupe', async c => { await c.sock.groupUpdateSubject(c.jid, c.text); c.reply('✅ Nom modifié.'); }, { ...ga, usage: '<nom>' });
add('setdesc', 'GROUP', 'Changer la description', async c => { await c.sock.groupUpdateDescription(c.jid, c.text); c.reply('✅ Description modifiée.'); }, { ...ga, usage: '<description>' });
add('antilink', 'GROUP', 'Anti-lien de groupe on/off', c => {
  const v = onoff(c, null, 'antilink'); if (!v) return;
  S.antilink[c.jid] = v === 'on'; settings.save(); c.reply(`🚫 Anti-lien : *${v}*`);
}, { group: true, admin: true });
add('welcome', 'GROUP', 'Message de bienvenue on/off', c => {
  const v = onoff(c, null, 'welcome'); if (!v) return;
  S.welcome[c.jid] = v === 'on'; settings.save(); c.reply(`👋 Bienvenue : *${v}*`);
}, { group: true, admin: true });
add('warn', 'GROUP', 'Avertir un membre (3 = expulsion)', async c => {
  const k = c.jid + c.target; S.warns[k] = (S.warns[k] || 0) + 1; settings.save();
  if (S.warns[k] >= 3) {
    delete S.warns[k]; settings.save();
    if (c.botIsAdmin) { await c.sock.groupParticipantsUpdate(c.jid, [c.target], 'remove'); return c.reply('🚨 3 avertissements : membre expulsé.'); }
    return c.reply('🚨 3 avertissements (je ne suis pas admin, impossible d\'expulser).');
  }
  c.sock.sendMessage(c.jid, { text: `⚠️ @${c.target.split('@')[0]} avertissement *${S.warns[k]}/3*`, mentions: [c.target] }, { quoted: c.m });
}, { group: true, admin: true, target: true });
add('poll', 'GROUP', 'Créer un sondage', c => {
  const p = c.text.split('|').map(x => x.trim()).filter(Boolean);
  if (p.length < 3) return c.reply('ℹ️ Usage : *.poll Question | option1 | option2*');
  c.sock.sendMessage(c.jid, { poll: { name: p[0], values: p.slice(1, 12), selectableCount: 1 } });
}, { group: true });

/* ───────── OWNER (10) ───────── */
const O = { owner: true };
add('mode', 'OWNER', 'Mode public / private', c => {
  const v = (c.args[0] || '').toLowerCase(); if (!['public', 'private'].includes(v)) return c.reply('ℹ️ Usage : *.mode public/private*');
  S.mode = v; settings.save(); c.reply(`🔓 Mode : *${v}*`);
}, O);
add('setprefix', 'OWNER', 'Changer le préfixe', c => {
  const p = c.args[0]; if (!p || p.length > 3) return c.reply('ℹ️ Usage : *.setprefix !* (1 à 3 caractères)');
  S.prefix = p; settings.save(); c.reply(`✅ Nouveau préfixe : *${p}*`);
}, O);
add('block', 'OWNER', 'Bloquer un contact', async c => { await c.sock.updateBlockStatus(c.target, 'block'); c.reply('🚫 Bloqué.'); }, { ...O, target: true });
add('unblock', 'OWNER', 'Débloquer un contact', async c => { await c.sock.updateBlockStatus(c.target, 'unblock'); c.reply('✅ Débloqué.'); }, { ...O, target: true });
add('restart', 'OWNER', 'Redémarrer le bot', async c => { await c.reply('♻️ Redémarrage...'); setTimeout(() => process.exit(0), 1000); }, O);
add('setbio', 'OWNER', 'Changer la bio du bot', async c => { await c.sock.updateProfileStatus(c.text); c.reply('✅ Bio mise à jour.'); }, { ...O, usage: '<texte>' });
add('join', 'OWNER', 'Rejoindre un groupe via lien', async c => {
  const m = c.text.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/); if (!m) return c.reply('ℹ️ Usage : *.join https://chat.whatsapp.com/xxxx*');
  await c.sock.groupAcceptInvite(m[1]); c.reply('✅ Groupe rejoint.');
}, O);
add('autoread', 'OWNER', 'Lecture auto on/off', c => { const v = onoff(c, null, 'autoread'); if (!v) return; S.autoread = v === 'on'; settings.save(); c.reply(`👁️ Autoread : *${v}*`); }, O);
add('autotyping', 'OWNER', 'Écriture auto on/off', c => { const v = onoff(c, null, 'autotyping'); if (!v) return; S.autotyping = v === 'on'; settings.save(); c.reply(`⌨️ Autotyping : *${v}*`); }, O);
add('broadcast', 'OWNER', 'Message à tous les groupes', async c => {
  const gs = Object.keys(await c.sock.groupFetchAllParticipating()); let n = 0;
  for (const g of gs) { try { await c.sock.sendMessage(g, { text: `📢 *${config.botName}*\n\n${c.text}` }); n++; } catch {} await new Promise(r => setTimeout(r, 1500)); }
  c.reply(`✅ Envoyé à ${n}/${gs.length} groupes.`);
}, { ...O, usage: '<message>' });

/* ───────── INTERNET (15) ───────── */
add('weather', 'SEARCH', 'Météo d\'une ville', async c => {
  const d = (await get(`https://wttr.in/${encodeURIComponent(c.text)}?format=j1`)).current_condition[0];
  c.reply(`🌤️ *${c.text}*\n🌡️ ${d.temp_C}°C (ressenti ${d.FeelsLikeC}°C)\n☁️ ${d.weatherDesc[0].value}\n💧 Humidité : ${d.humidity}%\n💨 Vent : ${d.windspeedKmph} km/h`);
}, { usage: '<ville>' });
add('define', 'SEARCH', 'Définition (anglais)', async c => {
  const d = (await get('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(c.args[0])))[0], m = d.meanings[0];
  c.reply(`📖 *${d.word}* (${m.partOfSpeech})\n${m.definitions[0].definition}`);
}, { usage: '<mot>' });
add('translate', 'SEARCH', 'Traduire (ex: .translate fr hello)', async c => {
  const to = c.args[0], t = c.args.slice(1).join(' ');
  if (!to || !t) return c.reply('ℹ️ Usage : *.translate fr hello world*');
  const d = await get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(t)}&langpair=autodetect|${encodeURIComponent(to)}`);
  c.reply('🌍 ' + d.responseData.translatedText);
});
add('wiki', 'SEARCH', 'Résumé Wikipédia', async c => {
  let d; try { d = await get('https://fr.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(c.text)); } catch { d = await get('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(c.text)); }
  c.reply(`📚 *${d.title}*\n\n${d.extract}`);
}, { usage: '<sujet>' });
add('country', 'SEARCH', 'Infos sur un pays', async c => {
  const d = (await get('https://restcountries.com/v3.1/name/' + encodeURIComponent(c.text)))[0];
  c.reply(`${d.flag} *${d.name.common}*\n🏛️ Capitale : ${(d.capital || ['-'])[0]}\n🌎 Région : ${d.region}\n👥 Population : ${d.population.toLocaleString('fr-FR')}\n💱 Monnaie : ${Object.values(d.currencies || {}).map(x => x.name).join(', ')}\n🗣️ Langues : ${Object.values(d.languages || {}).join(', ')}`);
}, { usage: '<pays>' });
add('crypto', 'SEARCH', 'Prix crypto (ex: bitcoin)', async c => {
  const id = c.args[0].toLowerCase(), d = await get(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
  if (!d[id]) return c.reply('❌ Crypto introuvable. Utilise le nom complet : bitcoin, ethereum...');
  c.reply(`💰 *${id}* : $${d[id].usd.toLocaleString('en-US')}`);
}, { usage: 'bitcoin' });
add('qr', 'TOOLS', 'Générer un QR code', async c => c.sock.sendMessage(c.jid, { image: await get('https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=' + encodeURIComponent(c.text), 'buf'), caption: '✅ QR code' }, { quoted: c.m }), { usage: '<texte ou lien>' });
add('tts', 'TOOLS', 'Texte en voix (ex: .tts fr bonjour)', async c => {
  let lang = 'fr', t = c.text; if (/^[a-z]{2}$/i.test(c.args[0] || '') && c.args.length > 1) { lang = c.args[0].toLowerCase(); t = c.args.slice(1).join(' '); }
  const buf = await get(`https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(t.slice(0, 200))}`, 'buf');
  c.sock.sendMessage(c.jid, { audio: buf, mimetype: 'audio/mpeg', ptt: false }, { quoted: c.m });
}, { usage: '[fr/en/ht] <texte>' });
add('shorten', 'TOOLS', 'Raccourcir un lien', async c => c.reply('🔗 ' + (await get('https://is.gd/create.php?format=simple&url=' + encodeURIComponent(c.args[0]), 'text'))), { usage: '<lien>' });
add('ip', 'SEARCH', 'Infos sur une IP', async c => {
  const d = await get('https://ipwho.is/' + encodeURIComponent(c.args[0])); if (!d.success) return c.reply('❌ IP invalide.');
  c.reply(`🌐 *${d.ip}*\n🏳️ ${d.country}, ${d.region}, ${d.city}\n📡 ${d.connection?.isp || '-'}\n🕒 ${d.timezone?.id || '-'}`);
}, { usage: '8.8.8.8' });
add('github', 'SEARCH', 'Profil GitHub', async c => {
  const d = await get('https://api.github.com/users/' + encodeURIComponent(c.args[0]));
  c.reply(`🐙 *${d.name || d.login}* (@${d.login})\n📝 ${d.bio || '-'}\n📦 Repos : ${d.public_repos}\n👥 Followers : ${d.followers}\n🔗 ${d.html_url}`);
}, { usage: '<utilisateur>' });
add('npm', 'SEARCH', 'Infos sur un paquet npm', async c => {
  const d = await get('https://registry.npmjs.org/' + encodeURIComponent(c.args[0]) + '/latest');
  c.reply(`📦 *${d.name}* v${d.version}\n${d.description || ''}`);
}, { usage: '<paquet>' });
add('currency', 'SEARCH', 'Conversion (ex: .currency 100 USD HTG)', async c => {
  const [a, f, t] = [parseFloat(c.args[0]), (c.args[1] || '').toUpperCase(), (c.args[2] || '').toUpperCase()];
  if (isNaN(a) || !f || !t) return c.reply('ℹ️ Usage : *.currency 100 USD HTG*');
  const d = await get('https://open.er-api.com/v6/latest/' + f); if (!d.rates || !d.rates[t]) return c.reply('❌ Devise inconnue.');
  c.reply(`💱 ${a} ${f} = *${(a * d.rates[t]).toFixed(2)} ${t}*`);
});
add('dog', 'FUN', 'Photo de chien', async c => c.sock.sendMessage(c.jid, { image: { url: (await get('https://dog.ceo/api/breeds/image/random')).message }, caption: '🐶' }, { quoted: c.m }));

/* ───────── AI (8) ───────── */
const askAI = async p => (await get('https://text.pollinations.ai/' + encodeURIComponent(p.slice(0, 1800)) + '?model=openai', 'text')).trim();
const A = (name, desc, usage, mk) => add(name, 'AI', desc, async c => { c.react('🤖'); c.reply(await askAI(mk(c.text))); }, { usage });
A('ai', 'Poser une question à l\'IA', '<question>', t => `Réponds de façon claire et concise, dans la langue de la question.\n\n${t}`);
A('summarize', 'Résumer un texte', '<texte>', t => `Résume ce texte en quelques phrases, dans sa langue :\n\n${t}`);
A('explain', 'Expliquer simplement', '<sujet>', t => `Explique simplement, avec un exemple, dans la langue du sujet :\n\n${t}`);
A('code', 'Générer du code', '<ce que tu veux>', t => `Écris le code demandé, avec une courte explication :\n\n${t}`);
A('rewrite', 'Réécrire / corriger un texte', '<texte>', t => `Corrige et améliore ce texte sans changer sa langue :\n\n${t}`);
A('ideas', 'Brainstorming d\'idées', '<sujet>', t => `Donne 7 idées originales et concrètes sur ce sujet, dans sa langue :\n\n${t}`);
A('story', 'Courte histoire', '<thème>', t => `Écris une courte histoire (150 mots max) dans la langue du thème :\n\n${t}`);
add('imagine', 'AI', 'Générer une image', async c => {
  c.react('🎨');
  const buf = await get('https://image.pollinations.ai/prompt/' + encodeURIComponent(c.text.slice(0, 500)) + '?width=768&height=768&nologo=true', 'buf');
  c.sock.sendMessage(c.jid, { image: buf, caption: '🎨 ' + c.text }, { quoted: c.m });
}, { usage: '<description>' });

/* ───────── DOWNLOAD (8) ───────── */
const MAX = 45 * 1024 * 1024;
const fetchFile = async u => {
  const r = await fetch(u, { signal: AbortSignal.timeout(60000), headers: { 'user-agent': 'MISTER-MD' } });
  if (!r.ok) throw new Error('Téléchargement impossible (HTTP ' + r.status + ')');
  if (+r.headers.get('content-length') > MAX) throw new Error('Fichier trop gros (max 45 Mo).');
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX) throw new Error('Fichier trop gros (max 45 Mo).');
  return { buf, mime: (r.headers.get('content-type') || 'application/octet-stream').split(';')[0] };
};
const isUrl = u => /^https?:\/\/\S+$/i.test(u || '');
add('tiktok', 'DOWNLOAD', 'Vidéo TikTok sans filigrane', async c => {
  if (!isUrl(c.args[0])) return c.reply('ℹ️ Usage : *.tiktok https://vm.tiktok.com/xxxx*');
  c.react('📥');
  const d = await get('https://www.tikwm.com/api/?url=' + encodeURIComponent(c.args[0]));
  if (!d.data || !d.data.play) return c.reply('❌ Vidéo introuvable ou service indisponible.');
  c.sock.sendMessage(c.jid, { video: { url: d.data.play }, caption: '🎵 ' + (d.data.title || 'TikTok') }, { quoted: c.m });
});
add('getimage', 'DOWNLOAD', 'Envoyer une image depuis un lien', c => isUrl(c.args[0]) ? c.sock.sendMessage(c.jid, { image: { url: c.args[0] } }, { quoted: c.m }) : c.reply('ℹ️ Usage : *.getimage <lien>*'));
add('getvideo', 'DOWNLOAD', 'Envoyer une vidéo depuis un lien', c => isUrl(c.args[0]) ? c.sock.sendMessage(c.jid, { video: { url: c.args[0] } }, { quoted: c.m }) : c.reply('ℹ️ Usage : *.getvideo <lien>*'));
add('getaudio', 'DOWNLOAD', 'Envoyer un audio depuis un lien', c => isUrl(c.args[0]) ? c.sock.sendMessage(c.jid, { audio: { url: c.args[0] }, mimetype: 'audio/mpeg' }, { quoted: c.m }) : c.reply('ℹ️ Usage : *.getaudio <lien>*'));
add('getfile', 'DOWNLOAD', 'Envoyer un fichier depuis un lien', async c => {
  if (!isUrl(c.args[0])) return c.reply('ℹ️ Usage : *.getfile <lien>*');
  const { buf, mime } = await fetchFile(c.args[0]);
  c.sock.sendMessage(c.jid, { document: buf, mimetype: mime, fileName: decodeURIComponent(c.args[0].split('?')[0].split('/').pop() || 'fichier') }, { quoted: c.m });
});
add('gitclone', 'DOWNLOAD', 'Télécharger un dépôt GitHub (zip)', async c => {
  const m = (c.args[0] || '').match(/(?:github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  if (!m) return c.reply('ℹ️ Usage : *.gitclone user/repo*');
  c.react('📥');
  const { buf } = await fetchFile(`https://api.github.com/repos/${m[1]}/${m[2]}/zipball`);
  c.sock.sendMessage(c.jid, { document: buf, mimetype: 'application/zip', fileName: m[2] + '.zip' }, { quoted: c.m });
});
add('npmdl', 'DOWNLOAD', 'Télécharger un paquet npm (.tgz)', async c => {
  if (!c.args[0]) return c.reply('ℹ️ Usage : *.npmdl <paquet>*');
  const d = await get('https://registry.npmjs.org/' + encodeURIComponent(c.args[0]) + '/latest');
  const { buf } = await fetchFile(d.dist.tarball);
  c.sock.sendMessage(c.jid, { document: buf, mimetype: 'application/gzip', fileName: `${d.name.replace('/', '-')}-${d.version}.tgz` }, { quoted: c.m });
});
add('wallpaper', 'DOWNLOAD', 'Fond d\'écran aléatoire', async c => c.sock.sendMessage(c.jid, { image: (await fetchFile('https://picsum.photos/1080/1920')).buf, caption: '🖼️ Wallpaper' }, { quoted: c.m }));

/* ───────── STICKER (6) ───────── */
const makeSticker = async (buf, pack, author, type) => {
  const { Sticker } = require('wa-sticker-formatter');
  return new Sticker(buf, { pack, author, type, quality: 60 }).toBuffer();
};
const stk = (name, desc, type) => add(name, 'STICKER', desc, async c => {
  const md = await c.getMedia(['imageMessage', 'videoMessage']);
  if (!md) return c.reply(`ℹ️ Envoie une image (ou réponds à une image) avec *${c.prefix}${name}*`);
  if (md.type === 'videoMessage') return c.reply('⚠️ Seules les images sont supportées pour les stickers.');
  c.sock.sendMessage(c.jid, { sticker: await makeSticker(md.buf, c.text || config.botName, config.ownerName, type) }, { quoted: c.m });
});
stk('sticker', 'Image en sticker (recadré)', 'crop');
stk('stickerfull', 'Image en sticker (entier)', 'full');
stk('stickercircle', 'Image en sticker rond', 'circle');
add('take', 'STICKER', 'Changer le nom du pack d\'un sticker', async c => {
  const md = await c.getMedia(['stickerMessage']); if (!md) return c.reply(`ℹ️ Réponds à un sticker : *${c.prefix}take Pack | Auteur*`);
  const [pack, author] = c.text.split('|').map(x => x.trim());
  c.sock.sendMessage(c.jid, { sticker: await makeSticker(md.buf, pack || config.botName, author || config.ownerName, 'full') }, { quoted: c.m });
});
add('toimg', 'STICKER', 'Sticker en image', async c => {
  const md = await c.getMedia(['stickerMessage']); if (!md) return c.reply(`ℹ️ Réponds à un sticker avec *${c.prefix}toimg*`);
  c.sock.sendMessage(c.jid, { image: await require('sharp')(md.buf).png().toBuffer() }, { quoted: c.m });
});
add('stickerurl', 'STICKER', 'Lien d\'image en sticker', async c => {
  if (!isUrl(c.args[0])) return c.reply('ℹ️ Usage : *.stickerurl <lien image>*');
  c.sock.sendMessage(c.jid, { sticker: await makeSticker((await fetchFile(c.args[0])).buf, config.botName, config.ownerName, 'full') }, { quoted: c.m });
});

module.exports = cmds;
