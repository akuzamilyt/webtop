// Mengimpor modul crypto untuk membuat hash MD5
import crypto from 'crypto';

// Ini adalah Vercel Serverless Function. 
// 'req' adalah request yang masuk dari browser, 'res' adalah response yang akan kita kirim kembali.
export default async function handler(req, res) {
    // 1. Mengambil API keys dari Environment Variables yang sudah Anda atur di Vercel
    const apiKey = process.env.VIPAYMENT_API_KEY;
    const apiId = process.env.VIPAYMENT_API_ID;

    // Jika salah satu key tidak ditemukan, kirim error. Ini penting untuk keamanan.
    if (!apiKey || !apiId) {
        return res.status(500).json({ error: 'Konfigurasi API Key di server belum lengkap.' });
    }

    // 2. Membuat 'sign' key sesuai dokumentasi VIPayment
    // 'sign' adalah gabungan API ID dan API Key yang di-hash menggunakan MD5
    const sign = crypto.createHash('md5').update(apiId + apiKey).digest('hex');

    // 3. Mengambil parameter dari request front-end
    // Contoh: /api/products?type=pulsa_paket&operator=telkomsel
    const { operator } = req.query;

    // Validasi input: pastikan 'operator' dikirim oleh front-end
    if (!operator) {
        return res.status(400).json({ error: 'Parameter "operator" dibutuhkan.' });
    }

    try {
        // 4. Mempersiapkan dan mengirim request ke server VIPayment
        const vipaymentResponse = await fetch('https://vip-reseller.co.id/api/prepaid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // --- PERBAIKAN DI SINI ---
                // Menambahkan lebih banyak header agar request terlihat seperti dari browser asli
                // untuk menghindari blokir dari sistem keamanan seperti Cloudflare.
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            // Body/isi request yang dikirim ke VIPayment
            body: JSON.stringify({
                key: apiKey,
                sign: sign,
                type: 'services', 
                operator: operator,
            }),
        });

        // Jika request ke VIPayment gagal (misal: server mereka down atau request salah)
        if (!vipaymentResponse.ok) {
            // Coba baca pesan error dari VIPayment untuk info lebih detail
            const errorBody = await vipaymentResponse.text();
            console.error("Respon error dari VIPayment:", errorBody);
            throw new Error(`Gagal menghubungi server VIPayment (Status: ${vipaymentResponse.status}).`);
        }

        // Mengubah response dari VIPayment menjadi format JSON
        const result = await vipaymentResponse.json();

        // 5. Memeriksa hasil dari VIPayment
        if (result.rc === '00' || result.result === true) { // Beberapa API menggunakan 'result'
            // Jika response code '00' atau result true berarti sukses
            // Kirim kembali hanya data produknya ke front-end Anda
            res.status(200).json(result.data);
        } else {
            // Jika ada response code lain, berarti ada masalah dari sisi VIPayment
            // Kirim pesan error dari VIPayment ke front-end untuk debugging
            res.status(400).json({ error: `Error dari VIPayment: ${result.message}` });
        }

    } catch (error) {
        // 6. Menangani segala jenis error (network, dll)
        console.error('Terjadi error di server function:', error);
        res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
    }
}
