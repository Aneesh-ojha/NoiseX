export function initSolutionHUD() {
  const cards = document.querySelectorAll('.pipeline-card');
  if (!cards.length) return;

  const nodeData = {
    input: {
      badge: 'ADAU1761 CODEC',
      title: 'Raw Acoustic Ingestion',
      desc: 'Ingests line-in or microphone acoustic data at 16 kHz 24-bit precision via I2S, transferring packets to Zynq memory buffers without CPU overhead.',
      rate: '16.0 kHz',
      proc: 'ADAU1761 Codec',
      latency: '< 0.1 ms'
    },
    preproc: {
      badge: 'DMA & BUFFERING',
      title: 'Frame Buffering & Windowing',
      desc: 'Divides incoming streams into 512-sample overlapping frames (75% overlap) with Hanning windowing to prevent boundary spectral leakage.',
      rate: '512 samples/frame',
      proc: 'ARM Core (PS)',
      latency: '0.3 ms'
    },
    ml: {
      badge: 'RANDOM FOREST ML',
      title: 'Acoustic Threat Identification',
      desc: 'Extracts 13 MFCCs, Spectral Flux, and Zero-Crossing Rate to identify specific acoustic disturbance profiles (Cockpit Rotor, Jet Engine, Drone Hum).',
      rate: '100 Hz Inference',
      proc: 'Dual Cortex-A9',
      latency: '0.8 ms'
    },
    spectral: {
      badge: 'FPGA DSP48E1',
      title: 'STFT Spectral Subtraction',
      desc: 'Executed within Artix-7 logic slices to calculate real-time FFT, apply over-subtraction factors to the noise profile, and restore speech components.',
      rate: 'Parallel Pipeline',
      proc: 'Artix-7 PL Fabric',
      latency: '0.4 ms'
    },
    wavelet: {
      badge: 'FPGA DSP48E1',
      title: 'Discrete Wavelet Soft Thresholding',
      desc: 'Performs multi-level DWT decomposition to isolate and attenuate sharp non-stationary transient noise (clicks, pops, rotor beat) without muffled artifacts.',
      rate: 'Cycle-Accurate',
      proc: 'Artix-7 PL Fabric',
      latency: '0.5 ms'
    },
    output: {
      badge: 'DAC BUFFER',
      title: 'Enhanced Speech Stream',
      desc: 'Applies inverse transform with Overlap-Add (OLA) phase synthesis, delivering clean, intelligibility-boosted speech directly to destination comms.',
      rate: '16.0 kHz / Clean',
      proc: 'Audio DAC Pipeline',
      latency: 'Total < 2.0 ms'
    }
  };

  const badgeEl = document.getElementById('inspector-badge');
  const titleEl = document.getElementById('inspector-title');
  const descEl  = document.getElementById('inspector-desc');
  const rateEl  = document.getElementById('stat-sample-rate');
  const procEl  = document.getElementById('stat-processor');
  const latEl   = document.getElementById('stat-latency');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => {
        c.classList.remove('active');
        c.classList.remove('border-cyan-400', 'border-purple-400', 'border-amber-400', 'border-emerald-400');
      });
      card.classList.add('active');

      const nodeKey = card.getAttribute('data-node');
      const data = nodeData[nodeKey];
      if (!data) return;

      if (badgeEl) badgeEl.textContent = data.badge;
      if (titleEl) titleEl.textContent = data.title;
      if (descEl)  descEl.textContent  = data.desc;
      if (rateEl)  rateEl.textContent  = data.rate;
      if (procEl)  procEl.textContent  = data.proc;
      if (latEl)   latEl.textContent   = data.latency;
    });
  });
}