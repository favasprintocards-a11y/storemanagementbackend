import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { InventoryItem, StockHistoryLog } from './types.js';
import { CategoryModel } from './models/Category.js';
import { ProductModel } from './models/Product.js';
import { HistoryModel } from './models/History.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data.json');

const DEFAULT_CATEGORIES: string[] = [];

const DEFAULT_PRODUCTS: InventoryItem[] = [];

interface StoreData {
  categories: string[];
  products: InventoryItem[];
  historyLogs: StockHistoryLog[];
}

let store: StoreData = {
  categories: [],
  products: [],
  historyLogs: []
};

// Helper functions for deduplication
function dedupeCategories(cats: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of cats) {
    if (!c || typeof c !== 'string') continue;
    const trimmed = c.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }
  return result;
}

function dedupeProducts(prods: InventoryItem[]): InventoryItem[] {
  const map = new Map<string, InventoryItem>();
  for (const p of prods) {
    if (!p || !p.id) continue;
    const existing = map.get(p.id);
    if (!existing) {
      map.set(p.id, p);
    } else {
      // Keep the one with the latest lastUpdated timestamp
      const existingTime = new Date(existing.lastUpdated || 0).getTime();
      const newTime = new Date(p.lastUpdated || 0).getTime();
      if (newTime >= existingTime) {
        map.set(p.id, p);
      }
    }
  }
  return Array.from(map.values());
}

function dedupeHistoryLogs(logs: StockHistoryLog[]): StockHistoryLog[] {
  const map = new Map<string, StockHistoryLog>();
  for (const l of logs) {
    if (!l || !l.id) continue;
    map.set(l.id, l);
  }
  return Array.from(map.values());
}

// Load stored local data (offline fallback)
export function loadData(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(fileData);
      store = {
        categories: Array.isArray(parsed.categories) ? dedupeCategories(parsed.categories) : [],
        products: Array.isArray(parsed.products) ? dedupeProducts(parsed.products) : [],
        historyLogs: Array.isArray(parsed.historyLogs) ? dedupeHistoryLogs(parsed.historyLogs) : []
      };
    } else {
      saveData();
    }
  } catch (err) {
    console.error('Error loading local data.json:', err);
  }
}

// Save data to local JSON file
export function saveData(): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local data.json:', err);
  }
}

// Synchronize memory store directly from MongoDB Atlas Cloud Database (Non-destructive Bi-directional Sync)
export async function syncWithMongoDB(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;

  try {
    loadData(); // Ensure local file data is loaded first

    // 1. Categories
    const mongoCats = await CategoryModel.find().lean();
    const mongoCatNames = mongoCats.map(c => c.name);
    const mergedCats = dedupeCategories([...mongoCatNames, ...store.categories]);
    store.categories = mergedCats;

    if (mongoCatNames.length < mergedCats.length) {
      await CategoryModel.deleteMany({});
      if (mergedCats.length > 0) {
        await CategoryModel.insertMany(mergedCats.map(name => ({ name })));
      }
    }

    // 2. Products
    const mongoProds = await ProductModel.find().lean();
    const mongoProdItems: InventoryItem[] = mongoProds.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      quantity: p.quantity,
      minThreshold: p.minThreshold,
      unit: p.unit,
      status: p.status as any,
      image: p.image,
      supplier: p.supplier,
      description: p.description,
      lastUpdated: p.lastUpdated
    }));

    const mergedProducts = dedupeProducts([...mongoProdItems, ...store.products]);
    store.products = mergedProducts;

    if (mongoProdItems.length < mergedProducts.length) {
      await ProductModel.deleteMany({});
      if (mergedProducts.length > 0) {
        await ProductModel.insertMany(mergedProducts);
      }
    }

    // 3. History Logs
    const mongoLogs = await HistoryModel.find().sort({ createdAt: -1 }).lean();
    const mongoLogItems: StockHistoryLog[] = mongoLogs.map(l => ({
      id: l.id,
      productId: l.productId,
      productName: l.productName,
      category: l.category,
      type: l.type as any,
      changeQty: l.changeQty,
      previousQty: l.previousQty,
      newQty: l.newQty,
      unit: l.unit,
      timestamp: l.timestamp,
      note: l.note
    }));

    const mergedLogs = dedupeHistoryLogs([...mongoLogItems, ...store.historyLogs]);
    mergedLogs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    store.historyLogs = mergedLogs;

    if (mongoLogItems.length < mergedLogs.length) {
      await HistoryModel.deleteMany({});
      if (mergedLogs.length > 0) {
        await HistoryModel.insertMany(mergedLogs);
      }
    }

    saveData();
  } catch (err) {
    console.error('Error syncing with MongoDB Atlas:', err);
  }
}

// Fetch Categories - Live query from MongoDB Atlas when connected, with store sync
export async function getCategories(): Promise<string[]> {
  loadData();
  if (mongoose.connection.readyState === 1) {
    try {
      const mongoCats = await CategoryModel.find().lean();
      const mongoCatNames = mongoCats.map(c => c.name);
      if (mongoCatNames.length > 0) {
        store.categories = dedupeCategories([...mongoCatNames, ...store.categories]);
        saveData();
      }
      return store.categories;
    } catch (e) {
      console.error('Error fetching categories from MongoDB:', e);
    }
  }
  return store.categories;
}

export async function setCategories(categories: string[]): Promise<string[]> {
  const deduped = dedupeCategories(categories);
  store.categories = deduped;
  saveData();
  if (mongoose.connection.readyState === 1) {
    try {
      await CategoryModel.deleteMany({});
      if (deduped.length > 0) {
        await CategoryModel.insertMany(deduped.map(name => ({ name })));
      }
    } catch (e) {
      console.error('Error updating categories in MongoDB:', e);
    }
  }
  return store.categories;
}

// Fetch Products - Live query from MongoDB Atlas when connected, with store sync
export async function getProducts(): Promise<InventoryItem[]> {
  loadData();
  if (mongoose.connection.readyState === 1) {
    try {
      const mongoProds = await ProductModel.find().lean();
      if (mongoProds.length > 0) {
        const mongoProdItems: InventoryItem[] = mongoProds.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          minThreshold: p.minThreshold,
          unit: p.unit,
          status: p.status as any,
          image: p.image,
          supplier: p.supplier,
          description: p.description,
          lastUpdated: p.lastUpdated
        }));
        store.products = dedupeProducts([...mongoProdItems, ...store.products]);
        saveData();
      }
      return store.products;
    } catch (e) {
      console.error('Error fetching products from MongoDB:', e);
    }
  }
  return store.products;
}

export async function setProducts(products: InventoryItem[]): Promise<InventoryItem[]> {
  const deduped = dedupeProducts(products);
  store.products = deduped;
  saveData();
  if (mongoose.connection.readyState === 1) {
    try {
      await ProductModel.deleteMany({});
      if (deduped.length > 0) {
        await ProductModel.insertMany(deduped);
      }
    } catch (e) {
      console.error('Error updating products in MongoDB:', e);
    }
  }
  return store.products;
}

// Fetch History Logs - Live query from MongoDB Atlas when connected, with store sync
export async function getHistoryLogs(): Promise<StockHistoryLog[]> {
  loadData();
  if (mongoose.connection.readyState === 1) {
    try {
      const mongoLogs = await HistoryModel.find().sort({ createdAt: -1 }).lean();
      if (mongoLogs.length > 0) {
        const mongoLogItems: StockHistoryLog[] = mongoLogs.map(l => ({
          id: l.id,
          productId: l.productId,
          productName: l.productName,
          category: l.category,
          type: l.type as any,
          changeQty: l.changeQty,
          previousQty: l.previousQty,
          newQty: l.newQty,
          unit: l.unit,
          timestamp: l.timestamp,
          note: l.note
        }));
        store.historyLogs = dedupeHistoryLogs([...mongoLogItems, ...store.historyLogs]);
        saveData();
      }
      return store.historyLogs || [];
    } catch (e) {
      console.error('Error fetching history logs from MongoDB:', e);
    }
  }
  return store.historyLogs || [];
}

export async function setHistoryLogs(logs: StockHistoryLog[]): Promise<StockHistoryLog[]> {
  const deduped = dedupeHistoryLogs(logs);
  store.historyLogs = deduped;
  saveData();
  if (mongoose.connection.readyState === 1) {
    try {
      await HistoryModel.deleteMany({});
      if (deduped.length > 0) {
        await HistoryModel.insertMany(deduped);
      }
    } catch (e) {
      console.error('Error updating history logs in MongoDB:', e);
    }
  }
  return store.historyLogs;
}

