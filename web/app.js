// SpeedPulse Speedtest Client Engine

class SpeedPulseEngine {
  constructor() {
    this.canvas = document.getElementById('gauge-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.chartCanvas = document.getElementById('chart-canvas');
    this.chartCtx = this.chartCanvas.getContext('2d');

    // UI elements
    this.startBtn = document.getElementById('start-btn');
    this.btnText = this.startBtn.querySelector('.btn-text');
    this.phaseBadge = document.getElementById('test-phase-badge');
    this.liveSpeedVal = document.getElementById('live-speed-value');
    this.liveSpeedUnit = document.getElementById('live-speed-unit');
    this.chartPeak = document.getElementById('chart-peak-speed');

    this.metricPing = document.getElementById('metric-ping');
    this.metricJitter = document.getElementById('metric-jitter');
    this.metricDownload = document.getElementById('metric-download');
    this.metricUpload = document.getElementById('metric-upload');

    this.cardPing = document.getElementById('card-ping');
    this.cardJitter = document.getElementById('card-jitter');
    this.cardDownload = document.getElementById('card-download');
    this.cardUpload = document.getElementById('card-upload');

    this.clientIpEl = document.getElementById('client-ip');
    this.serverHostEl = document.getElementById('server-host');

    // Animation & Gauge State
    this.currentGaugeSpeed = 0;
    this.targetGaugeSpeed = 0;
    this.chartHistory = [];
    this.peakSpeed = 0;
    this.isRunning = false;
    this.abortController = null;

    // Scale definition (logarithmic progression)
    this.scalePoints = [0, 5, 10, 25, 50, 100, 250, 500, 1000];

    this.init();
  }

  init() {
    this.bindEvents();
    this.fetchInfo();
    this.renderLoop();
  }

  bindEvents() {
    this.startBtn.addEventListener('click', () => {
      if (this.isRunning) {
        this.stopTest();
      } else {
        this.runFullTest();
      }
    });

    window.addEventListener('resize', () => {
      this.drawGauge(this.currentGaugeSpeed);
      this.drawChart();
    });
  }

  async fetchInfo() {
    try {
      const res = await fetch('/api/info');
      if (res.ok) {
        const data = await res.json();
        this.clientIpEl.textContent = data.client_ip || '127.0.0.1';
        this.serverHostEl.textContent = `${data.hostname || 'SpeedPulse Server'} (${data.os || 'Linux'})`;
      }
    } catch (err) {
      this.clientIpEl.textContent = '127.0.0.1 (Lokal)';
      this.serverHostEl.textContent = 'SpeedPulse Host';
    }
  }

  // Value to Gauge Angle mapping
  speedToAngle(speed) {
    const minAngle = 0.75 * Math.PI; // 135 deg
    const maxAngle = 2.25 * Math.PI; // 405 deg
    const totalAngle = maxAngle - minAngle;

    if (speed <= 0) return minAngle;
    if (speed >= 1000) return maxAngle;

    // Log-like piecewise interpolation for natural gauge motion
    let idx = 0;
    for (let i = 0; i < this.scalePoints.length - 1; i++) {
      if (speed >= this.scalePoints[i] && speed <= this.scalePoints[i + 1]) {
        idx = i;
        break;
      }
    }

    const lowVal = this.scalePoints[idx];
    const highVal = this.scalePoints[idx + 1];
    const segmentSpan = (speed - lowVal) / (highVal - lowVal);
    const segmentAngle = totalAngle / (this.scalePoints.length - 1);

    return minAngle + (idx + segmentSpan) * segmentAngle;
  }

  drawGauge(speed) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h * 0.78;
    const radius = 135;

    ctx.clearRect(0, 0, w, h);

    const minAngle = 0.75 * Math.PI;
    const maxAngle = 2.25 * Math.PI;

    // 1. Background Arc Track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, minAngle, maxAngle);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Active Glow Arc
    const currentAngle = this.speedToAngle(speed);
    if (currentAngle > minAngle) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, minAngle, currentAngle);
      ctx.lineWidth = 14;
      const grad = ctx.createLinearGradient(0, cy, w, cy);
      grad.addColorStop(0, '#00f2fe');
      grad.addColorStop(0.5, '#4facfe');
      grad.addColorStop(1, '#7928ca');
      ctx.strokeStyle = grad;
      ctx.shadowColor = 'rgba(0, 242, 254, 0.5)';
      ctx.shadowBlur = 15;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 3. Scale Ticks & Labels
    const totalAngle = maxAngle - minAngle;
    const step = totalAngle / (this.scalePoints.length - 1);

    ctx.font = '600 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < this.scalePoints.length; i++) {
      const angle = minAngle + i * step;
      const innerR = radius - 18;
      const outerR = radius - 10;
      const textR = radius - 32;

      // Tick line
      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * outerR;
      const y2 = cy + Math.sin(angle) * outerR;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.stroke();

      // Number label
      const tx = cx + Math.cos(angle) * textR;
      const ty = cy + Math.sin(angle) * textR;
      ctx.fillText(this.scalePoints[i].toString(), tx, ty);
    }

    // 4. Center Needle
    const needleR = radius - 8;
    const nx = cx + Math.cos(currentAngle) * needleR;
    const ny = cy + Math.sin(currentAngle) * needleR;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center pivot point
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }

  drawChart() {
    const ctx = this.chartCtx;
    const w = this.chartCanvas.width;
    const h = this.chartCanvas.height;

    ctx.clearRect(0, 0, w, h);

    if (this.chartHistory.length < 2) return;

    const maxVal = Math.max(10, ...this.chartHistory) * 1.15;
    const stepX = w / (this.chartHistory.length - 1);

    // Area fill
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < this.chartHistory.length; i++) {
      const x = i * stepX;
      const y = h - (this.chartHistory[i] / maxVal) * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();

    const areaGrad = ctx.createLinearGradient(0, 0, 0, h);
    areaGrad.addColorStop(0, 'rgba(0, 242, 254, 0.25)');
    areaGrad.addColorStop(1, 'rgba(0, 242, 254, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    for (let i = 0; i < this.chartHistory.length; i++) {
      const x = i * stepX;
      const y = h - (this.chartHistory[i] / maxVal) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#00f2fe';
    ctx.stroke();
  }

  renderLoop() {
    // Smooth interpolation for gauge needle
    const diff = this.targetGaugeSpeed - this.currentGaugeSpeed;
    this.currentGaugeSpeed += diff * 0.12;

    this.drawGauge(this.currentGaugeSpeed);
    this.drawChart();

    requestAnimationFrame(() => this.renderLoop());
  }

  setPhase(badgeText, isActive = true) {
    this.phaseBadge.textContent = badgeText;
    if (isActive) {
      this.phaseBadge.classList.add('active');
    } else {
      this.phaseBadge.classList.remove('active');
    }
  }

  updateLiveSpeed(mbps) {
    this.targetGaugeSpeed = mbps;
    this.liveSpeedVal.textContent = mbps.toFixed(1);

    if (mbps > this.peakSpeed) {
      this.peakSpeed = mbps;
      this.chartPeak.textContent = `Puncak: ${mbps.toFixed(1)} Mbps`;
    }

    this.chartHistory.push(mbps);
    if (this.chartHistory.length > 50) {
      this.chartHistory.shift();
    }
  }

  resetUI() {
    this.metricPing.textContent = '--';
    this.metricJitter.textContent = '--';
    this.metricDownload.textContent = '--';
    this.metricUpload.textContent = '--';

    document.querySelectorAll('.progress-fill').forEach(p => p.style.width = '0%');
    document.querySelectorAll('.metric-card').forEach(c => c.classList.remove('active-testing'));

    this.chartHistory = [];
    this.peakSpeed = 0;
    this.targetGaugeSpeed = 0;
    this.liveSpeedVal.textContent = '0.0';
    this.chartPeak.textContent = 'Puncak: 0 Mbps';
  }

  stopTest() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isRunning = false;
    this.startBtn.classList.remove('running');
    this.btnText.textContent = 'MULAI TES';
    this.setPhase('Tes Dibatalkan', false);
    this.targetGaugeSpeed = 0;
  }

  async runFullTest() {
    this.isRunning = true;
    this.abortController = new AbortController();
    this.resetUI();

    this.startBtn.classList.add('running');
    this.btnText.textContent = 'BERHENTIKAN';

    try {
      // 1. Latency & Jitter Test
      await this.runPingTest(this.abortController.signal);

      // 2. Download Test
      await this.runDownloadTest(this.abortController.signal);

      // 3. Upload Test
      await this.runUploadTest(this.abortController.signal);

      // Complete
      this.setPhase('Pengujian Selesai', false);
      this.startBtn.classList.remove('running');
      this.btnText.textContent = 'ULANGI TES';
      this.targetGaugeSpeed = 0;
      this.isRunning = false;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Test dibatalkan oleh pengguna.');
      } else {
        console.error('Error saat testing:', err);
        this.setPhase('Gagal Menghubungi Server', false);
        this.stopTest();
      }
    }
  }

  // Phase 1: Ping & Jitter
  async runPingTest(signal) {
    this.setPhase('Mengukur Ping & Jitter...');
    this.cardPing.classList.add('active-testing');
    this.cardJitter.classList.add('active-testing');

    const pings = [];
    const totalPings = 10;

    for (let i = 0; i < totalPings; i++) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

      const start = performance.now();
      await fetch(`/api/ping?t=${Date.now()}`, { signal, cache: 'no-store' });
      const duration = performance.now() - start;
      pings.push(duration);

      const currentMin = Math.min(...pings);
      this.metricPing.textContent = currentMin.toFixed(0);
      document.getElementById('progress-ping').style.width = `${((i + 1) / totalPings) * 100}%`;

      await new Promise(r => setTimeout(r, 60));
    }

    // Ping = Best (Lowest) Latency
    const finalPing = Math.min(...pings);
    this.metricPing.textContent = finalPing.toFixed(0);

    // Jitter calculation (Mean of successive differences RFC 3550)
    let jitterSum = 0;
    for (let i = 1; i < pings.length; i++) {
      jitterSum += Math.abs(pings[i] - pings[i - 1]);
    }
    const finalJitter = jitterSum / (pings.length - 1);
    this.metricJitter.textContent = finalJitter.toFixed(1);
    document.getElementById('progress-jitter').style.width = '100%';

    this.cardPing.classList.remove('active-testing');
    this.cardJitter.classList.remove('active-testing');
  }

  // Phase 2: Download Test (Parallel HTTP Streaming)
  async runDownloadTest(signal) {
    this.setPhase('Menguji Kecepatan Unduh (Download)...');
    this.cardDownload.classList.add('active-testing');
    this.chartHistory = [];

    const durationMs = 8000; // 8 detik
    const numStreams = 4;
    const startTime = performance.now();
    let totalBytesReceived = 0;
    let lastTime = startTime;
    let lastBytes = 0;

    // Monitor interval
    const interval = setInterval(() => {
      const now = performance.now();
      const deltaSec = (now - lastTime) / 1000;
      const deltaBytes = totalBytesReceived - lastBytes;

      if (deltaSec > 0.05) {
        const instantMbps = (deltaBytes * 8) / (deltaSec * 1_000_000);
        this.updateLiveSpeed(instantMbps);
        lastTime = now;
        lastBytes = totalBytesReceived;

        const progressPercent = Math.min(100, ((now - startTime) / durationMs) * 100);
        document.getElementById('progress-download').style.width = `${progressPercent}%`;
      }
    }, 100);

    const streamWorker = async () => {
      while (performance.now() - startTime < durationMs && !signal.aborted) {
        try {
          // Request 15MB chunks
          const res = await fetch(`/api/download?size=15728640&t=${Math.random()}`, {
            signal,
            cache: 'no-store'
          });

          const reader = res.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done || performance.now() - startTime >= durationMs || signal.aborted) {
              reader.cancel();
              break;
            }
            if (value) {
              totalBytesReceived += value.length;
            }
          }
        } catch (e) {
          if (signal.aborted) break;
        }
      }
    };

    // Run parallel workers
    await Promise.all(Array.from({ length: numStreams }, () => streamWorker()));
    clearInterval(interval);

    // Compute final average Download speed (discard warm-up fraction for accuracy)
    const elapsedSec = (performance.now() - startTime) / 1000;
    const avgMbps = (totalBytesReceived * 8) / (elapsedSec * 1_000_000);
    this.metricDownload.textContent = avgMbps.toFixed(2);
    document.getElementById('progress-download').style.width = '100%';
    this.cardDownload.classList.remove('active-testing');
  }

  // Phase 3: Upload Test (Parallel HTTP POST)
  async runUploadTest(signal) {
    this.setPhase('Menguji Kecepatan Unggah (Upload)...');
    this.cardUpload.classList.add('active-testing');
    this.targetGaugeSpeed = 0;
    this.chartHistory = [];

    const durationMs = 8000; // 8 detik
    const numStreams = 4;
    const startTime = performance.now();
    let totalBytesSent = 0;
    let lastTime = startTime;
    let lastBytes = 0;

    // Generate reusable 1MB payload buffer
    const payloadSize = 1024 * 1024; // 1MB
    const payload = new Uint8Array(payloadSize);
    for (let i = 0; i < payloadSize; i += 64) {
      payload[i] = Math.floor(Math.random() * 256);
    }

    const interval = setInterval(() => {
      const now = performance.now();
      const deltaSec = (now - lastTime) / 1000;
      const deltaBytes = totalBytesSent - lastBytes;

      if (deltaSec > 0.05) {
        const instantMbps = (deltaBytes * 8) / (deltaSec * 1_000_000);
        this.updateLiveSpeed(instantMbps);
        lastTime = now;
        lastBytes = totalBytesSent;

        const progressPercent = Math.min(100, ((now - startTime) / durationMs) * 100);
        document.getElementById('progress-upload').style.width = `${progressPercent}%`;
      }
    }, 100);

    const uploadWorker = async () => {
      while (performance.now() - startTime < durationMs && !signal.aborted) {
        try {
          await fetch('/api/upload', {
            method: 'POST',
            body: payload,
            signal,
            cache: 'no-store'
          });
          totalBytesSent += payloadSize;
        } catch (e) {
          if (signal.aborted) break;
        }
      }
    };

    // Run parallel upload workers
    await Promise.all(Array.from({ length: numStreams }, () => uploadWorker()));
    clearInterval(interval);

    const elapsedSec = (performance.now() - startTime) / 1000;
    const avgMbps = (totalBytesSent * 8) / (elapsedSec * 1_000_000);
    this.metricUpload.textContent = avgMbps.toFixed(2);
    document.getElementById('progress-upload').style.width = '100%';
    this.cardUpload.classList.remove('active-testing');
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.speedPulse = new SpeedPulseEngine();
});
