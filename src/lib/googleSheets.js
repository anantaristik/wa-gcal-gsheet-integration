const { google } = require('googleapis');
const { authenticateWithServiceAccount } = require('./googleAuth');
const moment = require('moment-timezone');

// Spreadsheet ID
const spreadsheetId = '1St-DLxf-pqkh-7SFeMzRlXgPwf0gXAcFu2KANPwK3CI';

// Fungsi untuk mengambil data dari Google Sheets
async function getContentPlanningData(sheetName) {
    const auth = await authenticateWithServiceAccount();
    const sheets = google.sheets({ version: 'v4', auth });

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:K`, // Menyesuaikan range dengan data baru
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found.');
            return [];
        }

        return rows;
    } catch (error) {
        console.error('Error fetching spreadsheet data:', error);
        return [];
    }
}

// Fungsi untuk mencari jadwal postingan mendatang
async function getUpcomingDeadlines(sheetName) {
    const rows = await getContentPlanningData(sheetName);

    // Skip header dan filter data berdasarkan deadline
    const now = moment().startOf('day');
    const upcomingDeadlines = rows.slice(1)
        .map(row => {
            const code = row[0];
            const format = row[1];
            const deadline = moment(row[2], 'M/D/YYYY'); // Parsing sesuai format tanggal baru
            const type = row[3];
            const title = row[4];
            const status = row[8];

            if (deadline.isSameOrAfter(now)) {
                return { code, format, deadline, type, title, status };
            }
            return null;
        })
        .filter(event => event !== null)
        .sort((a, b) => a.deadline - b.deadline)
        .slice(0, 5); // Ambil 5 jadwal terdekat

    // Format output untuk pengiriman ke WhatsApp
    return upcomingDeadlines.map((event, index) => {
        const formattedDate = event.deadline.format('dddd, MMMM D, YYYY');
        return `${index + 1}. [${event.code}] - ${event.title}\nTanggal: ${formattedDate}\nJenis: ${event.type}\nTipe: ${event.format}\nStatus: ${event.status || 'Belum Ditentukan'}\n`;
    }).join('\n');
}

module.exports = { getUpcomingDeadlines, getSheetList, getLastDeadlines, getPostDetailByCode };
