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
            range: `${sheetName}!A1:J`, // Menyesuaikan dengan kolom di format baru
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

// Fungsi untuk mengambil daftar sheet dalam spreadsheet
async function getSheetList() {
    const auth = await authenticateWithServiceAccount();
    const sheets = google.sheets({ version: 'v4', auth });

    try {
        // Mengambil metadata spreadsheet
        const response = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetNames = response.data.sheets.map(sheet => sheet.properties.title);

        return sheetNames;
    } catch (error) {
        console.error('Error fetching sheet list:', error);
        return [];
    }
}

// Fungsi untuk mencari 5 jadwal terdekat berdasarkan deadline
async function getUpcomingDeadlines(sheetName) {
    const rows = await getContentPlanningData(sheetName);

    // Skip header (baris pertama) dan filter data berdasarkan tanggal deadline
    const now = moment().startOf('day'); // Mulai dari awal hari ini
    const upcomingDeadlines = rows.slice(1) // Mengabaikan header
        .map(row => {
            const code = row[0];
            const format = row[1];
            const deadline = moment(row[2], 'M/D/YYYY'); // Parsing tanggal deadline
            const type = row[3];
            const title = row[4];
            const status = row[9];

            // Hanya ambil yang deadline-nya lebih dari atau sama dengan sekarang
            if (deadline.isSameOrAfter(now)) {
                return { code, title, deadline, format, type, status };
            }

            return null;
        })
        .filter(event => event !== null)
        .sort((a, b) => a.deadline - b.deadline); // Urutkan berdasarkan tanggal deadline

    // Ambil 5 jadwal terdekat
    return upcomingDeadlines.slice(0, 5);
}

// Fungsi untuk mencari 5 jadwal terakhir berdasarkan deadline
async function getLastDeadlines(sheetName) {
    const rows = await getContentPlanningData(sheetName);

    // Skip header (baris pertama) dan filter data berdasarkan tanggal deadline
    const now = moment();
    const lastDeadlines = rows.slice(1) // Mengabaikan header
        .map(row => {
            const code = row[0];
            const format = row[1];
            const deadline = moment(row[2], 'M/D/YYYY'); // Parsing tanggal deadline
            const type = row[3];
            const title = row[4];
            const status = row[9];

            // Hanya ambil yang deadline-nya sebelum sekarang
            if (deadline.isBefore(now)) {
                return { code, title, deadline, format, type, status };
            }

            return null;
        })
        .filter(event => event !== null)
        .sort((a, b) => b.deadline - a.deadline); // Urutkan berdasarkan tanggal deadline (desc)

    // Ambil 5 jadwal terakhir
    return lastDeadlines.slice(0, 5);
}

// Fungsi untuk mengambil detail postingan berdasarkan kode
async function getPostDetailByCode(sheetName, code) {
    const rows = await getContentPlanningData(sheetName);

    // Skip header dan cari baris dengan kode yang cocok
    const row = rows.slice(1).find(row => row[0] === code); // Kolom pertama adalah kode

    if (!row) {
        return null; // Tidak ditemukan
    }

    // Mapping data ke object
    return {
        code: row[0],
        format: row[1],
        deadline: moment(row[2], 'M/D/YYYY'), // Parsing tanggal
        type: row[3],
        title: row[4],
        copy: row[5],
        details: row[6],
        reference: row[7],
        caption: row[8],
        status: row[9]
    };
}

module.exports = { getUpcomingDeadlines, getSheetList, getLastDeadlines, getPostDetailByCode };
