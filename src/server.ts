import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { loadData } from './data.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import historyRouter from './routes/history.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Load stored local data as fallback
loadData();

// Connect to MongoDB Atlas if MONGODB_URI is provided
const MONGODB_URI = process.env.MONGODB_URI;
if (MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI)
    .then(() => console.log('🍃 Connected to MongoDB Atlas Cloud Database'))
    .catch((err) => console.error('⚠️ MongoDB Atlas Connection Error:', err.message));
}

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/history', historyRouter);

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
