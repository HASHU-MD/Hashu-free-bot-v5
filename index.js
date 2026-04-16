const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    DisconnectReason 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// Express server එක setup කිරීම (Deploy කළාම වැඩ කරන්න)
app.get("/", (req, res) => {
    res.send("<h1>HASHU-MD Bot is Running!</h1><p>Pairing code system is active.</p>");
});

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

async function startBot() {
    // Session දත්ත 'session' කියන folder එකේ save වේ
    const { state, saveCreds } = await useMultiFileAuthState('session');
    
    const conn = makeWASocket({
        auth: state,
        printQRInTerminal: false, // QR පෙන්වන්නේ නැත
        logger: pino({ level: "silent" }), // අනවශ්‍ය logs පෙන්වීම නවත්වයි
        browser: ["Ubuntu", "Chrome", "20.0.04"] // WhatsApp එකට පේන browser එක
    });

    // Pairing Code එකක් ලබා ගැනීම
    if (!conn.authState.creds.registered) {
        // මෙතනට ඔයාගේ phone number එක (Country code එකත් එක්ක - 94xxxxxxxxx)
        let phoneNumber = "947xxxxxxxx"; 
        
        // තත්පර 3ක් ඉඳලා code එක request කරනවා
        await delay(3000);
        let code = await conn.requestPairingCode(phoneNumber);
        
        console.log("----------------------------");
        console.log("ඔයාගේ Pairing Code එක: " + code);
        console.log("----------------------------");
    }

    // Connection එකේ වෙනස්කම් පරික්ෂා කිරීම
    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('HASHU-MD Connected Successfully! ✅');
        }
    });

    // Alive Plugin එක (සරලව)
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (text === '.alive') {
            await conn.sendMessage(msg.key.remoteJid, { 
                text: "*HASHU-MD IS ALIVE!* 🚀\n\n*Team:* Dark Cyber Leaderz\n*Status:* Connected Successfully",
            });
        }
    });

    conn.ev.on('creds.update', saveCreds);
}

// බොට්ව ආරම්භ කිරීම
startBot().catch(err => console.log("Error starting bot: " + err));
