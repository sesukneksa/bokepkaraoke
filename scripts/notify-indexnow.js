// scripts/notify-indexnow.js
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Dapatkan __dirname di modul ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Konfigurasi Anda ---
const YOUR_DOMAIN = 'https://bokepkaraoke.pages.dev'; // Ganti dengan domain Anda
const API_KEY_NAME = '0ddba14269f0446280912b339a1e17a2'; // Ganti dengan GUID Anda
const API_KEY_LOCATION = `${YOUR_DOMAIN}/${API_KEY_NAME}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';
// --- Akhir Konfigurasi ---

// Path langsung ke file videos.json Anda
const VIDEOS_JSON_PATH = path.resolve(__dirname, '../src/data/videos.json'); // <--- PERUBAHAN PENTING INI
// Path ke cache URL terakhir yang dikirim (akan disimpan di root proyek)
const LAST_SENT_URLS_CACHE = path.resolve(__dirname, '../.indexnow_cache.json');

// Fungsi untuk mendapatkan semua URL video langsung dari JSON
async function getAllVideoUrls() {
    try {
        // IMPORTANT CHANGE HERE: Add assert { type: 'json' }
        const videosModule = await import(VIDEOS_JSON_PATH, { assert: { type: 'json' } });
        const allVideos = videosModule.default; 

        if (!Array.isArray(allVideos)) {
            console.error('Data videos.json is not in the expected array format.');
            return [];
        }

        // Asumsi struktur URL Anda seperti di [slug].astro: /judul-video-id/
        return allVideos.map(video => {
            // Lakukan slugify manual karena ini bukan dari modul data.ts lagi
            const slug = video.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''); 
            return `${YOUR_DOMAIN}/${slug}-${video.id}/`;
        });
    } catch (error) {
        console.error('Gagal memuat atau memproses videos.json:', error);
        return [];
    }
}

// Fungsi utama untuk mengirim ke IndexNow (tetap sama)
async function sendToIndexNow(urlsToSend) {
    if (urlsToSend.length === 0) {
        console.log('Tidak ada URL baru atau yang diperbarui untuk dikirim ke IndexNow.');
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
            console.log(`Mengirim ${chunk.length} URL ke IndexNow (chunk ${Math.floor(i / chunkSize) + 1})...`);
            const response = await fetch(INDEXNOW_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-08',
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log(`Berhasil mengirim chunk URL ke IndexNow. Status: ${response.status}`);
            } else {
                console.error(`Gagal mengirim chunk URL ke IndexNow: ${response.status} - ${response.statusText}`);
                const errorBody = await response.text();
                console.error('Response body:', errorBody);
            }
        } catch (error) {
            console.error('Terjadi kesalahan saat mengirim ke IndexNow:', error);
        }
    }
}

async function main() {
    const currentUrls = await getAllVideoUrls();
    let lastSentUrls = [];

    try {
        const cacheContent = await fs.readFile(LAST_SENT_URLS_CACHE, 'utf-8');
        lastSentUrls = JSON.parse(cacheContent);
    } catch (error) {
        console.log('Cache IndexNow tidak ditemukan atau rusak, akan mengirim semua URL baru.');
    }

    const urlsToSubmit = currentUrls.filter(url => !lastSentUrls.includes(url));

    await sendToIndexNow(urlsToSubmit);

    try {
        await fs.writeFile(LAST_SENT_URLS_CACHE, JSON.stringify(currentUrls), 'utf-8');
        console.log('Cache IndexNow berhasil diperbarui.');
    } catch (error) {
        console.error('Gagal memperbarui cache IndexNow:', error);
    }
}

main();
