// scripts/notify-indexnow.js
import fetch from 'node-fetch'; // Pastikan Anda sudah npm install node-fetch
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Dapatkan __dirname di modul ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Konfigurasi Anda ---
// Ganti dengan domain Anda yang sebenarnya
const YOUR_DOMAIN = 'https://bokepkaraoke.pages.dev'; 
// Ganti dengan GUID Anda (nama file .txt tanpa ekstensi)
const API_KEY_NAME = '0ddba14269f0446280912b339a1e17a2'; // Contoh: ganti dengan kunci Anda
// --- Akhir Konfigurasi ---

const API_KEY_LOCATION = `${YOUR_DOMAIN}/${API_KEY_NAME}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

// Path relatif ke file data video Anda dari root proyek
// Sesuaikan jika struktur folder Anda berbeda
const DATA_FILE_PATH = path.resolve(__dirname, '../src/utils/data.ts'); 
// Path ke cache URL terakhir yang dikirim (akan disimpan di root proyek)
const LAST_SENT_URLS_CACHE = path.resolve(__dirname, '../.indexnow_cache.json');

// Fungsi untuk mendapatkan semua URL video dari data Anda
async function getAllVideoUrls() {
    try {
        // Menggunakan import() dinamis untuk memuat modul TypeScript
        // Memastikan modul di-load sebagai ES module
        const { getAllVideos } = await import(DATA_FILE_PATH);
        const allVideos = await getAllVideos();
        // Asumsi struktur URL Anda seperti di [slug].astro: /judul-video-id/
        return allVideos.map(video => `${YOUR_DOMAIN}/${video.title.toLowerCase().replace(/\s+/g, '-')}-${video.id}/`);
    } catch (error) {
        console.error('Gagal memuat data video:', error);
        return [];
    }
}

// Fungsi utama untuk mengirim ke IndexNow
async function sendToIndexNow(urlsToSend) {
    if (urlsToSend.length === 0) {
        console.log('Tidak ada URL baru atau yang diperbarui untuk dikirim ke IndexNow.');
        return;
    }

    // IndexNow API memiliki batas 10.000 URL per permintaan.
    // Jika lebih dari itu, Anda perlu membaginya menjadi beberapa permintaan.
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
                    'Content-Type': 'application/json; charset=utf-8',
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
        // File cache belum ada atau rusak, ini normal untuk pertama kali
        console.log('Cache IndexNow tidak ditemukan atau rusak, akan mengirim semua URL baru.');
    }

    // Tentukan URL yang baru atau berubah
    const urlsToSubmit = currentUrls.filter(url => !lastSentUrls.includes(url));

    // Jika ingin juga mengirim URL yang dihapus (tidak ada di currentUrls tapi ada di lastSentUrls)
    // const deletedUrls = lastSentUrls.filter(url => !currentUrls.includes(url));
    // console.log('URL yang dihapus:', deletedUrls);
    // (Implementasi pengiriman untuk penghapusan akan berbeda, perlu konfirmasi API IndexNow)

    await sendToIndexNow(urlsToSubmit);

    // Setelah semua pengiriman selesai (baik berhasil atau gagal),
    // simpan *semua* URL yang saat ini ada di situs ke cache untuk pemanggilan berikutnya.
    // Ini memastikan bahwa di build berikutnya, hanya URL yang *benar-benar* baru atau berubah yang akan dikirim.
    try {
        await fs.writeFile(LAST_SENT_URLS_CACHE, JSON.stringify(currentUrls), 'utf-8');
        console.log('Cache IndexNow berhasil diperbarui.');
    } catch (error) {
        console.error('Gagal memperbarui cache IndexNow:', error);
    }
}

main();