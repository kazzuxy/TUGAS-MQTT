# IoT Multi-Broker Dashboard 🚀

Sistem Kendali dan Pemantauan Sensor IoT Multi-Broker terintegrasi **Perintah Suara (Speech Recognition)** dan **Visualisasi Animasi 3D (Three.js)**. Dirancang untuk memberikan fleksibilitas penuh bagi para pengembang IoT dalam memantau sirkuit elektronik (esp32/arduino) secara real-time dari beberapa broker MQTT sekaligus secara paralel.

[![React](https://img.shields.io/badge/React-19-blue?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6-purple?logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://typescript.org)
[![ThreeJs](https://img.shields.io/badge/ThreeJS-r184-black?logo=three.js&logoColor=white)](https://threejs.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38bdf8?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

---

## 🌟 Fitur Utama (Core Features)

### 1. Multi-Broker Parallel Connection 🌐
*   **Koneksi Paralel**: Hubungkan dan monitoring data dari 3 Broker sekaligus secara *real-time*:
    *   **Shiftr.io** (Koneksi visual sandbox)
    *   **Cedalo Cloud** (Enterprise Mosquitto)
    *   **Flespi** (Telemetri performa tinggi)
    *   **Custom-Broker** (Fleksibilitas konfigurasi custom URI)
*   **Strategi Suffix Acak Unik (Anti-Bentrok)**: Dilengkapi toggle *Unique Random Suffix* (4 digit acak di belakang Client ID) guna menghindari pemutusan paksa (*forced disconnect*) saat Client ID yang sama digunakan oleh mikrokontroler (ESP32) atau tab browser lain secara bersamaan.
*   **Path Auto-Fix & SSL/TLS**: Otomatis mendeteksi dan memperbaiki format path WebSocket (seperti `/mqtt` pada Cedalo Cloud).

### 2. Interactive 3D WebGL Visualizations 🎨
Grafik 3D imersif berbasis **Three.js** untuk merepresentasikan telemetri sensor tanpa membebani performa utama:
*   **Temperature Visualizer**: Representasi 3D Thermometer cair dengan efek pemuaian fluida dinamis menyesuaikan nilai suhu (°C).
*   **Humidity Visualizer**: Simulasi tetesan air real-time dengan kecepatan gravitasi serta kerapatan partikel dinamis berdasarkan tingkat kelembapan (%).
*   **Voice Spectrum Visualizer**: Analisis visual gelombang frekuensi audio interaktif saat sistem mendengar input suara pengguna.

### 3. Smart Voice Command (Speech-to-Text & TTS) 🎙️
*   **Kontrol Bebas Genggam**: Integrasi penuh *HTML5 Web Speech API* untuk menangkap komando suara dalam Bahasa Indonesia.
*   **Balasan Audio (Text-to-Speech)**: Dasbor memberikan konfirmasi lisan maskulin/feminin bernuansa asisten pintar setelah perintah berhasil divalidasi.
*   **Dukungan Perintah**:
    *   *"Nyalakan Lampu"* / *"Matikan Lampu Utama"*
    *   *"Hidupkan Kipas Sirkulasi"* / *"Matikan Kipas"*
    *   *"Pompa On"* / *"Matikan Pompa Air"*
    *   *"Aktifkan Sirine Alarm"* / *"Matikan Alarm"*
    *   *"Status Sensor"* (Dasbor membacakan secara lisan telemetri suhu & kelembapan terkini)

### 4. Real-time Telemetry & Relay Control 🎛️
*   **4-Channel Relay Actuator**: Kendalikan aktuator hardware dengan publish topik MQTT instan. Status relay tersinkronisasi dua arah.
*   **Logging Terintegrasi**: Panel pencatat pesan MQTT masuk & keluar (*Incoming/Outgoing Payload Log*) serta grafik riwayat sensor lokal yang terekam aman menggunakan *HTML5 LocalStorage*.
*   **Indikator Beep Akustik**: Audio umpan balik (frekuensi Hertz dinamis) menggunakan *AudioContext API* untuk penanda aktivitas koneksi dan eror.

---

## 🛠️ Arsitektur Teknologi (Tech Stack)

*   **Frontend SPA**: [React 19](https://react.dev/) & [TypeScript](https://www.typescriptlang.org/) untuk performa rendering UI reaktif tinggi dan jaminan keamanan tipe.
*   **Konektor IoT**: [MQTT.js v5](https://github.com/mqttjs/MQTT.js) klien WebSocket tangguh untuk komunikasi broker dua arah.
*   **Visual 3D & Animasi**: [Three.js](https://threejs.org/) & [Motion (Framer Motion v12)](https://motion.dev/) untuk micro-interactions, navigasi lancar, dan visualisasi telemetri.
*   **Styling**: [Tailwind CSS v4.0](https://tailwindcss.com) bertemakan *Cosmic Indigo Slate* gelap dengan kontras tipografi elegan yang nyaman untuk mata (eye-safe).
*   **Database & Autentikasi**: [Firebase (Firestore & Auth)](https://firebase.google.com/) untuk pengamanan login pengguna dan persistensi data jarak jauh.

---

## 🚀 Panduan Instalasi & Pengembangan Lokal

### Prasyarat
*   [Node.js](https://nodejs.org/) (Versi 18 atau lebih baru direkomendasikan)
*   NPM / Yarn / Bun

### Langkah 1: Kloning Repositori
```bash
git clone <repository-url>
cd iot-multi-broker-dashboard
```

### Langkah 2: Instalasi Dependensi
```bash
npm install
```

### Langkah 3: Konfigurasi Environment Variables
Buat berkas `.env` di direktori root proyek (merujuk pada berkas `.env.example`):
```env
# Firebase configuration
VITE_FIREBASE_API_KEY=AIzaSy...
```

### Langkah 4: Jalankan Development Server
```bash
npm run dev
```
Aplikasi akan otomatis berjalan pada port default: [http://localhost:3000](http://localhost:3000).

### Langkah 5: Produksi & Build Proyek
```bash
npm run build
npm run preview
```

---

## 📋 Daftar Perintah Suara Terdaftar (Voice Command List)

Gunakan tombol **"Mulai Dengar"** pada panel kendali suara:

| Perintah Suara (Kata Kunci) | Target Aktuator | Aksi | Balasan Suara Pintar (TTS) |
| :--- | :--- | :--- | :--- |
| **"nyalakan lampu"** / **"lampu on"** | Relay 1 | AKTIF | *"Lampu utama telah dinyalakan"* |
| **"matikan lampu"** / **"lampu off"** | Relay 1 | MATI | *"Lampu utama telah dimatikan"* |
| **"hidupkan kipas"** / **"kipas on"** | Relay 2 | AKTIF | *"Sirkulasi kipas angin berputar"* |
| **"matikan kipas"** / **"kipas off"** | Relay 2 | MATI | *"Kipas sirkulasi dinonaktifkan"* |
| **"nyalakan pompa"** / **"pompa on"** | Relay 3 | AKTIF | *"Water pump aktif memompa air"* |
| **"matikan pompa"** / **"pompa off"** | Relay 3 | MATI | *"Aliran pompa air dihentikan"* |
| **"nyalakan alarm"** / **"alarm on"** | Relay 4 | AKTIF | *"Sistem dalam bahaya, alarm sirine aktif"* |
| **"matikan alarm"** / **"alarm off"** | Relay 4 | MATI | *"Alarm sirine berhasil dimatikan"* |
| **"status sensor"** / **"cek sensor"** | Dasbor | Telemetri | *"Suhu saat ini [X] derajat Celcius dengan kelembapan [Y] persen"* |

---

## 🎚️ Panduan Konfigurasi Broker MQTT

Untuk memastikan dashboard bekerja sempurna dengan hardware Anda, silakan sesuaikan topik publish/subscribe dasar pada masing-masing broker:

### Skema Pemetaan Topik default:
*   **Base Topic**: `iot/bass/control` (Dapat diubah pada pengaturan dasbor)
*   **Sensor Suhu (Subscribe)**: `{Base Topic}/suhu` -> Menerima payload numerik (misal: `30.5`)
*   **Sensor Kelembapan (Subscribe)**: `{Base Topic}/kelembapan` -> Menerima payload numerik (misal: `65`)
*   **Relay Control (Publish/Subscribe)**: `{Base Topic}/relay/{relayId}` -> Mengirim/menerima payload berupa `"ON"` atau `"OFF"`.

---

## 🛡️ Lisensi & Disclaimer
Aplikasi ini ditujukan untuk tujuan edukasi, visualisasi industri modular, dan pemantauan hobi manufaktur pintar. Kontribusi perbaikan visualisasi 3D sirkuit dipersilakan dengan mengajukan Pull Request pada branch utama.

---
*Crafted with precision using modern React 19 architecture.* 📡✨
