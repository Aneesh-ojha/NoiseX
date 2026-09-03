import numpy as np
from scipy.signal import stft, istft

def spectral_subtract(
    audio: np.ndarray,
    sr: int,
    frame_size: int = 1024,
    hop_size: int = 256,
    alpha: float = 2.2,
    beta: float = 0.008,
    noise_estimation_duration: float = 0.2,
) -> np.ndarray:
    # Ensure float32
    audio = audio.astype(np.float32)

    # Calculate noise frames based on duration
    noise_frames = int(noise_estimation_duration * sr) // hop_size
    if noise_frames == 0:
        noise_frames = 1

    # Generate spectrogram
    f, t, Zxx = stft(
        audio,
        fs=sr,
        nperseg=frame_size,
        noverlap=frame_size - hop_size,
        boundary=None
    )

    magnitude_spectrum = np.abs(Zxx)
    phase_spectrum = np.angle(Zxx)

    # Estimate noise magnitude spectrum from first frames
    noise_magnitude_spectrum = np.mean(magnitude_spectrum[:, :noise_frames], axis=1, keepdims=True)

    # Subtract noise
    denoised_magnitude_spectrum = magnitude_spectrum - (alpha * noise_magnitude_spectrum)

    # Spectral floor
    denoised_magnitude_spectrum = np.maximum(denoised_magnitude_spectrum, beta * magnitude_spectrum)

    # Reconstruct complex spectrogram
    denoised_Zxx = denoised_magnitude_spectrum * np.exp(1j * phase_spectrum)

    # Inverse STFT
    _, denoised_audio = istft(
        denoised_Zxx,
        fs=sr,
        nperseg=frame_size,
        noverlap=frame_size - hop_size
    )

    # Match original length exactly
    orig_len = len(audio)
    if len(denoised_audio) >= orig_len:
        return denoised_audio[:orig_len].astype(np.float32)
    else:
        return np.pad(denoised_audio, (0, orig_len - len(denoised_audio)), 'constant').astype(np.float32)