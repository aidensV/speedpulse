package main

import (
	"crypto/rand"
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
)

//go:embed web/*
var webFiles embed.FS

// Global pre-allocated buffer for zero-alloc high-throughput download tests (4 MB)
const chunkBufferSize = 4 * 1024 * 1024
var chunkBuffer []byte

func init() {
	chunkBuffer = make([]byte, chunkBufferSize)
	// Isi dengan data acak agar terhindar dari kompresi otomatis transparent di HTTP proxy/VPN
	_, _ = rand.Read(chunkBuffer)
}

type ServerInfo struct {
	ClientIP  string `json:"client_ip"`
	Hostname  string `json:"hostname"`
	OS        string `json:"os"`
	GoVersion string `json:"go_version"`
	ServerTime string `json:"server_time"`
}

func getClientIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}
	xrip := r.Header.Get("X-Real-IP")
	if xrip != "" {
		return strings.TrimSpace(xrip)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}
	return r.RemoteAddr
}

func getOutboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "127.0.0.1"
	}
	defer conn.Close()
	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP.String()
}

func pingHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	w.Header().Set("Pragma", "no-cache")
	w.WriteHeader(http.StatusNoContent)
}

func infoHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")

	hostname, _ := os.Hostname()
	info := ServerInfo{
		ClientIP:   getClientIP(r),
		Hostname:   hostname,
		OS:         runtime.GOOS + "/" + runtime.GOARCH,
		GoVersion:  runtime.Version(),
		ServerTime: time.Now().Format(time.RFC3339),
	}

	_ = json.NewEncoder(w).Encode(info)
}

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
	w.Header().Set("Pragma", "no-cache")

	// Ukuran default 10MB per stream jika tidak dispesifikasikan (maksimal 100MB per request)
	totalBytes := int64(10 * 1024 * 1024)
	if sizeParam := r.URL.Query().Get("size"); sizeParam != "" {
		if parsed, err := strconv.ParseInt(sizeParam, 10, 64); err == nil && parsed > 0 {
			if parsed > 100*1024*1024 {
				parsed = 100 * 1024 * 1024
			}
			totalBytes = parsed
		}
	}

	w.Header().Set("Content-Length", strconv.FormatInt(totalBytes, 10))

	flusher, hasFlusher := w.(http.Flusher)
	bytesWritten := int64(0)

	for bytesWritten < totalBytes {
		remaining := totalBytes - bytesWritten
		toWrite := int64(chunkBufferSize)
		if remaining < toWrite {
			toWrite = remaining
		}

		n, err := w.Write(chunkBuffer[:toWrite])
		if err != nil {
			// Client disconnected / cancelled test
			return
		}
		bytesWritten += int64(n)

		if hasFlusher {
			flusher.Flush()
		}
	}
}

func uploadHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")

	if r.Method != http.MethodPost {
		http.Error(w, "Metode tidak diizinkan", http.StatusMethodNotAllowed)
		return
	}

	// Buang seluruh body streaming ke io.Discard tanpa alokasi memori
	written, err := io.Copy(io.Discard, r.Body)
	if err != nil {
		http.Error(w, "Gagal membaca stream", http.StatusInternalServerError)
		return
	}
	defer r.Body.Close()

	resp := map[string]interface{}{
		"status":         "ok",
		"bytes_received": written,
	}
	_ = json.NewEncoder(w).Encode(resp)
}

func main() {
	defaultPort := 8080
	if envPort := os.Getenv("PORT"); envPort != "" {
		if p, err := strconv.Atoi(envPort); err == nil {
			defaultPort = p
		}
	}

	port := flag.Int("port", defaultPort, "Port HTTP server")
	host := flag.String("host", "0.0.0.0", "Alamat binding host")
	flag.Parse()

	mux := http.NewServeMux()

	// API Endpoints
	mux.HandleFunc("GET /api/ping", pingHandler)
	mux.HandleFunc("GET /api/info", infoHandler)
	mux.HandleFunc("GET /api/download", downloadHandler)
	mux.HandleFunc("POST /api/upload", uploadHandler)

	// Embedded Frontend Static Files
	subFS, err := fs.Sub(webFiles, "web")
	if err != nil {
		log.Fatalf("Gagal mengakses embedded web directory: %v", err)
	}
	mux.Handle("/", http.FileServer(http.FS(subFS)))

	addr := fmt.Sprintf("%s:%d", *host, *port)
	localIP := getOutboundIP()

	fmt.Println("=========================================================")
	fmt.Println("🚀 SpeedPulse - Internet Speed Test Engine (Golang)")
	fmt.Println("=========================================================")
	fmt.Printf(" Server aktif di:\n")
	fmt.Printf(" 👉 Lokal:       http://localhost:%d\n", *port)
	fmt.Printf(" 👉 Jaringan LAN: http://%s:%d\n", localIP, *port)
	fmt.Println("=========================================================")
	fmt.Println("Tekan Ctrl+C untuk menghentikan server.")

	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
