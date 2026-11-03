const fs = require('fs'), path = require('path');
const config = require('../config');
const dir = path.join(__dirname, '..', 'data');
const file = path.join(dir, 'settings.json');
const def = { prefix: config.prefix, mode: 'public', autoread: false, autotyping: false, antilink: {}, welcome: {}, warns: {} };
const data = { ...def };
try { Object.assign(data, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch {}
const save = () => { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 1)); } catch {} };
module.exports = { data, save };
