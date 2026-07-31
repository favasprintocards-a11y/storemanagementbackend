import { Router, Request, Response } from 'express';
import { getHistoryLogs, setHistoryLogs, getProducts, setProducts } from '../data.js';
import { StockHistoryLog, StockStatus } from '../types.js';

const router = Router();

function calculateStatus(qty: number, threshold: number): StockStatus {
  if (qty <= 0) return 'Out of Stock';
  if (qty <= threshold) return 'Low Stock';
  return 'In Stock';
}

// GET history logs
router.get('/', (_req: Request, res: Response) => {
  res.json(getHistoryLogs());
});

// POST record stock adjustment
router.post('/adjust', (req: Request, res: Response) => {
  const { productId, type, changeQty, note } = req.body;

  const products = getProducts();
  let index = products.findIndex(p => p.id === productId);

  if (index === -1 && productId) {
    index = products.findIndex(p => p.name.toLowerCase() === productId.toLowerCase());
  }

  if (index === -1) {
    res.status(404).json({ error: 'Product no longer exists in inventory. Please refresh the page.' });
    return;
  }

  const product = products[index];
  const delta = Number(changeQty) || 0;
  const previousQty = product.quantity;
  const newQty = type === 'add' ? previousQty + delta : Math.max(0, previousQty - delta);

  // Update product quantity and status
  product.quantity = newQty;
  product.status = calculateStatus(newQty, product.minThreshold);
  product.lastUpdated = new Date().toISOString();
  products[index] = product;
  setProducts(products);

  // Log stock history
  const logs = getHistoryLogs();
  const logEntry: StockHistoryLog = {
    id: `LOG-${Date.now()}`,
    productId: product.id,
    productName: product.name,
    category: product.category,
    type: type === 'add' ? 'add' : 'minus',
    changeQty: type === 'add' ? Math.abs(delta) : -Math.abs(delta),
    previousQty,
    newQty,
    unit: product.unit,
    timestamp: new Date().toISOString(),
    note: note || (type === 'add' ? 'Stock added' : 'Stock reduced')
  };

  logs.unshift(logEntry);
  setHistoryLogs(logs);

  res.status(201).json({ product, log: logEntry });
});

// DELETE a specific log entry by log ID or product ID
router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const logs = getHistoryLogs();
  const filtered = logs.filter(l => l.id !== id && l.productId !== id);
  setHistoryLogs(filtered);
  res.json(filtered);
});

// DELETE clear all history logs
router.delete('/', (_req: Request, res: Response) => {
  setHistoryLogs([]);
  res.json([]);
});

export default router;
