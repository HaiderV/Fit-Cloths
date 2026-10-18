/**
 * Measurement API Service for Fit-Cloth
 * Connects frontend to Express endpoint (/api/measurements/predict)
 */

export const API_BASE_URL =
    import.meta.env?.VITE_API_BASE_URL ||
    import.meta.env?.VITE_API_URL ||
    'http://localhost:5001';

/**
 * Checks connectivity with the measurement service via Express
 */
export async function checkMeasurementStatus() {
    try {
        const res = await fetch(`${API_BASE_URL}/api/measurements/status`);
        return await res.json();
    } catch (err) {
        return {
            success: false,
            service: 'express_or_flask',
            status: 'offline',
            error: err.message,
        };
    }
}

/**
 * Sends front and side profile photos + height to Express backend for Gemma photo-validation
 * and MediaPipe tailored body measurement prediction.
 *
 * @param {Object} params
 * @param {File|Blob} params.frontImage - Front view body photo
 * @param {File|Blob} params.sideImage - Side profile body photo
 * @param {number|string} params.heightCm - Height in centimeters (100 - 250)
 * @param {string} [params.gender='neutral'] - Anatomical prior ('male', 'female', 'neutral')
 * @param {string} [params.garmentType='traditional'] - Garment type for ease allowance
 * @returns {Promise<Object>} API response payload
 */
export async function predictMeasurements({ frontImage, sideImage, heightCm, gender = 'neutral', garmentType = 'traditional' }) {
    if (!frontImage || !sideImage) {
        throw new Error('Both Front View and Side Profile photos are required.');
    }

    const numHeight = parseFloat(heightCm);
    if (isNaN(numHeight) || numHeight < 100 || numHeight > 250) {
        throw new Error('Height must be between 100 cm and 250 cm.');
    }

    const formData = new FormData();
    formData.append('front_image', frontImage);
    formData.append('side_image', sideImage);
    formData.append('height_cm', String(numHeight));
    formData.append('gender', gender);
    formData.append('garment_type', garmentType);

    let res;
    try {
        res = await fetch(`${API_BASE_URL}/api/measurements/predict`, {
            method: 'POST',
            body: formData,
        });
    } catch (networkErr) {
        throw new Error(
            'Unable to connect to the Fit Cloths server. Please verify the Express backend is running.'
        );
    }

    let payload;
    try {
        payload = await res.json();
    } catch (jsonErr) {
        throw new Error(`Server returned non-JSON response (HTTP ${res.status}).`);
    }

    if (!res.ok) {
        const error = new Error(payload.message || `Measurement failed with HTTP status ${res.status}`);
        error.status = res.status;
        error.stage = payload.stage;
        error.validation = payload.validation;
        error.retake = payload.retake;
        throw error;
    }

    return payload;
}
