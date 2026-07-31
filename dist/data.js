import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data.json');
export const INITIAL_CATEGORIES = [
    'PVC Blank Cards',
    'Paper & Media',
    'Apparel',
    'Custom Merch',
    'Packaging',
    'Office & Supplies',
    'Ink & Toners'
];
let store = {
    categories: INITIAL_CATEGORIES,
    products: [],
    historyLogs: []
};
// Load data from JSON file if exists
export function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
            store = JSON.parse(fileData);
        }
        else {
            saveData();
        }
    }
    catch (err) {
        console.error('Error loading backend data:', err);
    }
}
// Save data to JSON file
export function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('Error saving backend data:', err);
    }
}
export function getCategories() {
    loadData();
    return store.categories && store.categories.length > 0 ? store.categories : INITIAL_CATEGORIES;
}
export function setCategories(categories) {
    store.categories = categories;
    saveData();
    return store.categories;
}
export function getProducts() {
    loadData();
    return store.products || [];
}
export function setProducts(products) {
    store.products = products;
    saveData();
    return store.products;
}
export function getHistoryLogs() {
    loadData();
    return store.historyLogs || [];
}
export function setHistoryLogs(logs) {
    store.historyLogs = logs;
    saveData();
    return store.historyLogs;
}
