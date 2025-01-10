const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Fungsi untuk autentikasi menggunakan Service Account
async function authenticateWithServiceAccount() {
    const credentialsPath = path.resolve('credentials.json'); 
    let credentials;

    try {
        // Membaca file credentials.json
        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`File credentials.json tidak ditemukan di ${credentialsPath}`);
        }
        credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    } catch (error) {
        console.error('Gagal membaca file credentials.json:', error);
        throw new Error('Gagal membaca atau mem-parsing file credentials.json');
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
            'https://www.googleapis.com/auth/calendar',    // Scope untuk Calendar API
            'https://www.googleapis.com/auth/spreadsheets', // Scope untuk Sheets API
        ],
    });

    try {
        const client = await auth.getClient();
        return client;
    } catch (error) {
        console.error('Error saat autentikasi dengan Google API:', error);
        throw new Error('Autentikasi gagal, periksa kembali credentials Anda');
    }
}

module.exports = { authenticateWithServiceAccount };
