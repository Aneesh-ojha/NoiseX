"""
audio/preprocessing.py
----------------------
Audio loading, resampling, and metadata extraction utilities.
"""

import numpy as np
import soundfile as sf
import scipy.signal as signal


def load_audio(file_path_or_bytes, target_sr: int = 16000):
    """
    Load an audio file from a file path or bytes-like object.

    Parameters
    ----------
    file_path_or_bytes : str or bytes-like
        Path to an audio file (WAV, MP3, FLAC, OGG ...) or a bytes/BytesIO buffer.
    target_sr : int
        Target sample rate to resample to (default 16 000 Hz).

    Returns
    -------
    audio : np.ndarray  (float32, shape [N])
        Mono, peak-normalised audio array.
    sr : int
        Actual sample rate (== target_sr after resampling).
    """
    # --- load -----------------------------------------------------------
    try:
        audio_data, orig_sr = sf.read(file_path_or_bytes, always_2d=True)
    except Exception:
        # Fallback to librosa for MP3 and other formats soundfile cannot handle
        import librosa
        audio_data, orig_sr = librosa.load(file_path_or_bytes, sr=None, mono=False)
        if audio_data.ndim == 1:
            audio_data = audio_data[:, np.newaxis]
        else:
            # librosa returns (channels, samples) -- transpose to (samples, channels)
            audio_data = audio_data.T

    # --- to mono --------------------------------------------------------
    if audio_data.shape[1] > 1:
        audio = np.mean(audio_data, axis=1)
    else:
        audio = audio_data[:, 0]

    audio = audio.astype(np.float32)

    # --- resample -------------------------------------------------------
    if orig_sr != target_sr:
        from math import gcd
        g = gcd(target_sr, orig_sr)
        up = target_sr // g
        down = orig_sr // g
        audio = signal.resample_poly(audio, up, down).astype(np.float32)

    # --- peak normalise to 0.95 -----------------------------------------
    peak = np.max(np.abs(audio))
    if peak > 0:
        audio = audio * (0.95 / peak)

    return audio, target_sr


def get_metadata(audio: np.ndarray, sr: int) -> dict:
    """
    Return a metadata dictionary for a mono audio array.

    Parameters
    ----------
    audio : np.ndarray
        Mono float audio signal.
    sr : int
        Sample rate in Hz.

    Returns
    -------
    dict with keys: duration, sample_rate, channels, peak_dbfs, rms_dbfs
    """
    duration = len(audio) / sr
    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(audio ** 2)))

    # Avoid log(0)
    peak_dbfs = float(20 * np.log10(peak + 1e-12))
    rms_dbfs = float(20 * np.log10(rms + 1e-12))

    return {
        "duration": round(duration, 4),
        "sample_rate": sr,
        "channels": 1,
        "peak_dbfs": round(peak_dbfs, 2),
        "rms_dbfs": round(rms_dbfs, 2),
    }
