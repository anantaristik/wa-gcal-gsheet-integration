const { google } = require('googleapis');
const { authenticateWithServiceAccount } = require('./googleAuth');
const moment = require('moment-timezone');

// Fungsi untuk mengambil upcoming events
async function getUpcomingEvents(maxResults = 5) {
    const auth = await authenticateWithServiceAccount();
    const calendar = google.calendar({ version: 'v3', auth });

    const now = new Date().toISOString();

    try {
        // Mengambil list event dari Google Calendar
        const response = await calendar.events.list({
            calendarId: 'toogatherid@gmail.com', // Ganti dengan ID Kalender yang sesuai
            timeMin: now,
            maxResults,
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = response.data.items || [];
        if (events.length === 0) {
            return [];
        }

        // Format tanggal dan waktu dengan end date
        const formattedEvents = events.map(event => {
            // Validasi keberadaan start dan end
            if (!event.start || (!event.start.dateTime && !event.start.date)) {
                console.warn("Event missing start date:", event);
                return `• ${event.summary || 'No title'} - Invalid start date`;
            }

            const start = event.start.dateTime || event.start.date;
            const end = event.end?.dateTime || event.end?.date;

            // Konversi waktu ke GMT+7 (WIB)
            const startDate = moment(start).tz('Asia/Jakarta').format('D MMMM YYYY, HH:mm');
            const endDate = end ? moment(end).tz('Asia/Jakarta').format('HH:mm') : 'N/A';

            return { 
                id: event.id, 
                summary: event.summary || 'No title', 
                startDate, 
                endDate 
            };
        });

        return formattedEvents;
    } catch (error) {
        console.error("Error fetching events:", error);
        throw error;
    }
}

// Fungsi untuk mengambil detail dari event
async function getEventDetails(eventId) {
    const auth = await authenticateWithServiceAccount(); // pastikan Anda menggunakan autentikasi yang benar
    const calendar = google.calendar({ version: 'v3', auth });

    try {
        // Mengambil detail event berdasarkan eventId
        const event = await calendar.events.get({
            calendarId: 'toogatherid@gmail.com', // Ganti dengan ID Kalender yang sesuai
            eventId: eventId,
        });

        const eventDetails = event.data;

        // Format detail event
        return `*EVENT DETAILS*\n\n` +
               `*Title*: ${eventDetails.summary || 'No title'}\n` +
               `*Description*: ${eventDetails.description || 'No description available'}\n` +
               `*Start*: ${moment(eventDetails.start.dateTime || eventDetails.start.date).tz('Asia/Jakarta').format('D MMMM YYYY, HH:mm')} (WIB)\n` +
               `*End*: ${moment(eventDetails.end.dateTime || eventDetails.end.date).tz('Asia/Jakarta').format('HH:mm')} (WIB)\n` +
               `*Location*: ${eventDetails.location || 'No location available'}`;
    } catch (error) {
        console.error('Error fetching event details:', error);
        return 'Error retrieving event details. Please try again later.';
    }
}

async function getEventReminder() {
    const events = await getUpcomingEvents(10); // Ambil lebih dari 5 event
    const now = moment();
    const reminderTime = now.clone().add(5, 'minutes'); // 5 menit dari sekarang

    // Filter untuk event yang dimulai dalam 5 menit ke depan
    const upcomingEvent = events.filter(event => {
        const startTime = moment(event.startDate, 'D MMMM YYYY, HH:mm');  // Mengonversi startDate ke objek moment
        return startTime.isBetween(now, reminderTime);
    });

    // Jika ada event yang ditemukan, ambil yang pertama yang paling dekat
    if (upcomingEvent.length > 0) {
        const closestEvent = upcomingEvent[0];  // Ambil event yang paling pertama
        return closestEvent;
    }

    return null; // Tidak ada event dalam 5 menit ke depan
}

// Fungsi untuk menambahkan acara ke Google Calendar
async function addEventToCalendar(sheetName, code, startDate, startTime, endTime) {
    try {
        const auth = await authenticateWithServiceAccount();
        const calendar = google.calendar({ version: 'v3', auth });

        // Format tanggal dan waktu
        const startDateTime = moment.tz(`${startDate} ${startTime}`, 'DD/MM/YYYY HH:mm', 'Asia/Jakarta').toISOString();
        const endDateTime = moment.tz(`${startDate} ${endTime}`, 'DD/MM/YYYY HH:mm', 'Asia/Jakarta').toISOString();

        // Data acara
        const event = {
            summary: `Posting ${sheetName} [${code}]`,
            description: `Post untuk klien ${sheetName} dengan kode ${code}`,
            start: { dateTime: startDateTime, timeZone: 'Asia/Jakarta' },
            end: { dateTime: endDateTime, timeZone: 'Asia/Jakarta' },
        };

        // Menambahkan acara ke kalender
        const response = await calendar.events.insert({
            calendarId: 'toogatherid@gmail.com', // Ubah jika menggunakan kalender lain
            resource: event,
        });

        console.log('Event created:', response.data.htmlLink);
        return response.data.htmlLink;
    } catch (error) {
        console.error('Error adding event to calendar:', error);
        throw new Error('Gagal menambahkan acara ke Google Calendar.');
    }
}


module.exports = { getUpcomingEvents, getEventDetails, getEventReminder, addEventToCalendar };
