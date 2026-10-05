# SpeedPulse - Modern Network Speed Test (Golang)

Aplikasi uji kecepatan jaringan/internet mandiri (*self-hosted speed test*) berkinerja tinggi yang dibangun menggunakan **Go (Golang)** dengan antarmuka web modern bergaya dark cyberpunk terinspirasi oleh Ookla dan Fast.com.

---

## ⚡ Fitur Utama

- **Single Binary Executable**: Frontend (HTML/CSS/JS) di-embed langsung ke dalam file binary via `go:embed`.
- **Zero-Copy Streaming**: Endpoint `/api/download` dan `/api/upload` memanfaatkan streaming buffer memory tanpa alokasi disk ataupun kebocoran RAM.
- **Pengujian Multi-Stream Paralel**: Menggunakan 4 stream HTTP simultan untuk mengukur throughput jaringan secara maksimal.
- **Metrik Lengkap**:
  - **Ping (Latency)**: Round-trip time (RTT) tercepat dalam milidetik (ms).
  - **Jitter**: Fluktuasi kestabilan latensi (RFC 3550).
  - **Download Throughput**: Kecepatan unduh real-time & rata-rata (Mbps).
  - **Upload Throughput**: Kecepatan unggah real-time & rata-rata (Mbps).
- **Speedometer Gauge Animasi**: Tampilan gauge jarum halus pada HTML5 Canvas dengan skala dinamis/logaritmik (0 - 1000+ Mbps).
- **Grafik Bandwidth Real-Time**: Sparkline chart interaktif yang menampilkan kurva throughput saat pengujian berjalan.
- **Deteksi Klien & Server**: Mendeteksi otomatis IP address klien dan spesifikasi server host.

---

## 🚀 Cara Menjalankan

### 1. Jalankan Langsung dengan Go
```bash
go run main.go
```
Atau tentukan port khusus:
```bash
go run main.go -port 9000
```

### 2. Kompilasi Menjadi File Binary Mandiri
```bash
go build -o speedtest .
./speedtest
```

Buka browser Anda di:
- **Lokal**: [http://localhost:8080](http://localhost:8080)
- **Jaringan LAN / Wi-Fi**: `http://<IP-Komputer-Anda>:8080` (bisa diakses langsung dari HP atau perangkat lain dalam satu Wi-Fi)

---

## 📡 API Endpoints

| Endpoint | Method | Deskripsi |
| :--- | :---: | :--- |
| `/` | `GET` | Web Dashboard interaktif (Embedded) |
| `/api/ping` | `GET` | Respon instan `204 No Content` untuk kalkulasi RTT & Jitter |
| `/api/info` | `GET` | Mengembalikan informasi IP klien, hostname, OS, dan waktu server |
| `/api/download` | `GET` | Mengalirkan data biner acak (parameter opsional: `?size=15728640`) |
| `/api/upload` | `POST` | Menerima payload stream biner klien langsung ke `io.Discard` |

---

## 🛠️ Arsitektur Kode

```
speedtest/
├── go.mod               # Modul Go standar (Zero third-party dependencies)
├── main.go               # Server HTTP, streaming engine, handler, go:embed
├── README.md             # Dokumentasi proyek
└── web/
    ├── index.html        # Struktur UI, canvas speedometer, kartu metrik
    ├── style.css         # Desain modern dark mode, glassmorphism, responsive
    └── app.js            # Engine pengujian JavaScript klien (Ping, Jitter, Multi-stream)
```
