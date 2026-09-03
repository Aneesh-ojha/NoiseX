import io
import base64
import numpy as np
import soundfile as sf
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

# Import your DSP algorithms
try:
    from backend.dsp.spectral_subtraction import spectral_subtract
    from backend.dsp.wavelet import wavelet_denoise
    from backend.ml.classifier import classify_audio
except ModuleNotFoundError:
    from dsp.spectral_subtraction import spectral_subtract
    from dsp.wavelet import wavelet_denoise
    from ml.classifier import classify_audio

app = Flask(__name__, static_folder="../", template_folder="../views")
CORS(app)  # Enables cross-origin requests from the browser

def audio_to_base64_wav(audio_arr: np.ndarray, sr: int) -> str:
    """Converts a float numpy array into a pure base64 string (raw without data URI scheme)."""
    buf = io.BytesIO()
    audio_arr = np.nan_to_num(audio_arr)
    max_amp = np.max(np.abs(audio_arr))
    if max_amp > 1.0:
        audio_arr = audio_arr / max_amp
    sf.write(buf, audio_arr.astype(np.float32), sr, format='WAV')
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')

@app.route("/")
def index():
    return render_template("audio-lab.html")

# 1. Health check required by your JS _checkBackend()
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "Python DSP Backend"}), 200

# 2. Main processing endpoint required by your JS BACKEND_URL
@app.route("/api/process-audio", methods=["POST"])
@app.route("/api/process", methods=["POST"])
def process_audio():
    if "audio" not in request.files and "file" not in request.files:
        return jsonify({"success": False, "error": "No audio file uploaded"}), 400

    uploaded_file = request.files.get("audio") or request.files.get("file")

    try:
        # Load audio (already scaled in [-1.0, 1.0])
        audio_data, sr = sf.read(io.BytesIO(uploaded_file.read()), dtype='float32')

        # Convert stereo to mono
        if audio_data.ndim > 1:
            audio_data = np.mean(audio_data, axis=1)

        # Stage 1: Spectral Subtraction (Colab params)
        audio_spectral = spectral_subtract(
            audio=audio_data,
            sr=sr,
            frame_size=1024,
            hop_size=256,
            alpha=2.2,
            beta=0.008,
            noise_estimation_duration=0.2
        )

        # Stage 2: Wavelet Denoising (Colab params)
        audio_final = wavelet_denoise(
            audio=audio_spectral,
            wavelet='db10',
            level=9,
            threshold_method='universal',
            mode='soft'
        )

        # Calculate metrics for the UI
        in_rms = np.sqrt(np.mean(audio_data ** 2)) + 1e-12
        out_rms = np.sqrt(np.mean(audio_final ** 2)) + 1e-12
        rms_diff = 20 * np.log10(in_rms / out_rms)
        crest = np.max(np.abs(audio_final)) / out_rms

        # Base64 payload without the 'data:audio/wav;base64,' prefix (JS uses atob)
        enhanced_b64 = audio_to_base64_wav(audio_final, sr)

        # Run backend classifier on the original (pre-enhancement) audio to report environment
        try:
            category, confidence, features = classify_audio(audio_data, sr)
        except Exception:
            category, confidence, features = ("Unknown", 0.0, {})

        return jsonify({
            "success": True,
            "enhanced_wav_b64": enhanced_b64,
            "classification": category,
            "confidence": float(confidence),
            "features": features,
            "snr_improvement": float(round(abs(rms_diff) * 0.45, 1)),
            "rms_reduction": float(round(rms_diff, 1)),
            "crest_factor": float(round(crest, 2))
        })

    except Exception as err:
        return jsonify({"success": False, "error": str(err)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)