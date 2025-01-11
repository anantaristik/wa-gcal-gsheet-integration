const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { getUpcomingEvents, getEventDetails, getEventReminder, addEventToCalendar } = require('./googleCalendar');
const { getUpcomingDeadlines, getSheetList, getLastDeadlines, getPostDetailByCode } = require('./googleSheets');
const moment = require('moment-timezone');
const path = require('path');

// Initiate
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './sessions' }),
    
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: '/usr/bin/chromium-browser', // Path Chromium Anda
    },
});

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr, { small: true });
});

// Path for sentReminders
const remindersFilePath = path.join(__dirname, 'sentReminders.json');

// Read last reminders
function loadSentReminders() {
    if (fs.existsSync(remindersFilePath)) {
        return JSON.parse(fs.readFileSync(remindersFilePath, 'utf-8'));
    }
    return [];
}

// save reminders
function saveSentReminders(reminders) {
    fs.writeFileSync(remindersFilePath, JSON.stringify(reminders, null, 2), 'utf-8');
}

// Fungsi untuk mengirim sticker
async function sendSticker(chatId, stickerName) {
    try {
        const stickerPath = path.join(__dirname, '..', 'stickers', `${stickerName}.webp`);
        if (!fs.existsSync(stickerPath)) {
            throw new Error(`Sticker "${stickerName}" tidak ditemukan!`);
        }

        const fileData = fs.readFileSync(stickerPath, { encoding: 'base64' });
        const mimeType = 'image/webp';
        const media = new MessageMedia(mimeType, fileData, `${stickerName}.webp`);

        await client.sendMessage(chatId, media, { sendMediaAsSticker: true });
        console.log(`Sticker "${stickerName}" sent successfully!`);
    } catch (error) {
        console.error(`Error sending sticker "${stickerName}":`, error.message);
    }
}

// Fungsi untuk mengirim pesan tagall
async function sendTagAllMessage(chat, allowedUserIds) {
    let text = '';
    let mentions = [];

    allowedUserIds.forEach(userId => {
        const userPhone = userId.split('@')[0]; // Ambil nomor telepon tanpa @c.us
        text += `@${userPhone} `;
        mentions.push(userPhone + '@c.us'); // Format yang benar untuk mention
    });

    await chat.sendMessage(text, { mentions: mentions });
}

// Fungsi untuk memproses pengingat acara
async function processEventReminders(sentReminders) {
    const eventReminder = await getEventReminder(); // Ambil pengingat acara
    if (eventReminder) {
        const now = moment();
        const reminderTime = moment(eventReminder.startDate, 'D MMMM YYYY, HH:mm').subtract(5, 'minutes'); // Reminder 5 menit sebelum acara

        // Cek apakah pengingat sudah dikirim sebelumnya
        const isAlreadySent = sentReminders.includes(eventReminder.id);

        if (!isAlreadySent && now.isAfter(reminderTime)) {
            const message = `Reminder: ${eventReminder.summary} will start at ${moment(eventReminder.startDate, 'D MMMM YYYY, HH:mm').tz('Asia/Jakarta').format('D MMMM YYYY, HH:mm')}. Don't miss it!`;
            await client.sendMessage('120363347261488236@g.us', message);
            console.log(`Reminder sent for event: ${eventReminder.summary}`);

            // Tambahkan ID acara ke daftar pengingat yang sudah terkirim
            sentReminders.push(eventReminder.id);
            saveSentReminders(sentReminders); // Simpan ke file
        }
    }
}

// Fungsi untuk menampilkan perintah bantuan
function showHelp(msg) {
    const helpText = `
*Available Commands:*

1. *!all*: Tag all users in the allowed group.
2. *!groupid*: Show the group ID.
3. *!userid*: Show your user ID or the ID of mentioned participants.
4. *!events [query]*: List upcoming events or search events by query.
5. *!jadwalpost [sheet name]*: Show upcoming or last deadlines for a specific sheet.
6. *!detail [sheet name] [code]*: Get detailed information about a specific post by code.

For more information, feel free to ask!`;

    msg.reply(helpText);
}

// KODE INTI -------------------------------------------------------

client.on('ready', async () => {
    console.log('Client is ready!');
    console.log("WhatsApp Web v", await client.getWWebVersion());
    console.log("WWebJS v", require("whatsapp-web.js").version);

    let sentReminders = loadSentReminders(); // Muat pengingat yang sudah terkirim dari file

    setInterval(async () => {
        try {
            await processEventReminders(sentReminders);
        } catch (error) {
            console.error('Error checking for reminders:', error);
        }
    }, 30000); // Cek setiap 30 detik
});

// Mengolah pesan yang masuk
client.on('message', async (msg) => {
    // Perintah umum
    if (msg.body === '!help') {
        showHelp(msg);
    }

    if (msg.from.includes('@g.us')) {
        const allowedGroupIds = [
            '120363347261488236@g.us',
            '120363346334583188@g.us',
            '120363334935442748@g.us',
        ];
    
        // Jika perintah adalah `!all` dan berasal dari grup yang diizinkan
        if (msg.body === '!all') {
    
            if (!allowedGroupIds.includes(msg.from)) {

                await msg.reply('You do not have permission to use this command in this group.');
                return;
            }
    
            try {
                const chat = await msg.getChat();
                // Daftar user ID yang diizinkan untuk di-tag
                const allowedUserIds = [
                    '6281295309233@c.us', 
                    '6281392505769@c.us',
                    '6287777951101@c.us',
                    '6282246408705@c.us',
                    '6281513041151@c.us',
                ];
    
                // Kirim pesan tag-all
                await sendTagAllMessage(chat, allowedUserIds);
                console.log('Tag all message sent successfully!');
            } catch (error) {
                console.error('Error handling !all command:', error);
                await msg.reply('An error occurred while sending the tag-all message.');
            }
        }

        // Other group-specific commands
        if (msg.body === '!groupid') {
            msg.reply(`Group ID: ${msg.from}`);
        } else if (msg.body.startsWith('!userid')) {
            const mentionedParticipants = await msg.getMentions();
            const userIds = mentionedParticipants.length > 0
                ? mentionedParticipants.map(participant => `@${participant.id.user}`).join('\n')
                : `Your User ID: ${msg.author || msg.from}`;
            msg.reply(`User IDs:\n${userIds}`);
        }
    } else {
        // Commands for individual chats
        if (msg.body === '!groupid' || msg.body === '!all') {
            msg.reply('This command works only in groups!');
        } else if (msg.body === '!userid') {
            msg.reply(`Your User ID: ${msg.from}`);
        } 
    }

    // Kirim Sticker
    const stickerCommands = {
        '!dea': 'dea',
        '!dimas': 'dimas',
        '!ananta': 'ananta'
    };

    if (stickerCommands[msg.body]) {
        await sendSticker(msg.from, stickerCommands[msg.body]);
    }

    // Events Command
    if (msg.body.startsWith('!events')) {
        const query = msg.body.slice(8).trim();
        try {
            const events = await getUpcomingEvents(5); // Ambil 5 event terdekat
            if (query) {
                const matchedEvent = events.find(event => event.summary.toLowerCase().includes(query.toLowerCase()));
                if (matchedEvent) {
                    const eventDetails = await getEventDetails(matchedEvent.id);
                    msg.reply(eventDetails);
                } else {
                    msg.reply('Event tidak ditemukan.');
                }
            } else {
                const eventList = events.map(event => `• ${event.summary} - ${event.startDate} - ${event.endDate}`).join('\n');
                msg.reply(`*UPCOMING EVENTS:*\n\n${eventList}`);
            }
        } catch (error) {
            console.error('Error fetching events:', error);
            msg.reply('There was an error retrieving events. Please try again later.');
        }
    }

    if (msg.body.toLowerCase() === '!jadwalpost') {
        // Menampilkan panduan
        const responseText = `    
*Tracking Client Content*

Berikut perintah yang tersedia untuk *Jadwal Posting*:
1. *!jadwalpost* - Menampilkan daftar perintah jadwal posting.
2. *!jadwalpost klien* - Menampilkan daftar klien yang terdaftar dalam Content Planning.
3. *!jadwalpost [nama_klien]* - Menampilkan jadwal posting mendatang dari klien tertentu.
4. *!jadwalpost [nama_klien] last* - Menampilkan 5 jadwal terakhir dari klien tertentu.
5. *!detail [nama_klien] [kode]* - Menampilkan detail postingan.
6. *!jadwalkan [nama_klien] [kode] [tanggal] [waktu]* - Menjadwalkan postingan ke google calendar

*Contoh Penggunaan:*
- *!jadwalpost klien*
- *!jadwalpost buodeh-1*
- *!jadwalpost buodeh-1 last*
        `.trim();
        await msg.reply(responseText);
    } else if (msg.body.toLowerCase().startsWith('!jadwalpost klien')) {
        // Menampilkan daftar klien
        try {
            const sheetList = await getSheetList();
            if (sheetList.length > 0) {
                let responseText = '*List Klien Content Planning:*\n\n';
                sheetList.forEach((sheet, index) => {
                    responseText += `${index + 1}. ${sheet}\n`;
                });
                await msg.reply(responseText.trim());
            } else {
                await msg.reply('Tidak ada klien yang terdaftar dalam Content Planning.');
            }
        } catch (error) {
            console.error('Error fetching client list:', error);
            await msg.reply('Terjadi kesalahan saat mengambil daftar klien.');
        }
    } else if (msg.body.toLowerCase().startsWith('!jadwalpost')) {
        // Menangani perintah untuk klien tertentu
        const commandParts = msg.body.split(' ');
        const sheetName = commandParts[1]?.toLowerCase();
        const option = commandParts[2]?.toLowerCase();
    
        try {
            // Validasi nama klien
            const sheetList = await getSheetList();
            if (!sheetList.includes(sheetName)) {
                await msg.reply(`Klien "${sheetName}" tidak ditemukan. Gunakan *!jadwalpost klien* untuk melihat daftar klien.`);
                return;
            }
    
            // Menampilkan jadwal
            const deadlines = option === 'last'
                ? await getLastDeadlines(sheetName)
                : await getUpcomingDeadlines(sheetName);
    
            if (deadlines.length > 0) {
                let responseText = `
*JADWAL POSTINGAN ${option === 'last' ? 'TERAKHIR' : 'MENDATANG'} (${sheetName.toUpperCase()}):*\n\n
            `.trim();

            deadlines.forEach((event, index) => {
                responseText += `
${index + 1}. [${event.code}] - ${event.title}
Tanggal: ${event.deadline.format('dddd, MMMM D, YYYY')}
Jenis: ${event.format}
Tipe: ${event.type}
Status: ${event.status || 'Belum Ditentukan'}\n`;
                });
    
                await msg.reply(responseText.trim());
            } else {
                await msg.reply(`Tidak ada jadwal yang ditemukan untuk klien "${sheetName}".`);
            }
        } catch (error) {
            console.error('Error processing client schedule:', error);
            await msg.reply('Terjadi kesalahan saat memproses perintah. Pastikan nama klien atau sheet sesuai.');
        }
    }

    // Handler untuk perintah "!jadwalkan"
    if (msg.body.startsWith('!jadwalkan')) {
        const commandParts = msg.body.split(' ');
        const sheetName = commandParts[1]?.trim();
        const code = commandParts[2]?.trim();
        const date = commandParts[3]?.trim();
        const time = commandParts[4]?.trim();

        if (!sheetName || !code || !date || !time) {
            await msg.reply('Format perintah salah. Gunakan: !jadwalkan [sheet name] [code] [tanggal] [waktu], contoh:\n\n!jadwalkan buodeh-1 VD-S10-P1 11/01/2025 12:00-13:00');
            return;
        }

        try {
            const [startTime, endTime] = time.split('-');
            const eventLink = await addEventToCalendar(sheetName, code, date, startTime, endTime);

            await msg.reply(`Event berhasil dijadwalkan di Google Calendar!\n\nLink: ${eventLink}`);
        } catch (error) {
            console.error('Error scheduling event:', error);
            await msg.reply('Terjadi kesalahan saat menjadwalkan acara. Pastikan format sudah benar dan coba lagi.');
        }
    }
    
    
    // Detail Post Command
    if (msg.body.startsWith('!detail ')) {
        const commandParts = msg.body.split(' ');
        const sheetName = commandParts[1]?.trim();
        const code = commandParts[2]?.trim();

        if (!sheetName || !code) {
            await msg.reply('Format perintah salah. Gunakan: !detail [sheet name] [code]');
            return;
        }

        try {
            const detail = await getPostDetailByCode(sheetName, code.toUpperCase());
            if (detail) {
                const responseText = `
DETAIL [${code}] (Sheet: ${sheetName}):

*Title:*
${detail.title || 'Tidak tersedia'}

*Deadline:*
${detail.deadline ? detail.deadline.format('dddd, MMMM D, YYYY') : 'Tidak tersedia'}

*Format:*
${detail.format || 'Tidak tersedia'}

*Type:*
${detail.type || 'Tidak tersedia'}

*Copy:*
${detail.copy || 'Tidak tersedia'}

*Reference:*
${detail.reference || 'Tidak tersedia'}

*Caption:*
${detail.caption || 'Tidak tersedia'}

*Status:*
${detail.status || 'Tidak tersedia'}
                `.trim();

                await msg.reply(responseText);
            } else {
                await msg.reply(`Detail untuk kode "${code}" tidak ditemukan di sheet "${sheetName}".`);
            }
        } catch (error) {
            console.error('Error fetching post details:', error);
            await msg.reply('Terjadi kesalahan saat mengambil detail postingan.');
        }
    }
});

client.initialize();
