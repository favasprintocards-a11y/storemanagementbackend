import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { CategoryModel } from './models/Category.js';
import { ProductModel } from './models/Product.js';
import { HistoryModel } from './models/History.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data.json');
let store = {
    categories: [],
    products: [],
    historyLogs: []
};
// Load stored local data (offline fallback)
export function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
            const parsed = JSON.parse(fileData);
            store = {
                categories: Array.isArray(parsed.categories) ? parsed.categories : [],
                products: Array.isArray(parsed.products) ? parsed.products : [],
                historyLogs: Array.isArray(parsed.historyLogs) ? parsed.historyLogs : []
            };
        }
    }
    catch (err) {
        console.error('Error loading local data.json:', err);
    }
}
// Save data to local JSON file
export function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
    }
    catch (err) {
        console.error('Error saving local data.json:', err);
    }
}
// Synchronize memory store directly from MongoDB Atlas Cloud Database
export async function syncWithMongoDB() {
    if (mongoose.connection.readyState !== 1)
        return;
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
            status: p.status,
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
            type: l.type,
            changeQty: l.changeQty,
            previousQty: l.previousQty,
            newQty: l.newQty,
            unit: l.unit,
            timestamp: l.timestamp,
            note: l.note
        }));
        saveData();
    }
    catch (err) {
        console.error('Error syncing with MongoDB Atlas:', err);
    }
}
// Fetch Categories - Direct live query from MongoDB Atlas when connected
export async function getCategories() {
    if (mongoose.connection.readyState === 1) {
        try {
            const mongoCats = await CategoryModel.find().lean();
            const cats = mongoCats.map(c => c.name);
            store.categories = cats;
            return cats;
        }
        catch (e) {
            console.error('Error fetching categories from MongoDB:', e);
        }
    }
    loadData();
    return store.categories || [];
}
export async function setCategories(categories) {
    store.categories = categories;
    saveData();
    if (mongoose.connection.readyState === 1) {
        try {
            await CategoryModel.deleteMany({});
            if (categories.length > 0) {
                await CategoryModel.insertMany(categories.map(name => ({ name })));
            }
        }
        catch (e) {
            console.error('Error updating categories in MongoDB:', e);
        }
    }
    return store.categories;
}
// Fetch Products - Direct live query from MongoDB Atlas when connected
export async function getProducts() {
    if (mongoose.connection.readyState === 1) {
        try {
            const mongoProds = await ProductModel.find().lean();
            const prods = mongoProds.map(p => ({
                id: p.id,
                name: p.name,
                category: p.category,
                quantity: p.quantity,
                minThreshold: p.minThreshold,
                unit: p.unit,
                status: p.status,
                image: p.image,
                supplier: p.supplier,
                description: p.description,
                lastUpdated: p.lastUpdated
            }));
            store.products = prods;
            return prods;
        }
        catch (e) {
            console.error('Error fetching products from MongoDB:', e);
        }
    }
    loadData();
    return store.products || [];
}
export async function setProducts(products) {
    store.products = products;
    saveData();
    if (mongoose.connection.readyState === 1) {
        try {
            await ProductModel.deleteMany({});
            if (products.length > 0) {
                await ProductModel.insertMany(products);
            }
        }
        catch (e) {
            console.error('Error updating products in MongoDB:', e);
        }
    }
    return store.products;
}
// Fetch History Logs - Direct live query from MongoDB Atlas when connected
export async function getHistoryLogs() {
    if (mongoose.connection.readyState === 1) {
        try {
            const mongoLogs = await HistoryModel.find().sort({ createdAt: -1 }).lean();
            const logs = mongoLogs.map(l => ({
                id: l.id,
                productId: l.productId,
                productName: l.productName,
                category: l.category,
                type: l.type,
                changeQty: l.changeQty,
                previousQty: l.previousQty,
                newQty: l.newQty,
                unit: l.unit,
                timestamp: l.timestamp,
                note: l.note
            }));
            store.historyLogs = logs;
            return logs;
        }
        catch (e) {
            console.error('Error fetching history logs from MongoDB:', e);
        }
    }
    loadData();
    return store.historyLogs || [];
}
export async function setHistoryLogs(logs) {
    store.historyLogs = logs;
    saveData();
    if (mongoose.connection.readyState === 1) {
        try {
            await HistoryModel.deleteMany({});
            if (logs.length > 0) {
                await HistoryModel.insertMany(logs);
            }
        }
        catch (e) {
            console.error('Error updating history logs in MongoDB:', e);
        }
    }
    return store.historyLogs;
}
