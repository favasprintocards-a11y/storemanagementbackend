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

export const DEFAULT_CATEGORIES: string[] = [
  'Paper & Media',
  'Apparel & Fabrics',
  'Vinyl & Banner Media',
  'Inks & Toners',
  'Packaging & Boxes',
  'Merch & Promo Supplies'
];

export const DEFAULT_PRODUCTS: InventoryItem[] = [
  {
    id: 'PRD-101',
    name: 'Glossy Photo Paper 250gsm (A4, Pack of 100)',
    category: 'Paper & Media',
    quantity: 45,
    minThreshold: 10,
    unit: 'packs',
    status: 'In Stock',
    image: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=300&auto=format&fit=crop&q=80',
    supplier: 'PaperCraft Ltd',
    description: 'High-grade 250gsm glossy finish inkjet photo printing paper.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-102',
    name: 'Heavy Cotton Round Neck T-Shirt (White - L)',
    category: 'Apparel & Fabrics',
    quantity: 8,
    minThreshold: 15,
    unit: 'pcs',
    status: 'Low Stock',
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=80',
    supplier: 'TexPrint Garments',
    description: '100% combed cotton blank t-shirts for screen printing & DTF.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-103',
    name: 'Matte Self-Adhesive Vinyl Roll (50m x 1.2m)',
    category: 'Vinyl & Banner Media',
    quantity: 12,
    minThreshold: 5,
    unit: 'rolls',
    status: 'In Stock',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
    supplier: 'SignMedia Co',
    description: 'Premium outdoor matte adhesive vinyl roll for wide format signage.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-104',
    name: 'Cyan Sublimation Ink Bottle 1000ml',
    category: 'Inks & Toners',
    quantity: 0,
    minThreshold: 3,
    unit: 'bottles',
    status: 'Out of Stock',
    image: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=300&auto=format&fit=crop&q=80',
    supplier: 'ChromaTech Inks',
    description: 'Vibrant cyan heat transfer sublimation ink for Epson printheads.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-105',
    name: 'Corrugated Shipping Box (10x8x6 inch, Bundle of 25)',
    category: 'Packaging & Boxes',
    quantity: 30,
    minThreshold: 8,
    unit: 'bundles',
    status: 'In Stock',
    image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=300&auto=format&fit=crop&q=80',
    supplier: 'PackRight Solutions',
    description: '3-ply heavy duty corrugated cardboard shipping boxes for e-commerce.',
    lastUpdated: new Date().toISOString()
  },
  {
    id: 'PRD-106',
    name: 'Ceramic Sublimation White Mug 11oz (Box of 36)',
    category: 'Merch & Promo Supplies',
    quantity: 5,
    minThreshold: 5,
    unit: 'boxes',
    status: 'Low Stock',
    image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=300&auto=format&fit=crop&q=80',
    supplier: 'PromoWare Global',
    description: 'JS-coated AAA grade sublimation white blank ceramic coffee mugs.',
    lastUpdated: new Date().toISOString()
  }
];

export const DEFAULT_HISTORY: StockHistoryLog[] = [
  {
    id: 'LOG-1001',
    productId: 'PRD-101',
    productName: 'Glossy Photo Paper 250gsm (A4, Pack of 100)',
    category: 'Paper & Media',
    type: 'create',
    changeQty: 45,
    previousQty: 0,
    newQty: 45,
    unit: 'packs',
    timestamp: new Date().toISOString(),
    note: 'Initial inventory stock load'
  },
  {
    id: 'LOG-1002',
    productId: 'PRD-102',
    productName: 'Heavy Cotton Round Neck T-Shirt (White - L)',
    category: 'Apparel & Fabrics',
    type: 'minus',
    changeQty: -12,
    previousQty: 20,
    newQty: 8,
    unit: 'pcs',
    timestamp: new Date().toISOString(),
    note: 'Fulfilling Bulk Print Order #PR-8820'
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
  historyLogs: [...DEFAULT_HISTORY]
};

// Load data from JSON file or seed if empty
export function loadData(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(fileData);
      
      const loadedCats = Array.isArray(parsed.categories) && parsed.categories.length > 0
        ? parsed.categories
        : DEFAULT_CATEGORIES;

      const loadedProds = Array.isArray(parsed.products) && parsed.products.length > 0
        ? parsed.products
        : DEFAULT_PRODUCTS;

      const loadedLogs = Array.isArray(parsed.historyLogs) && parsed.historyLogs.length > 0
        ? parsed.historyLogs
        : DEFAULT_HISTORY;

      store = {
        categories: loadedCats,
        products: loadedProds,
        historyLogs: loadedLogs
      };

      // Save if initialized with default seed data
      if (!parsed.categories?.length || !parsed.products?.length) {
        saveData();
      }
    } else {
      saveData();
    }
  } catch (err) {
    console.error('Error loading backend data:', err);
  }
}

// Save data to JSON file
export function saveData(): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving backend data:', err);
  }
}

// Synchronize memory store with MongoDB Atlas if connected
export async function syncWithMongoDB(): Promise<void> {
  if (mongoose.connection.readyState !== 1) return;

  try {
    // 1. Sync Categories
    const mongoCats = await CategoryModel.find().lean();
    if (mongoCats.length === 0) {
      // Seed Mongo categories
      await CategoryModel.insertMany(store.categories.map(name => ({ name })));
    } else {
      store.categories = mongoCats.map(c => c.name);
    }

    // 2. Sync Products
    const mongoProds = await ProductModel.find().lean();
    if (mongoProds.length === 0) {
      // Seed Mongo products
      await ProductModel.insertMany(store.products);
    } else {
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
    }

    // 3. Sync History
    const mongoLogs = await HistoryModel.find().sort({ createdAt: -1 }).lean();
    if (mongoLogs.length === 0) {
      // Seed Mongo history logs
      await HistoryModel.insertMany(store.historyLogs);
    } else {
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
    }

    saveData();
  } catch (err) {
    console.error('Error syncing with MongoDB Atlas:', err);
  }
}

// Background helper to push updates to Mongo
async function pushCategoryToMongo(name: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    try {
      await CategoryModel.updateOne({ name }, { name }, { upsert: true });
    } catch (e) {
      console.error('Failed to push category to MongoDB:', e);
    }
  }
}

async function removeCategoryFromMongo(name: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    try {
      await CategoryModel.deleteOne({ name });
    } catch (e) {
      console.error('Failed to remove category from MongoDB:', e);
    }
  }
}

async function pushProductToMongo(prod: InventoryItem): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    try {
      await ProductModel.updateOne({ id: prod.id }, prod, { upsert: true });
    } catch (e) {
      console.error('Failed to push product to MongoDB:', e);
    }
  }
}

async function removeProductFromMongo(id: string): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    try {
      await ProductModel.deleteOne({ id });
    } catch (e) {
      console.error('Failed to remove product from MongoDB:', e);
    }
  }
}

async function pushLogToMongo(log: StockHistoryLog): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    try {
      await HistoryModel.updateOne({ id: log.id }, log, { upsert: true });
    } catch (e) {
      console.error('Failed to push log to MongoDB:', e);
    }
  }
}

export function getCategories(): string[] {
  loadData();
  return store.categories || [];
}

export function setCategories(categories: string[]): string[] {
  store.categories = categories;
  saveData();
  if (mongoose.connection.readyState === 1) {
    CategoryModel.deleteMany({}).then(() => {
      CategoryModel.insertMany(categories.map(name => ({ name }))).catch(console.error);
    }).catch(console.error);
  }
  return store.categories;
}

export function getProducts(): InventoryItem[] {
  loadData();
  return store.products || [];
}

export function setProducts(products: InventoryItem[]): InventoryItem[] {
  store.products = products;
  saveData();
  if (mongoose.connection.readyState === 1) {
    ProductModel.deleteMany({}).then(() => {
      ProductModel.insertMany(products).catch(console.error);
    }).catch(console.error);
  }
  return store.products;
}

export function getHistoryLogs(): StockHistoryLog[] {
  loadData();
  return store.historyLogs || [];
}

export function setHistoryLogs(logs: StockHistoryLog[]): StockHistoryLog[] {
  store.historyLogs = logs;
  saveData();
  if (mongoose.connection.readyState === 1) {
    HistoryModel.deleteMany({}).then(() => {
      HistoryModel.insertMany(logs).catch(console.error);
    }).catch(console.error);
  }
  return store.historyLogs;
}
