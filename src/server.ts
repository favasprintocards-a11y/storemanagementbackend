import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { loadData } from './data.js';
import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import historyRouter from './routes/history.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Load stored data
loadData();

// Middleware - Allow CORS for all dev origins
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/products', productsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/history', historyRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Printo Store Backend', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Printo Store Backend running on http://localhost:${PORT}`);
});
