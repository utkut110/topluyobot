const TOKEN = require("./.token.json");
const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

const API = "https://topluyo.com/!api";
let ws;

function post(endpoint, data) {
    const body = JSON.stringify(data);
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(API + endpoint);
        const lib = parsedUrl.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Authorization': `Bearer ${TOKEN}`
            }
        };
        const req = lib.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(responseData)); }
                catch { resolve(responseData); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function send(channel_id, text) {
    return post("/post/add", { channel_id, code: "", text });
}

function dm(user_id, message) {
    return post("/message/send", { user_id, message });
}

async function getGroupId(channel_id) {
    const ch = await post("/channel/get", { channel_id });
    return ch?.data?.group_id || null;
}

async function checkPerm(group_id, user_id, perm) {
    const p = await post("/permission/power", { group_id, user_id });
    return p && p[perm] ? true : false;
}

const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({
        hosgeldin_channel_id: null,
        gorusuruz_channel_id: null
    }, null, 2));
}

function getConfig() {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

const commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
if (!fs.existsSync(commandsPath)) fs.mkdirSync(commandsPath);
fs.readdirSync(commandsPath).filter(f => f.endsWith('.js')).forEach(file => {
    const command = require(path.join(commandsPath, file));
    commands.set(command.name, command);
});
console.log(`✅ ${commands.size} komut yüklendi:`, [...commands.keys()].join(', '));

function connect() {
    ws = new WebSocket('wss://topluyo.com/!bot');

    ws.on('open', () => {
        console.log('✅ Bağlantı açıldı');
        ws.send(TOKEN);
        setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.ping();
        }, 30000);
    });

    ws.on('message', (data) => {
        try {
            const event = JSON.parse(data);

            const text = event.message?.trim();
            if (!text?.startsWith('!')) return;

            const args = text.slice(1).split(' ');
            const commandName = args.shift().toLowerCase();
            const command = commands.get(commandName);
            if (!command) return;

            command.execute({
                event,
                args,
                send,
                dm,
                post,
                getGroupId,
                checkPerm,
                getConfig
            });
        } catch (err) {
            console.error('❌ Message hatası:', err.message);
        }
    });

    ws.on('close', () => {
        console.log('❌ Bağlantı kapandı, yeniden bağlanıyor...');
        setTimeout(connect, 5000);
    });

    ws.on('error', (err) => {
        console.error('❌ Hata:', err.message);
    });
}

connect();
