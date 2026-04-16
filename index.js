const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    jidDecode
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const fs = require("fs");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let sock; 

// JID Decode Function
const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    } else return jid;
};

async function startSession(num = null, res = null) {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    // Connection handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            let reason = lastDisconnect?.error?.output?.statusCode;
            console.log("Connection closed, reconnecting... Reason:", reason);
            if (reason !== DisconnectReason.loggedOut) {
                startSession();
            }
        } else if (connection === 'open') {
            console.log('HASHU-MD Connected! ✅');
            
            // --- Inbox එකට පණිවිඩය යැවීමේ කොටස ---
            const userJid = decodeJid(sock.user.id);
            await delay(3000); // සම්බන්ධ වී තත්පර 3ක් ඉන්න
            await sock.sendMessage(userJid, { 
                text: `*HASHU-MD CONNECTED!* ✅\n\n_බොට් සාර්ථකව සම්බන්ධ විය._\n_Commands භාවිතා කිරීමට .menu ලෙස ටයිප් කරන්න._` 
            });
        }
    });

    // --- COMMANDS SECTION ---
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const from = msg.key.remoteJid;
            const text = msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption || "";
            
            const sender = decodeJid(msg.key.participant || msg.key.remoteJid);
            const prefix = "."; 

            if (!text.startsWith(prefix)) return;
            
            const args = text.slice(prefix.length).trim().split(/ +/);
            const cmd = args.shift().toLowerCase();

            // 1. Alive Command
            if (cmd === "alive") {
                await sock.sendMessage(from, { 
                    text: `*👋 HASHU-MD IS ONLINE!*\n\n*User:* @${sender.split('@')[0]}\n*Status:* Running... 🚀`,
                    mentions: [sender]
                }, { quoted: msg });
            }

            // 2. Ping Command
            else if (cmd === "ping") {
                const start = Date.now();
                const { key } = await sock.sendMessage(from, { text: "Checking speed..." });
                const end = Date.now();
                await sock.sendMessage(from, { 
                    text: `*Pong!* 🏓\nLatency: ${end - start}ms`,
                    edit: key 
                });
            }

            // 3. Menu Command
            else if (cmd === "menu" || cmd === "help") {
                let menuText = `*╭───「 HASHU-MD MENU 」*
│
│ *🚀 Public Commands:*
│ ⚡ ${prefix}alive - Check status
│ ⚡ ${prefix}ping - Check speed
│ ⚡ ${prefix}owner - Owner info
│ ⚡ ${prefix}repo - Script link
│
*╰───────────────╼*`;
                await sock.sendMessage(from, { text: menuText }, { quoted: msg });
            }

            // 4. Repo Command
            else if (cmd === "repo") {
                await sock.sendMessage(from, { 
                    text: "*HASHU-MD REPO:* github.com/DarkCyberLeaderz/Hashu-MD" 
                }, { quoted: msg });
            }

            // 5. Owner Command
            else if (cmd === "owner") {
                await sock.sendMessage(from, { 
                    text: "*Owner:* Hashu\n*Contact:* wa.me/947xxxxxxxxx" 
                }, { quoted: msg });
            }

        } catch (err) {
            console.log("Error in commands: ", err);
        }
    });

    // Pairing code logic
    if (num && !sock.authState.creds.registered) {
        try {
            await delay(2000);
            const code = await sock.requestPairingCode(num);
            if (res && !res.headersSent) {
                res.send(`
                <body style="background:#0a0a0a; color:white; text-align:center; padding-top:100px; font-family:sans-serif;">
                    <div style="border: 2px solid #00d4ff; display:inline-block; padding: 40px; border-radius: 15px;">
                        <h2 style="color:#00d4ff;">YOUR PAIRING CODE</h2>
                        <h1 style="letter-spacing: 8px; font-size: 50px; background:#222; padding:10px;">${code}</h1>
                        <p>Link your WhatsApp now.</p>
                    </div>
                </body>`);
            }
        } catch (e) {
            console.error("Pairing Error:", e);
            if (res && !res.headersSent) res.send("Error generating code. Please try again.");
        }
    }
}

// --- Web Interface ---
app.get("/", (req, res) => {
    res.send(`
    <html>
    <head><title>Hashuu Pairing</title>
    <style>
        body { background: #0a0a0a; color: #00d4ff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .box { background: #151515; padding: 30px; border-radius: 15px; border: 1px solid #00d4ff; text-align: center; }
        input { padding: 12px; width: 80%; margin-bottom: 20px; border:1px solid #00d4ff; background:#000; color:#fff; text-align:center; }
        button { padding: 12px 25px; background: #00d4ff; border: none; cursor: pointer; font-weight:bold; }
    </style>
    </head>
    <body>
        <div class="box">
            <h2>DARK CYBER PAIRING</h2>
            <form action="/get-code" method="POST">
                <input type="text" name="number" placeholder="947xxxxxxxx" required><br>
                <button type="submit">GET CODE</button>
            </form>
        </div>
    </body>
    </html>`);
});

app.post("/get-code", async (req, res) => {
    let num = req.body.number.replace(/[^0-9]/g, '');
    if (!num) return res.send("Invalid Number!");
    await startSession(num, res);
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
    startSession(); 
});
