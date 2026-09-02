"""
NoiseX REST API Server
Audio Preprocessing, DSP Filtering,
and Machine Learning Threat Vector Classification.
"""

import io
import base64
import os
import time

import numpy as np
import soundfile as sf
from flask import Flask, request, jsonify
from flask_cors import CORS

from audio.preprocessing import load_audio, get_metadata
from dsp.spectral_subtraction import spectral_subtract
from dsp.wavelet import wavelet_denoise
from ml.classifier import classify_audio


app = Flask(__name__)
CORS(app)


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for frontend connection status."""
    return jsonify({
        "status": "online",
        "version": "1.0.0",
        "engine": "Python DSP + PyWavelets"
    }), 200


@app.route("/api/process-audio", methods=["POST"])
def process_audio():
    """
    Process an uploaded audio file through:

    1. Audio loading and preprocessing
    2. ML threat/noise classification
    3. Spectral subtraction
    4. Wavelet denoising
    5. Audio metrics calculation
    6. Enhanced WAV generation

    Expects:
        multipart/form-data
        field name: "audio"
    """

    # ---------------------------------------------------------
    # 1. Validate request
    # ---------------------------------------------------------

    if "audio" not in request.files:
        return jsonify({
            "success": False,
            "error": "No audio file provided."
        }), 400

    file = request.files["audio"]

    if not file.filename:
        return jsonify({
            "success": False,
            "error": "Empty filename provided."
        }), 400

    try:
        processing_start = time.perf_counter()

        # -----------------------------------------------------
        # 2. Read uploaded audio
        # -----------------------------------------------------

        audio_bytes = file.read()

        if not audio_bytes:
            return jsonify({
                "success": False,
                "error": "Uploaded audio file is empty."
            }), 400

        # -----------------------------------------------------
        # 3. Load and preprocess
        #    Target: 16 kHz mono
        # -----------------------------------------------------

        target_sr = 16000

        raw_audio, sr = load_audio(
            io.BytesIO(audio_bytes),
            target_sr=target_sr
        )

        raw_audio = np.asarray(raw_audio, dtype=np.float32)

        if len(raw_audio) == 0:
            return jsonify({
                "success": False,
                "error": "Audio contains no samples."
            }), 400

        # Keep signal numerically stable
        raw_audio = np.nan_to_num(
            raw_audio,
            nan=0.0,
            posinf=0.0,
            neginf=0.0
        )

        orig_meta = get_metadata(raw_audio, sr)

        # -----------------------------------------------------
        # 4. ML threat/noise classification
        # -----------------------------------------------------

        category, confidence, features = classify_audio(
            raw_audio,
            sr
        )

        confidence = float(confidence)

        # -----------------------------------------------------
        # 5. DSP Stage 1
        #    Spectral Subtraction
        # -----------------------------------------------------

        stage1_audio = spectral_subtract(
    raw_audio,
    sr=sr,
    n_fft=1024,
    hop_length=256,
    alpha=2.2,
    beta=0.008,
    noise_duration=0.2
)

        stage1_audio = np.asarray(
            stage1_audio,
            dtype=np.float32
        )

        stage1_audio = np.nan_to_num(
            stage1_audio,
            nan=0.0,
            posinf=0.0,
            neginf=0.0
        )

        # -----------------------------------------------------
        # 6. DSP Stage 2
        #    Wavelet Soft Thresholding
        # -----------------------------------------------------

        enhanced_audio = wavelet_denoise(
    stage1_audio,
         wavelet="db10",
         level=9,
        threshold_mode="soft"
    )

        enhanced_audio = np.asarray(
            enhanced_audio,
            dtype=np.float32
        )

        enhanced_audio = np.nan_to_num(
            enhanced_audio,
            nan=0.0,
            posinf=0.0,
            neginf=0.0
        )

        # -----------------------------------------------------
        # 7. Match lengths
        # -----------------------------------------------------

        N = min(
            len(raw_audio),
            len(enhanced_audio)
        )

        orig_slice = raw_audio[:N]
        enh_slice = enhanced_audio[:N]

        # -----------------------------------------------------
        # 8. Audio metrics
        # -----------------------------------------------------

        eps = 1e-9

        rms_orig = float(
            np.sqrt(
                np.mean(
                    np.square(orig_slice)
                )
            )
        )

        rms_enh = float(
            np.sqrt(
                np.mean(
                    np.square(enh_slice)
                )
            )
        )

        removed_signal = orig_slice - enh_slice

        rms_removed = float(
            np.sqrt(
                np.mean(
                    np.square(removed_signal)
                )
            )
        )

        # RMS attenuation/reduction
        rms_reduction_db = float(
            20.0 *
            np.log10(
                (rms_orig + eps) /
                (rms_enh + eps)
            )
        )

        # Amount of signal removed by the DSP pipeline
        suppression_ratio_db = float(
            20.0 *
            np.log10(
                (rms_orig + eps) /
                (rms_removed + eps)
            )
        )

        peak_orig = float(
            np.max(
                np.abs(orig_slice)
            )
        )

        peak_enh = float(
            np.max(
                np.abs(enh_slice)
            )
        )

        crest_factor = float(
            peak_enh /
            (rms_enh + eps)
        )

        # -----------------------------------------------------
        # IMPORTANT:
        #
        # This is NOT a true SNR improvement.
        #
        # A true SNR requires a clean reference signal.
        # Therefore we do not label this value as SNR.
        # -----------------------------------------------------

        # -----------------------------------------------------
        # 9. Processing time
        # -----------------------------------------------------

        processing_time_ms = float(
            (time.perf_counter() - processing_start)
            * 1000.0
        )

        # -----------------------------------------------------
        # 10. Encode enhanced audio as WAV
        # -----------------------------------------------------

        wav_io = io.BytesIO()

        sf.write(
            wav_io,
            enhanced_audio,
            sr,
            format="WAV",
            subtype="PCM_16"
        )

        wav_io.seek(0)

        wav_b64 = base64.b64encode(
            wav_io.getvalue()
        ).decode("utf-8")

        # -----------------------------------------------------
        # 11. Prepare metadata
        # -----------------------------------------------------

        metadata = {
            "sample_rate": int(sr),
            "channels": 1,
            "samples": int(N),
            "duration_seconds": round(
                float(N / sr),
                3
            ),
            "input_filename": file.filename
        }

        # -----------------------------------------------------
        # 12. Response
        # -----------------------------------------------------

        return jsonify({
            "success": True,

            "classification": {
                "category": category,
                "confidence": round(
                    confidence,
                    4
                )
            },

            "metrics": {
                "rms_reduction_db": round(
                    rms_reduction_db,
                    2
                ),

                "suppression_ratio_db": round(
                    suppression_ratio_db,
                    2
                ),

                "crest_factor": round(
                    crest_factor,
                    2
                ),

                "input_rms": round(
                    rms_orig,
                    6
                ),

                "output_rms": round(
                    rms_enh,
                    6
                ),

                "input_peak": round(
                    peak_orig,
                    6
                ),

                "output_peak": round(
                    peak_enh,
                    6
                ),

                "processing_time_ms": round(
                    processing_time_ms,
                    2
                )
            },

            "metadata": metadata,

            "pipeline": [
                "Audio preprocessing",
                "ML threat classification",
                "Spectral subtraction",
                "Wavelet denoising"
            ],

            "enhanced_wav_b64": wav_b64

        }), 200

    except Exception as e:

        app.logger.exception(
            "Audio processing failed"
        )

        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# -------------------------------------------------------------
# Application entry point
# -------------------------------------------------------------

if __name__ == "__main__":

    port = int(
        os.environ.get(
            "PORT",
            5000
        )
    )

    print(
        f"[*] Starting NoiseX Backend "
        f"on http://localhost:{port}"
    )

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )