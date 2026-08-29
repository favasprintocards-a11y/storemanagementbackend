import { Router, Request, Response } from 'express';
import { getHistoryLogs, setHistoryLogs, getProducts, setProducts } from '../data.js';
import { StockHistoryLog, StockStatus } from '../types.js';

const router = Router();

function calculateStatus(qty: number, threshold: number): StockStatus {
  if (qty <= 0) return 'Out of Stock';
  if (qty <= threshold) return 'Low Stock';
  return 'In Stock';
}

function isWithinDateRange(timestampStr: string, dateRange?: string, startDate?: string, endDate?: string, selectedMonth?: string): boolean {
  if (!dateRange || dateRange === 'all') return true;
  if (!timestampStr) return false;
  const itemDate = new Date(timestampStr);
  if (isNaN(itemDate.getTime())) return true;
  const now = new Date();

  if (dateRange === 'today') {
    return itemDate.getDate() === now.getDate() && itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
  }
  if (dateRange === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return itemDate.getDate() === yesterday.getDate() && itemDate.getMonth() === yesterday.getMonth() && itemDate.getFullYear() === yesterday.getFullYear();
  }
  if (dateRange === '7days') {
    const d = new Date(now);
    d.setDate(now.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return itemDate >= d && itemDate <= now;
  }
  if (dateRange === '30days') {
    const d = new Date(now);
    d.setDate(now.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return itemDate >= d && itemDate <= now;
  }
  if (dateRange === 'this_month') {
    return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
  }
  if (dateRange === 'specific_month' || (selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth))) {
    const targetMonthStr = selectedMonth || (dateRange.includes('-') ? dateRange : '');
    if (targetMonthStr && /^\d{4}-\d{2}$/.test(targetMonthStr)) {
      const [yearStr, monthStr] = targetMonthStr.split('-');
      const targetYear = parseInt(yearStr, 10);
      const targetMonth = parseInt(monthStr, 10) - 1;
      return itemDate.getFullYear() === targetYear && itemDate.getMonth() === targetMonth;
    }
  }
  if (dateRange === 'custom') {
    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      if (itemDate < s) return false;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      if (itemDate > e) return false;
    }
    return true;
  }
  return true;
}

// GET history logs with optional date range query params
router.get('/', async (req: Request, res: Response) => {
  const { dateRange, startDate, endDate, selectedMonth } = req.query;
  const logs = await getHistoryLogs();
  
  if (!dateRange || dateRange === 'all') {
    res.json(logs);
    return;
  }

  const filtered = logs.filter(log =>
    isWithinDateRange(
      log.timestamp,
      String(dateRange),
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
      selectedMonth ? String(selectedMonth) : undefined
    )
  );
  res.json(filtered);
});

// POST record stock adjustment
router.post('/adjust', async (req: Request, res: Response) => {
  const { productId, type, changeQty, note, timestamp } = req.body;

  const products = await getProducts();
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

  const logTimestamp = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

  // Update product quantity and status
  product.quantity = newQty;
  product.status = calculateStatus(newQty, product.minThreshold);
  product.lastUpdated = logTimestamp;
  products[index] = product;
  await setProducts(products);

  // Log stock history
  const logs = await getHistoryLogs();
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
    timestamp: logTimestamp,
    note: note || (type === 'add' ? 'Stock added' : 'Stock reduced')
  };

  logs.unshift(logEntry);
  await setHistoryLogs(logs);

  res.status(201).json({ product, log: logEntry });
});

// DELETE a specific log entry by log ID or product ID
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const logs = await getHistoryLogs();
  const targetLogIndex = logs.findIndex(l => l.id === id);

  if (targetLogIndex !== -1) {
    const targetLog = logs[targetLogIndex];
    const products = await getProducts();
    const prodIndex = products.findIndex(
      p => p.id === targetLog.productId || p.name.trim().toLowerCase() === targetLog.productName.trim().toLowerCase()
    );

    if (prodIndex !== -1) {
      const product = products[prodIndex];
      const changeQty = Number(targetLog.changeQty) || 0;

      // Revert stock shift recorded in history:
      // If history added stock (add/create or >0), deleting the log minuses/deducts stock.
      // If history reduced stock (minus or <0), deleting the log adds stock back.
      let adjustedQty = product.quantity;
      if (targetLog.type === 'add' || targetLog.type === 'create' || changeQty > 0) {
        adjustedQty = Math.max(0, product.quantity - Math.abs(changeQty));
      } else if (targetLog.type === 'minus' || changeQty < 0) {
        adjustedQty = product.quantity + Math.abs(changeQty);
      }

      product.quantity = adjustedQty;
      product.status = calculateStatus(adjustedQty, product.minThreshold);
      product.lastUpdated = new Date().toISOString();
      products[prodIndex] = product;
      await setProducts(products);
    }

    logs.splice(targetLogIndex, 1);
    await setHistoryLogs(logs);
  } else {
    // Fallback if deleting by product ID
    const filtered = logs.filter(l => l.id !== id && l.productId !== id);
    await setHistoryLogs(filtered);
  }

  const updatedLogs = await getHistoryLogs();
  const updatedProducts = await getProducts();
  res.json({ logs: updatedLogs, products: updatedProducts });
});

// DELETE clear all history logs
router.delete('/', async (_req: Request, res: Response) => {
  await setHistoryLogs([]);
  res.json([]);
});

export default router;
