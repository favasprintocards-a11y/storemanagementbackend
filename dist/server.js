import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import dns from 'dns';
import { loadData, syncWithMongoDB } from './data.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import historyRouter from './routes/history.js';
// Configure DNS fallback for MongoDB Atlas SRV resolution
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
}
catch (e) {
    // Ignore if custom DNS fallback cannot be set
}
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
// Load stored local data as fallback
loadData();
// Connect to MongoDB Atlas if MONGODB_URI is provided
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
    mongoose
        .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 8000
    })
        .then(async () => {
        console.log('🍃 Connected to MongoDB Atlas Cloud Database');
        await syncWithMongoDB();
    })
        .catch((err) => {
        console.error('⚠️ MongoDB Atlas Connection Error:', err.message);
        if (err.message.includes('querySrv') || err.message.includes('ECONNREFUSED')) {
            console.warn('💡 Tip: Ensure your current IP is whitelisted in MongoDB Atlas Network Access and that your network DNS resolves SRV records.');
        }
    });
}
// Middleware
app.use(cors());
app.use(express.json());
// Routes
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/history', historyRouter);
// Root endpoint welcome & status message
app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Printo Store Management Backend API',
        message: 'Backend server is live and operational.',
        endpoints: {
            health: '/api/health',
            products: '/api/products',
            categories: '/api/categories',
            history: '/api/history'
        },
        db: mongoose.connection.readyState === 1 ? 'MongoDB Atlas' : 'Local JSON Store'
    });
});
// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Printo Store Backend',
        db: mongoose.connection.readyState === 1 ? 'MongoDB Atlas' : 'Local JSON Store',
        time: new Date().toISOString()
    });
});
app.listen(PORT, () => {
    console.log(`🚀 Printo Store Backend running on http://localhost:${PORT}`);
});
