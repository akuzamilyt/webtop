// Mengimpor modul crypto untuk membuat hash MD5
import crypto from 'crypto';

// Ini adalah Vercel Serverless Function. 
export default async function handler(req, res) {
    // --- Langkah 1: Validasi Konfigurasi Server ---
    // Memastikan API Key dan ID tersedia di Environment Variables Vercel.
    const apiKey = process.env.VIPAYMENT_API_KEY;
    const apiId = process.env.VIPAYMENT_API_ID;

    if (!apiKey || !apiId) {
        console.error("Kesalahan Konfigurasi: Kunci API atau ID tidak ditemukan di Vercel.");
        return res.status(500).json({ error: 'Konfigurasi API di sisi server belum lengkap.' });
    }

    // --- Langkah 2: Validasi Permintaan dari Klien ---
    // Memastikan permintaan dari browser menyertakan parameter 'operator'.
    const { operator } = req.query;
    if (!operator) {
        return res.status(400).json({ error: 'Parameter "operator" tidak disertakan dalam permintaan.' });
    }

    // --- Langkah 3: Membuat Signature (Tanda Tangan Digital) ---
    // Sesuai dokumentasi VIPayment, signature adalah hash MD5 dari gabungan API ID dan API Key.
    const sign = crypto.createHash('md5').update(apiId + apiKey).digest('hex');

    // --- Langkah 4: Mempersiapkan Body untuk Permintaan ke VIPayment ---
    // Objek ini berisi semua data yang akan dikirim ke server VIPayment.
    const requestBody = {
        key: apiKey,
        sign: sign,
        type: 'services', // 'services' untuk mendapatkan semua produk (pulsa, data, dll)
        operator: operator,
    };

    try {
        // --- Langkah 5: Mengirim Permintaan ke VIPayment ---
        console.log("Mengirim permintaan ke VIPayment dengan body:", JSON.stringify(requestBody));

        const vipaymentResponse = await fetch('https://vip-reseller.co.id/api/prepaid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // User-Agent standar untuk menyamarkan permintaan sebagai browser biasa.
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            body: JSON.stringify(requestBody),
        });

        // --- Langkah 6: Memeriksa Respon dari VIPayment ---
        // Jika status bukan 2xx (misal: 403 Forbidden, 500 Internal Server Error), lempar error.
        if (!vipaymentResponse.ok) {
            const errorText = await vipaymentResponse.text();
            console.error("Respon error dari VIPayment:", errorText);
            // Ini akan memunculkan halaman error Cloudflare di log Vercel Anda.
            throw new Error(`Server VIPayment merespon dengan status ${vipaymentResponse.status}.`);
        }

        // Jika berhasil, ubah respon menjadi JSON.
        const result = await vipaymentResponse.json();

        // --- Langkah 7: Mengirim Data atau Pesan Error ke Browser Anda ---
        if (result.rc === '00' || result.result === true) {
            // Sukses, kirim data produk ke browser.
            res.status(200).json(result.data);
        } else {
            // Gagal, kirim pesan error dari VIPayment ke browser.
            res.status(400).json({ error: `Pesan dari VIPayment: ${result.message}` });
        }

    } catch (error) {
        // Menangkap semua kemungkinan error (network, dll) dan mengirim respon yang jelas.
        console.error('Terjadi kesalahan fatal di server function:', error.message);
        res.status(500).json({ error: 'Terjadi kesalahan di server saat mencoba menghubungi VIPayment.' });
    }
}
