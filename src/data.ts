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

const DEFAULT_CATEGORIES: string[] = [
  'Paper & Media',
  'Substrates & Boards',
  'Inks & Toners',
  'Display & Signage',
  'Apparel & Merch',
  'Finishing & Accessories'
];

const DEFAULT_PRODUCTS: InventoryItem[] = [
  {
    id: 'PRD-101',
    name: 'A4 Glossy Photo Paper (250gsm)',
    category: 'Paper & Media',
    quantity: 150,
    minThreshold: 20,
    unit: 'packs',
    status: 'In Stock',
    image: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=300&auto=format&fit=crop&q=80',
    supplier: 'Printo Paper Supplies',
    description: 'Premium glossy photo paper for high-definition color printing.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-102',
    name: 'Matte Vinyl Sticker Roll (50m)',
    category: 'Paper & Media',
    quantity: 8,
    minThreshold: 10,
    unit: 'rolls',
    status: 'Low Stock',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
    supplier: 'VinylTech Ltd',
    description: 'Waterproof matte vinyl roll for decal and sticker production.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-103',
    name: '3mm PVC Foam Board (4x8 ft)',
    category: 'Substrates & Boards',
    quantity: 45,
    minThreshold: 15,
    unit: 'sheets',
    status: 'In Stock',
    supplier: 'BoardMaster Inc',
    description: 'Rigid lightweight PVC board for outdoor signage and display boards.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-104',
    name: 'Eco-Solvent Black Ink Bottle (1L)',
    category: 'Inks & Toners',
    quantity: 0,
    minThreshold: 5,
    unit: 'bottles',
    status: 'Out of Stock',
    image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop&q=80',
    supplier: 'InkJet Global',
    description: 'High-durability eco-solvent black ink for large format printers.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-105',
    name: 'Roll-Up Banner Stand (85x200cm)',
    category: 'Display & Signage',
    quantity: 25,
    minThreshold: 5,
    unit: 'pcs',
    status: 'In Stock',
    supplier: 'Display Express',
    description: 'Heavy-duty aluminum retractable stand with carrying bag.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-106',
    name: 'White Cotton Crewneck T-Shirt (L)',
    category: 'Apparel & Merch',
    quantity: 60,
    minThreshold: 20,
    unit: 'pcs',
    status: 'In Stock',
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=80',
    supplier: 'TexStyle Clothing',
    description: '100% combed cotton blank t-shirts for DTF and screen printing.',
    lastUpdated: new Date().toISOString()
  }
];

interface StoreData {
  categories: string[];
  products: InventoryItem[];
  historyLogs: StockHistoryLog[];
}

let store: StoreData = {
  categories: [...DEFAULT_CATEGORIES],
  products: [...DEFAULT_PRODUCTS],
  historyLogs: []
};

// Load stored local data (offline fallback)
export function loadData(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(fileData);
      store = {
        categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : [...DEFAULT_CATEGORIES],
        products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : [...DEFAULT_PRODUCTS],
        historyLogs: Array.isArray(parsed.historyLogs) ? parsed.historyLogs : []
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

// Synchronize memory store directly from MongoDB Atlas Cloud Database
export async function syncWithMongoDB(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;

  try {
    // 1. Categories
    const mongoCats = await CategoryModel.find().lean();
    store.categories = mongoCats.map(c => c.name);

    // 2. Products
    const mongoProds = await ProductModel.find().lean();
    store.products = mongoProds.map(p => ({
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

    // 3. History
    const mongoLogs = await HistoryModel.find().sort({ createdAt: -1 }).lean();
    store.historyLogs = mongoLogs.map(l => ({
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

    saveData();
  } catch (err) {
    console.error('Error syncing with MongoDB Atlas:', err);
  }
}

// Fetch Categories - Direct live query from MongoDB Atlas when connected
export async function getCategories(): Promise<string[]> {
  if (mongoose.connection.readyState === 1) {
    try {
      const mongoCats = await CategoryModel.find().lean();
      const cats = mongoCats.map(c => c.name);
      store.categories = cats;
      return cats;
    } catch (e) {
      console.error('Error fetching categories from MongoDB:', e);
    }
  }
  loadData();
  return store.categories || [];
}

export async function setCategories(categories: string[]): Promise<string[]> {
  store.categories = categories;
  saveData();
  if (mongoose.connection.readyState === 1) {
    try {
      await CategoryModel.deleteMany({});
      if (categories.length > 0) {
        await CategoryModel.insertMany(categories.map(name => ({ name })));
      }
    } catch (e) {
      console.error('Error updating categories in MongoDB:', e);
    }
  }
  return store.categories;
}

// Fetch Products - Direct live query from MongoDB Atlas when connected
export async function getProducts(): Promise<InventoryItem[]> {
  if (mongoose.connection.readyState === 1) {
    try {
      const mongoProds = await ProductModel.find().lean();
      const prods: InventoryItem[] = mongoProds.map(p => ({
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
      store.products = prods;
      return prods;
    } catch (e) {
      console.error('Error fetching products from MongoDB:', e);
    }
  }
  loadData();
  return store.products || [];
}

export async function setProducts(products: InventoryItem[]): Promise<InventoryItem[]> {
  store.products = products;
  saveData();
  if (mongoose.connection.readyState === 1) {
    try {
      await ProductModel.deleteMany({});
      if (products.length > 0) {
        await ProductModel.insertMany(products);
      }
    } catch (e) {
      console.error('Error updating products in MongoDB:', e);
    }
  }
  return store.products;
}

// Fetch History Logs - Direct live query from MongoDB Atlas when connected
export async function getHistoryLogs(): Promise<StockHistoryLog[]> {
  if (mongoose.connection.readyState === 1) {
    try {
      const mongoLogs = await HistoryModel.find().sort({ createdAt: -1 }).lean();
      const logs: StockHistoryLog[] = mongoLogs.map(l => ({
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
      store.historyLogs = logs;
      return logs;
    } catch (e) {
      console.error('Error fetching history logs from MongoDB:', e);
    }
  }
  loadData();
  return store.historyLogs || [];
}

export async function setHistoryLogs(logs: StockHistoryLog[]): Promise<StockHistoryLog[]> {
  store.historyLogs = logs;
  saveData();
  if (mongoose.connection.readyState === 1) {
    try {
      await HistoryModel.deleteMany({});
      if (logs.length > 0) {
        await HistoryModel.insertMany(logs);
      }
    } catch (e) {
      console.error('Error updating history logs in MongoDB:', e);
    }
  }
  return store.historyLogs;
}
