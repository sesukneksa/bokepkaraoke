// scripts/notify-indexnow.js
import fetch from 'node-fetch';
import fs from 'fs/promises'; // Import fs/promises untuk async file operations
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Konfigurasi Anda ---
const YOUR_DOMAIN = 'https://bokepkaraoke.pages.dev'; // Replace with your actual domain
const API_KEY_NAME = '0ddba14269f0446280912b339a1e17a2'; // Replace with your GUID
const API_KEY_LOCATION = `${YOUR_DOMAIN}/${API_KEY_NAME}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
// --- End Configuration ---

// Path langsung ke file videos.json Anda
const VIDEOS_JSON_PATH = path.resolve(__dirname, '../src/data/videos.json');
// Path ke cache URL terakhir yang dikirim (akan disimpan di root proyek)
const LAST_SENT_URLS_CACHE = path.resolve(__dirname, '../.indexnow_cache.json');

// Fungsi untuk mendapatkan semua URL video langsung dari JSON
async function getAllVideoUrls() {
    try {
        // --- PERUBAHAN PENTING DI SINI ---
        // Baca file JSON sebagai string, lalu parse
        const fileContent = await fs.readFile(VIDEOS_JSON_PATH, 'utf-8');
        const allVideos = JSON.parse(fileContent);
        // --- AKHIR PERUBAHAN PENTING ---

        if (!Array.isArray(allVideos)) {
            console.error('Data videos.json is not in the expected array format.');
            return [];
        }

        // Basic slugify function, adjust if you have a more complex one
        const slugify = (text) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        return allVideos.map(video => {
            const slug = slugify(video.title);
            return `${YOUR_DOMAIN}/${slug}-${video.id}/`;
        });
    } catch (error) {
        console.error('Failed to load or process videos.json:', error);
        return [];
    }
}

// Main function to send to IndexNow (remains the same)
async function sendToIndexNow(urlsToSend) {
    if (urlsToSend.length === 0) {
        console.log('No new or updated URLs to send to IndexNow.');
        return;
    }

    const chunkSize = 10000;
    for (let i = 0; i < urlsToSend.length; i += chunkSize) {
        const chunk = urlsToSend.slice(i, i + chunkSize);

        const payload = {
            host: new URL(YOUR_DOMAIN).hostname,
            key: API_KEY_NAME,
            keyLocation: API_KEY_LOCATION,
            urlList: chunk,
        };

        try {
            console.log(`Sending ${chunk.length} URLs to IndexNow (chunk ${Math.floor(i / chunkSize) + 1})...`);
            const response = await fetch(INDEXNOW_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log(`Successfully sent URL chunk to IndexNow.
