import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { InventoryItem, StockHistoryLog } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data.json');

export const INITIAL_CATEGORIES: string[] = [];

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

// Load data from JSON file if exists
export function loadData(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
      store = JSON.parse(fileData);
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

export function getCategories(): string[] {
  loadData();
  return store.categories || [];
}

export function setCategories(categories: string[]): string[] {
  store.categories = categories;
  saveData();
  return store.categories;
}

export function getProducts(): InventoryItem[] {
  loadData();
  return store.products || [];
}

export function setProducts(products: InventoryItem[]): InventoryItem[] {
  store.products = products;
  saveData();
  return store.products;
}

export function getHistoryLogs(): StockHistoryLog[] {
  loadData();
  return store.historyLogs || [];
}

export function setHistoryLogs(logs: StockHistoryLog[]): StockHistoryLog[] {
  store.historyLogs = logs;
  saveData();
  return store.historyLogs;
}
