# NoiseX DSP Backend

A **Flask REST API** that performs real-time audio noise reduction using a two-stage DSP pipeline (spectral subtraction + wavelet denoising) and a heuristic noise-type classifier.

---

## Quick Start

```bash
cd backend
bash run.sh
```

`run.sh` will:
1. Create a Python virtual environment (`.venv/`) on first run.
2. Install all dependencies from `requirements.txt`.
3. Start the Flask development server on **http://localhost:5000**.

For production, replace the final `python app.py` step with:

```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

---

## API Endpoints

### `GET /health`

Health check.

**Response**
```json
{ "status": "ok", "service": "NoiseX DSP Backend" }
```

---

### `POST /api/process-audio`

Upload an audio file for noise reduction and classification.

**Request**  
`Content-Type: multipart/form-data`

| Field   | Type | Description                         |
|---------|------|-------------------------------------|
| `audio` | File | WAV, MP3, FLAC, or OGG audio file   |

**Response (success)**
```json
{
  "success": true,
  "classification": "COMPOSITE BATTLEFIELD CLUTTER",
  "confidence": 0.75,
  "enhanced_wav_b64": "<base64-encoded PCM-16 WAV>",
  "metadata": {
    "duration": 2.54,
    "sample_rate": 16000,
    "channels": 1,
    "peak_dbfs": -0.45,
    "rms_dbfs": -18.3
  },
  "snr_improvement": 8.2,
  "rms_reduction": 3.1,
  "crest_factor": 4.12
}
```

**Response (error)**
```json
{ "success": false, "error": "...", "traceback": "..." }
```

---

## DSP Pipeline

```
Input audio
    │
    ▼
load_audio()            ← resample to 16 kHz, convert to mono, peak-normalise
    │
    ├──► extract_features() + classify_noise()   (noise type classification)
    │
    ▼
spectral_subtract()     ← STFT → over-subtraction (α=2, β=0.005) → ISTFT
    │
    ▼
wavelet_denoise()       ← DWT (db4, 3 levels) → VisuShrink threshold → IDWT
    │
    ▼
reconstruct()           ← blend(spectral=0.6, wavelet=0.4)
    │
    ▼
Enhanced WAV (int16, base64-encoded)
```

---

## Dependencies

| Package       | Purpose                              |
|---------------|--------------------------------------|
| `flask`       | HTTP server / routing                |
| `flask-cors`  | Cross-Origin Resource Sharing        |
| `numpy`       | Array maths                          |
| `scipy`       | STFT/ISTFT, resampling               |
| `PyWavelets`  | DWT decomposition / reconstruction   |
| `soundfile`   | WAV read/write                       |
| `librosa`     | MP3 / exotic format fallback loader  |
| `gunicorn`    | Production WSGI server               |

---

## Offline Fallback

If this backend is **offline or unreachable**, the NoiseX frontend automatically
falls back to its built-in **browser-side DSP** (Web Audio API + WebAssembly),
so users always receive noise-reduction results regardless of backend availability.
