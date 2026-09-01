import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dns from 'dns';
import { CategoryModel } from './models/Category.js';
import { ProductModel } from './models/Product.js';
import { HistoryModel } from './models/History.js';
// Configure DNS fallback for SRV lookup
try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
}
catch (e) { }
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data.json');
const DEFAULT_CATEGORIES = [];
const DEFAULT_PRODUCTS = [];
let store = {
    categories: [],
    products: [],
    historyLogs: []
};
// Helper functions for deduplication
function dedupeCategories(cats) {
    const seen = new Set();
    const result = [];
    for (const c of cats) {
        if (!c || typeof c !== 'string')
            continue;
        const trimmed = c.trim();
        if (!trimmed)
            continue;
        const lower = trimmed.toLowerCase();
        if (!seen.has(lower)) {
            seen.add(lower);
            result.push(trimmed);
        }
    }
    return result;
}
function dedupeProducts(prods) {
    const idMap = new Map();
    const nameMap = new Map();
    for (const p of prods) {
        if (!p || !p.name)
            continue;
        const normName = p.name.trim().toLowerCase();
        const existingById = p.id ? idMap.get(p.id) : undefined;
        const existingByName = nameMap.get(normName);
        const existing = existingById || existingByName;
        if (!existing) {
            if (p.id)
                idMap.set(p.id, p);
            nameMap.set(normName, p);
        }
        else {
            const existingTime = new Date(existing.lastUpdated || 0).getTime();
            const newTime = new Date(p.lastUpdated || 0).getTime();
            if (newTime >= existingTime) {
                if (existing.id)
                    idMap.delete(existing.id);
                if (p.id)
                    idMap.set(p.id, p);
                nameMap.set(normName, p);
            }
        }
    }
    return Array.from(nameMap.values());
}
function dedupeHistoryLogs(logs) {
    const map = new Map();
    for (const l of logs) {
        if (!l || !l.id)
            continue;
        map.set(l.id, l);
    }
    return Array.from(map.values());
}
// Load stored local data (offline fallback)
export function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const fileData = fs.readFileSync(DATA_FILE, 'utf-8');
            const parsed = JSON.parse(fileData);
            const parsedCats = Array.isArray(parsed.categories) ? dedupeCategories(parsed.categories) : [];
            const parsedProds = Array.isArray(parsed.products) ? dedupeProducts(parsed.products) : [];
            const parsedLogs = Array.isArray(parsed.historyLogs) ? dedupeHistoryLogs(parsed.historyLogs) : [];
            store = {
                categories: parsedCats,
                products: parsedProds,
                historyLogs: parsedLogs
            };
        }
        else {
            saveData();
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
        // 1. Categories Sync from MongoDB
        const mongoCats = await CategoryModel.find().lean();
        store.categories = dedupeCategories(mongoCats.map(c => c.name));
        // 2. Products Sync from MongoDB
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
        // 3. History Logs Sync from MongoDB
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
// Fetch Categories - Live query from MongoDB Atlas when connected
export async function getCategories() {
    if (mongoose.connection.readyState === 1) {
        try {
            const mongoCats = await CategoryModel.find().lean();
            store.categories = dedupeCategories(mongoCats.map(c => c.name));
            saveData();
            return store.categories;
        }
        catch (e) {
            console.error('Error fetching categories from MongoDB:', e);
        }
    }
    loadData();
    return store.categories;
}
export async function setCategories(categories) {
    const deduped = dedupeCategories(categories);
    store.categories = deduped;
    saveData();
    if (mongoose.connection.readyState === 1) {
        try {
            await CategoryModel.deleteMany({});
            if (deduped.length > 0) {
                await CategoryModel.insertMany(deduped.map(name => ({ name })));
            }
        }
        catch (e) {
            console.error('Error updating categories in MongoDB:', e);
        }
    }
    return store.categories;
}
export async function renameCategory(oldName, newName) {
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedOld || !trimmedNew)
        return { categories: store.categories, products: store.products };
    const normOld = trimmedOld.toLowerCase();
    store.categories = dedupeCategories(store.categories.map(c => (c.trim().toLowerCase() === normOld ? trimmedNew : c)));
    store.products = store.products.map(p => {
        if (p.category && p.category.trim().toLowerCase() === normOld) {
            return { ...p, category: trimmedNew, lastUpdated: new Date().toISOString() };
        }
        return p;
    });
    if (store.historyLogs) {
        store.historyLogs = store.historyLogs.map(l => {
            if (l.category && l.category.trim().toLowerCase() === normOld) {
                return { ...l, category: trimmedNew };
            }
            return l;
        });
    }
    saveData();
    if (mongoose.connection.readyState === 1) {
        try {
            const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const oldReg = new RegExp(`^${escapeRegex(trimmedOld)}$`, 'i');
            await CategoryModel.updateMany({ name: oldReg }, { $set: { name: trimmedNew } });
            await ProductModel.updateMany({ category: oldReg }, { $set: { category: trimmedNew, lastUpdated: new Date().toISOString() } });
            await HistoryModel.updateMany({ category: oldReg }, { $set: { category: trimmedNew } });
        }
        catch (e) {
            console.error('Error updating renamed category in MongoDB:', e);
        }
    }
    return { categories: store.categories, products: store.products };
}
export async function deleteCategory(targetName) {
    const trimmed = targetName.trim().toLowerCase();
    store.categories = store.categories.filter(c => c.trim().toLowerCase() !== trimmed);
    store.products = store.products.filter(p => !p.category || p.category.trim().toLowerCase() !== trimmed);
    saveData();
    if (mongoose.connection.readyState === 1) {
        try {
            const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const targetReg = new RegExp(`^${escapeRegex(targetName.trim())}$`, 'i');
            await CategoryModel.deleteMany({ name: targetReg });
            await ProductModel.deleteMany({ category: targetReg });
        }
        catch (e) {
            console.error('Error deleting category from MongoDB:', e);
        }
    }
    return { categories: store.categories, products: store.products };
}
// Fetch Products - Live query from MongoDB Atlas when connected
export async function getProducts() {
    if (mongoose.connection.readyState === 1) {
        try {
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
            saveData();
            return store.products;
        }
        catch (e) {
            console.error('Error fetching products from MongoDB:', e);
        }
    }
    loadData();
    return store.products;
}
export async function setProducts(products) {
    const deduped = dedupeProducts(products);
    store.products = deduped;
    saveData();
    if (mongoose.connection.readyState === 1) {
        try {
            await ProductModel.deleteMany({});
            if (deduped.length > 0) {
                await ProductModel.insertMany(deduped);
            }
        }
        catch (e) {
            console.error('Error updating products in MongoDB:', e);
        }
    }
    return store.products;
}
// Fetch History Logs - Live query from MongoDB Atlas when connected
export async function getHistoryLogs() {
    if (mongoose.connection.readyState === 1) {
        try {
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
            return store.historyLogs || [];
        }
        catch (e) {
            console.error('Error fetching history logs from MongoDB:', e);
        }
    }
    loadData();
    return store.historyLogs || [];
}
export async function setHistoryLogs(logs) {
    const deduped = dedupeHistoryLogs(logs);
    store.historyLogs = deduped;
    saveData();
    if (mongoose.connection.readyState === 1) {
        try {
            await HistoryModel.deleteMany({});
            if (deduped.length > 0) {
                await HistoryModel.insertMany(deduped);
            }
        }
        catch (e) {
            console.error('Error updating history logs in MongoDB:', e);
        }
    }
    return store.historyLogs;
}
