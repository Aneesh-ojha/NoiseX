"""
dsp/metrics.py
--------------
Perceptual quality and noise-reduction metrics.

Note
----
Without a clean reference signal, true SNR cannot be measured.
The 'snr_improvement' value returned here is an *estimate* based on the
ratio of the enhanced signal's RMS to the RMS of the removed component
(original - enhanced).  It should be interpreted as a relative indicator
only, not an absolute SNR measurement.
"""

import numpy as np


def calculate_metrics(original: np.ndarray, enhanced: np.ndarray) -> dict:
    """
    Compute noise-reduction quality metrics between the original and enhanced
    audio arrays.

    Parameters
    ----------
    original : np.ndarray  -- raw (noisy) input signal
    enhanced : np.ndarray  -- denoised output signal

    Returns
    -------
    dict with keys:
        snr_improvement   (float, dB)  -- estimated SNR improvement
        rms_reduction     (float, dB)  -- how much overall RMS decreased
        crest_factor      (float)      -- peak-to-RMS ratio of enhanced signal
        rms_original_dbfs (float, dB)  -- RMS of original in dBFS
        rms_enhanced_dbfs (float, dB)  -- RMS of enhanced in dBFS
    """
    # Align lengths
    min_len = min(len(original), len(enhanced))
    orig = original[:min_len].astype(np.float64)
    enh = enhanced[:min_len].astype(np.float64)

    eps = 1e-12  # prevent log(0)

    rms_original = np.sqrt(np.mean(orig ** 2))
    rms_enhanced = np.sqrt(np.mean(enh ** 2))

    # RMS reduction (how much the overall energy decreased)
    rms_reduction_db = float(20 * np.log10((rms_original + eps) / (rms_enhanced + eps)))

    # "Removed noise" component
    diff = orig - enh
    rms_diff = np.sqrt(np.mean(diff ** 2))

    # SNR improvement estimate: signal vs removed-noise RMS
    snr_improvement_db = float(20 * np.log10((rms_enhanced + eps) / (rms_diff + eps)))

    # Crest factor of enhanced signal
    peak_enhanced = float(np.max(np.abs(enh)))
    crest_factor = float(peak_enhanced / (rms_enhanced + eps))

    # dBFS values
    rms_original_dbfs = float(20 * np.log10(rms_original + eps))
    rms_enhanced_dbfs = float(20 * np.log10(rms_enhanced + eps))

    return {
        "snr_improvement": round(snr_improvement_db, 2),   # estimated
        "rms_reduction": round(rms_reduction_db, 2),
        "crest_factor": round(crest_factor, 3),
        "rms_original_dbfs": round(rms_original_dbfs, 2),
        "rms_enhanced_dbfs": round(rms_enhanced_dbfs, 2),
    }
