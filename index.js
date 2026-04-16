const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason,
    jidDecode
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));

let conn; 

// --- WhatsApp Connection Logic ---
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    conn = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Dark Cyber", "Chrome", "1.0.0"]
    });

    conn.ev.on('creds.update', saveCreds);

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('HASHU-MD Connected Successfully! ✅');
        }
    });

    // --- Commands logic මෙතන තියෙන්නේ ---
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const prefix = "."; // Commands පටන් ගන්න සලකුණ

        // 1. Alive Command
        if (text === prefix + "alive") {
            await conn.sendMessage(from, { 
                text: "*HASHU-MD IS ONLINE!* 🚀\n\n*Team:* Dark Cyber Leaderz\n*Status:* System Stable" 
            }, { quoted: msg });
        }

        // 2. Ping Command
        if (text === prefix + "ping") {
            const start = Date.now();
            await conn.sendMessage(from, { text: "Testing speed..." });
            const end = Date.now();
            await conn.sendMessage(from, { text: `*Pong!* 🏓\nSpeed: ${end - start}ms` });
        }

        // 3. Owner Command
        if (text === prefix + "owner") {
            await conn.sendMessage(from, { text: "*Owner:* Hashu-MD\n*Team:* World Best Developers" });
        }
    });
}

// --- HTML Web Interface ---
app.get("/", (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="si">
    <head>
        <title>Hashuu Pairing</title>
        <style>
            body { background: #0a0a0a; color: #00d4ff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .box { background: #151515; padding: 30px; border-radius: 15px; border: 1px solid #00d4ff; text-align: center; box-shadow: 0 0 20px #00d4ff; }
            input { padding: 12px; border-radius: 5px; border: none; width: 80%; margin-bottom: 20px; text-align: center; }
            button { padding: 12px 25px; background: #00d4ff; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="box">
            <h2>DARK CYBER PAIRING</h2>
            <form action="/get-code" method="POST">
                <input type="text" name="number" placeholder="947xxxxxxxx" required>
                <br>
                <button type="submit">GET PAIRING CODE</button>
            </form>
        </div>
    </body>
    </html>
    `);
});

app.post("/get-code", async (req, res) => {
    const num = req.body.number;
    if (!num) return res.send("Please enter a phone number!");

    try {
        if (!conn) await connectToWhatsApp();
        await delay(2000);
        const code = await conn.requestPairingCode(num);
        res.send(`
            <body style="background:#0a0a0a; color:white; text-align:center; padding-top:100px; font-family:sans-serif;">
                <h1 style="color:#00d4ff;">YOUR CODE: ${code}</h1>
                <p>Enter this in your WhatsApp Link Device section.</p>
                <a href="/" style="color:#00d4ff;">Back</a>
            </body>
        `);
    } catch (err) {
        res.send("Error: " + err.message);
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    connectToWhatsApp(); 
});
