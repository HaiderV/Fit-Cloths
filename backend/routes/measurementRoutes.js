const express = require('express');
const router = express.Router();
const multer = require('multer');

// Configure multer with memory storage (buffers kept in RAM)
// 15MB limit per request to mirror Flask service constraints
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024, // 15MB max file size
        files: 2,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Please upload JPEG, PNG, or WebP images.`));
        }
    },
});

const uploadFields = upload.fields([
    { name: 'front_image', maxCount: 1 },
    { name: 'side_image', maxCount: 1 },
]);

/**
 * Health / connectivity check endpoint to verify Express can reach Flask AI service
 * GET /api/measurements/status
 */
router.get('/status', async (req, res) => {
    const flaskBaseUrl = process.env.FLASK_API_URL || process.env.AI_SERVICE_URL || 'http://127.0.0.1:5000';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const flaskRes = await fetch(`${flaskBaseUrl}/`, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!flaskRes.ok) {
            return res.status(502).json({
                success: false,
                service: 'flask',
                status: 'unhealthy',
                flaskUrl: flaskBaseUrl,
                statusCode: flaskRes.status,
            });
        }

        const data = await flaskRes.json();
        return res.status(200).json({
            success: true,
            service: 'flask',
            status: 'online',
            flaskUrl: flaskBaseUrl,
            flaskResponse: data,
        });
    } catch (err) {
        return res.status(503).json({
            success: false,
            service: 'flask',
            status: 'unreachable',
            flaskUrl: flaskBaseUrl,
            error: err.name === 'AbortError' ? 'Flask health check timed out' : err.message,
        });
    }
});

/**
 * Measurement Prediction Route
 * POST /api/measurements/predict
 */
router.post('/predict', (req, res) => {
    uploadFields(req, res, async (uploadErr) => {
        // 1. Handle multer upload errors
        if (uploadErr) {
            if (uploadErr.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    success: false,
                    status: 'error',
                    message: 'Uploaded images exceed the 15 MB limit.',
                });
            }
            return res.status(400).json({
                success: false,
                status: 'error',
                message: uploadErr.message || 'File upload error',
            });
        }

        try {
            // 2. Validate presence of required images
            const files = req.files || {};
            const frontFile = files.front_image && files.front_image[0];
            const sideFile = files.side_image && files.side_image[0];

            const missing = [];
            if (!frontFile || !frontFile.buffer || frontFile.buffer.length === 0) {
                missing.push('front_image');
            }
            if (!sideFile || !sideFile.buffer || sideFile.buffer.length === 0) {
                missing.push('side_image');
            }

            if (missing.length > 0) {
                return res.status(400).json({
                    success: false,
                    status: 'error',
                    message: `Missing required image files: ${missing.join(', ')}`,
                });
            }

            // 3. Validate height_cm, gender, and garment_type
            const rawHeight = req.body.height_cm;
            const heightCm = parseFloat(rawHeight);

            if (isNaN(heightCm)) {
                return res.status(400).json({
                    success: false,
                    status: 'error',
                    message: 'Please provide a valid height_cm number.',
                });
            }

            if (heightCm < 100 || heightCm > 250) {
                return res.status(400).json({
                    success: false,
                    status: 'error',
                    message: 'Height must be between 100 and 250 cm.',
                });
            }

            const rawGender = (req.body.gender || 'neutral').trim().toLowerCase();
            const validGenders = ['male', 'female', 'neutral'];
            const gender = validGenders.includes(rawGender) ? rawGender : 'neutral';

            const garmentType = (req.body.garment_type || 'traditional').trim().toLowerCase();

            // 4. Construct multipart form data for Flask
            const formData = new FormData();
            formData.append(
                'front_image',
                new Blob([frontFile.buffer], { type: frontFile.mimetype || 'image/jpeg' }),
                frontFile.originalname || 'front_image.jpg'
            );
            formData.append(
                'side_image',
                new Blob([sideFile.buffer], { type: sideFile.mimetype || 'image/jpeg' }),
                sideFile.originalname || 'side_image.jpg'
            );
            formData.append('height_cm', String(heightCm));
            formData.append('gender', gender);
            formData.append('garment_type', garmentType);

            // 5. Forward to Flask service
            const flaskBaseUrl = process.env.FLASK_API_URL || process.env.AI_SERVICE_URL || 'http://127.0.0.1:5000';
            const flaskEndpoint = `${flaskBaseUrl}/api/predict-measurements`;

            // Timeout set to 360s (6 minutes) to accommodate 3D fitting and vision inference
            let flaskRes;
            try {
                flaskRes = await fetch(flaskEndpoint, {
                    method: 'POST',
                    body: formData,
                    signal: AbortSignal.timeout(360000),
                });
            } catch (networkErr) {
                if (networkErr.name === 'TimeoutError' || networkErr.name === 'AbortError') {
                    return res.status(504).json({
                        success: false,
                        status: 'error',
                        message: 'Measurement analysis timed out while waiting for AI service.',
                    });
                }
                return res.status(503).json({
                    success: false,
                    status: 'error',
                    message: 'AI measurement service is currently offline or unreachable. Ensure Flask and Ollama are running.',
                    detail: networkErr.message,
                });
            }

            // 6. Parse response from Flask
            let responseData;
            const contentType = flaskRes.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                responseData = await flaskRes.json();
            } else {
                const text = await flaskRes.text();
                responseData = { message: text };
            }

            // Forward the HTTP status code from Flask (e.g. 200, 422 for photo validation, 400, 503)
            return res.status(flaskRes.status).json({
                success: flaskRes.ok,
                ...responseData,
            });

        } catch (serverErr) {
            console.error('Error in measurement prediction route:', serverErr.message);
            return res.status(500).json({
                success: false,
                status: 'error',
                message: 'An unexpected error occurred while processing measurements.',
            });
        }
    });
});

module.exports = router;
