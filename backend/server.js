const express = require('express');
const cors = require('cors');
require('dotenv').config();

const productRoutes = require('./routes/productRoutes');
const measurementRoutes = require('./routes/measurementRoutes');

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS for frontend requests
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// Root Route: simple status message as requested
app.get('/', (req, res) => {
    // If client specifically asks for JSON, respond with JSON object
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(200).json({
            success: true,
            message: 'Fit-Cloth backend is running',
            endpoints: {
                products: '/api/products',
                productById: '/api/products/:id',
                categories: '/api/products/categories',
                trending: '/api/products/trending',
                predictMeasurements: '/api/measurements/predict',
                measurementServiceStatus: '/api/measurements/status',
            },
        });
    }
    // Default plain text for browser / curl
    res.status(200).send('Fit-Cloth backend is running');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Fit-Cloth backend is running',
        status: 'healthy',
        timestamp: new Date().toISOString(),
    });
});

// Mount Product Routes (supports both /api/products and /products)
app.use('/api/products', productRoutes);
app.use('/products', productRoutes);

// Mount Measurement Routes
app.use('/api/measurements', measurementRoutes);

// ai routes
app.use("/api/ai", require("./routes/ai"));

// Catch-all 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal Server Error',
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Fit-Cloth backend running on http://localhost:${PORT}`);
});