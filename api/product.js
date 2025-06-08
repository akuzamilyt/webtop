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
    // Contoh: /api/products?type=pulsa&operator=telkomsel
    const { type, operator } = req.query;

    // Validasi input: pastikan 'type' dan 'operator' dikirim oleh front-end
    if (!type || !operator) {
        return res.status(400).json({ error: 'Parameter "type" dan "operator" dibutuhkan.' });
    }

    try {
        // 4. Mempersiapkan dan mengirim request ke server VIPayment
        const vipaymentResponse = await fetch('https://vip-reseller.co.id/api/prepaid', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            // Body/isi request yang dikirim ke VIPayment
            body: JSON.stringify({
                key: apiKey,
                sign: sign,
                type: type,
                operator: operator,
            }),
        });

        // Jika request ke VIPayment gagal (misal: server mereka down)
        if (!vipaymentResponse.ok) {
            throw new Error('Gagal menghubungi server VIPayment.');
        }

        // Mengubah response dari VIPayment menjadi format JSON
        const result = await vipaymentResponse.json();

        // 5. Memeriksa hasil dari VIPayment
        if (result.rc === '00') {
            // Jika response code '00' berarti sukses
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
