import { Router, Request, Response } from 'express';
import { getProducts, setProducts, getHistoryLogs, setHistoryLogs } from '../data.js';
import { InventoryItem, StockHistoryLog, StockStatus } from '../types.js';

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

// GET all products with optional date query parameters
router.get('/', async (req: Request, res: Response) => {
  const { dateRange, startDate, endDate, selectedMonth } = req.query;
  const products = await getProducts();

  if (!dateRange || dateRange === 'all') {
    res.json(products);
    return;
  }

  const filtered = products.filter(p =>
    isWithinDateRange(
      p.lastUpdated,
      String(dateRange),
      startDate ? String(startDate) : undefined,
      endDate ? String(endDate) : undefined,
      selectedMonth ? String(selectedMonth) : undefined
    )
  );
  res.json(filtered);
});

// POST create product
router.post('/', async (req: Request, res: Response) => {
  const { name, category, quantity, minThreshold, unit, image, supplier, description } = req.body;
  if (!name || !category) {
    res.status(400).json({ error: 'Name and category are required' });
    return;
  }

  const products = await getProducts();
  const qty = Number(quantity) || 0;
  const threshold = Number(minThreshold) || 5;

  const newItem: InventoryItem = {
    id: `PRD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    category,
    quantity: qty,
    minThreshold: threshold,
    unit: unit || 'pcs',
    status: calculateStatus(qty, threshold),
    image,
    supplier,
    description,
    lastUpdated: new Date().toISOString()
  };

  products.unshift(newItem);
  await setProducts(products);

  // Add history log
  const logs = await getHistoryLogs();
  const newLog: StockHistoryLog = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    productId: newItem.id,
    productName: newItem.name,
    category: newItem.category,
    type: 'create',
    changeQty: newItem.quantity,
    previousQty: 0,
    newQty: newItem.quantity,
    unit: newItem.unit,
    timestamp: new Date().toISOString(),
    note: 'Initial product creation'
  };
  logs.unshift(newLog);
  await setHistoryLogs(logs);

  res.status(201).json(newItem);
});

// PUT update product
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const products = await getProducts();
  let index = products.findIndex(p => p.id === id);

  if (index === -1 && id) {
    index = products.findIndex(p => p.id.toLowerCase() === id.toLowerCase());
  }
  if (index === -1 && req.body.name) {
    index = products.findIndex(p => p.name.toLowerCase() === req.body.name.toLowerCase());
  }

  if (index === -1) {
    // Upsert product seamlessly if missing from database
    const { name, category, quantity, minThreshold, unit, image, supplier, description } = req.body;
    const qty = Number(quantity) || 0;
    const threshold = Number(minThreshold) || 5;
    const newItem: InventoryItem = {
      id: id || `PRD-${Date.now()}`,
      name: name || 'New Product',
      category: category || 'General',
      quantity: qty,
      minThreshold: threshold,
      unit: unit || 'piece',
      status: calculateStatus(qty, threshold),
      image,
      supplier,
      description,
      lastUpdated: new Date().toISOString()
    };
    products.unshift(newItem);
    await setProducts(products);
    res.status(200).json(newItem);
    return;
  }

  const existing = products[index];
  const { name, category, quantity, minThreshold, unit, image, supplier, description } = req.body;
  const newQty = quantity !== undefined ? Number(quantity) : existing.quantity;
  const newThreshold = minThreshold !== undefined ? Number(minThreshold) : existing.minThreshold;

  const updatedItem: InventoryItem = {
    ...existing,
    name: name ?? existing.name,
    category: category ?? existing.category,
    quantity: newQty,
    minThreshold: newThreshold,
    unit: unit ?? existing.unit,
    status: calculateStatus(newQty, newThreshold),
    image: image ?? existing.image,
    supplier: supplier ?? existing.supplier,
    description: description ?? existing.description,
    lastUpdated: new Date().toISOString()
  };

  products[index] = updatedItem;
  await setProducts(products);

  res.json(updatedItem);
});

// DELETE product
router.delete('/:id', async (req: Request, res: Response) => {
  const targetId = req.params.id ? decodeURIComponent(req.params.id).trim() : '';
  const products = await getProducts();
  const index = products.findIndex(
    p => p.id === targetId || p.id.toLowerCase() === targetId.toLowerCase() || p.name.toLowerCase() === targetId.toLowerCase()
  );

  if (index === -1) {
    res.status(404).json({ error: `Product "${targetId}" not found in inventory` });
    return;
  }

  const item = products[index];
  const updatedProducts = products.filter((_, i) => i !== index);
  await setProducts(updatedProducts);

  // Add history log for deletion
  const logs = await getHistoryLogs();
  const deleteLog: StockHistoryLog = {
    id: `LOG-${Date.now()}`,
    productId: item.id,
    productName: item.name,
    category: item.category,
    type: 'delete',
    changeQty: item.quantity,
    previousQty: item.quantity,
    newQty: 0,
    unit: item.unit,
    timestamp: new Date().toISOString(),
    note: 'Product deleted from inventory'
  };
  logs.unshift(deleteLog);
  await setHistoryLogs(logs);

  res.json({ message: 'Product deleted successfully', id: item.id });
});

export default router;
