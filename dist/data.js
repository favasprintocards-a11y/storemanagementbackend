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
const DEFAULT_CATEGORIES = [
    'Paper & Media',
    'Apparel',
    'Vinyl & Signage',
    'Ink & Toners',
    'Merchandise',
    'Packaging'
];
const DEFAULT_PRODUCTS = [
    {
        id: 'PRD-001',
        name: '300 GSM Glossy Card Stock (A4)',
        category: 'Paper & Media',
        quantity: 450,
        minThreshold: 100,
        unit: 'sheets',
        status: 'In Stock',
        image: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=300&auto=format&fit=crop&q=80',
        supplier: 'PaperCo Ltd',
        description: 'Premium heavyweight glossy paper for business card printing.',
        lastUpdated: new Date().toISOString()
    },
    {
        id: 'PRD-002',
        name: 'Cotton Heavyweight T-Shirt (Black, L)',
        category: 'Apparel',
        quantity: 18,
        minThreshold: 25,
        unit: 'pcs',
        status: 'Low Stock',
        image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=80',
        supplier: 'Textile Hub',
        description: '100% combed cotton blank t-shirts for screen printing.',
        lastUpdated: new Date().toISOString()
    },
    {
        id: 'PRD-003',
        name: 'Matte Vinyl Roll (50m x 1.2m)',
        category: 'Vinyl & Signage',
        quantity: 12,
        minThreshold: 5,
        unit: 'rolls',
        status: 'In Stock',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=80',
        supplier: 'SignCraft Supplies',
        description: 'High durability outdoor adhesive vinyl roll.',
        lastUpdated: new Date().toISOString()
    }
];
let store = {
    categories: DEFAULT_CATEGORIES,
    products: DEFAULT_PRODUCTS,
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
                categories: parsedCats.length > 0 ? parsedCats : DEFAULT_CATEGORIES,
                products: parsedProds.length > 0 ? parsedProds : DEFAULT_PRODUCTS,
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
// Synchronize memory store directly from MongoDB Atlas Cloud Database (Non-destructive Bi-directional Sync)
export async function syncWithMongoDB() {
    if (mongoose.connection.readyState !== 1)
        return;
    try {
        loadData(); // Ensure local file data is loaded first
        // 1. Categories Sync
        const mongoCats = await CategoryModel.find().lean();
        const mongoCatNames = mongoCats.map(c => c.name);
        if (mongoCatNames.length === 0 && store.categories.length > 0) {
            await CategoryModel.insertMany(store.categories.map(name => ({ name })));
        }
        else {
            const mergedCats = dedupeCategories([...mongoCatNames, ...store.categories]);
            store.categories = mergedCats;
            if (mongoCatNames.length < mergedCats.length) {
                await CategoryModel.deleteMany({});
                await CategoryModel.insertMany(mergedCats.map(name => ({ name })));
            }
        }
        // 2. Products Sync
        const mongoProds = await ProductModel.find().lean();
        const mongoProdItems = mongoProds.map(p => ({
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
        if (mongoProdItems.length === 0 && store.products.length > 0) {
            await ProductModel.insertMany(store.products);
        }
        else {
            const mergedProducts = dedupeProducts([...mongoProdItems, ...store.products]);
            store.products = mergedProducts;
            if (mongoProdItems.length < mergedProducts.length) {
                await ProductModel.deleteMany({});
                await ProductModel.insertMany(mergedProducts);
            }
        }
        // 3. History Logs Sync
        const mongoLogs = await HistoryModel.find().sort({ createdAt: -1 }).lean();
        const mongoLogItems = mongoLogs.map(l => ({
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
        if (mongoLogItems.length === 0 && store.historyLogs.length > 0) {
            await HistoryModel.insertMany(store.historyLogs);
        }
        else {
            const mergedLogs = dedupeHistoryLogs([...mongoLogItems, ...store.historyLogs]);
            mergedLogs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
            store.historyLogs = mergedLogs;
            if (mongoLogItems.length < mergedLogs.length) {
                await HistoryModel.deleteMany({});
                await HistoryModel.insertMany(mergedLogs);
            }
        }
        saveData();
    }
    catch (err) {
        console.error('Error syncing with MongoDB Atlas:', err);
    }
}
// Fetch Categories - Live query from MongoDB Atlas when connected, with store sync
export async function getCategories() {
    loadData();
    if (mongoose.connection.readyState === 1) {
        try {
            const mongoCats = await CategoryModel.find().lean();
            const mongoCatNames = mongoCats.map(c => c.name);
            if (mongoCatNames.length > 0) {
                store.categories = dedupeCategories([...mongoCatNames, ...store.categories]);
                saveData();
            }
            else if (store.categories.length > 0) {
                await CategoryModel.insertMany(store.categories.map(name => ({ name })));
            }
            return store.categories;
        }
        catch (e) {
            console.error('Error fetching categories from MongoDB:', e);
        }
    }
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
// Fetch Products - Live query from MongoDB Atlas when connected, with store sync
export async function getProducts() {
    loadData();
    if (mongoose.connection.readyState === 1) {
        try {
            const mongoProds = await ProductModel.find().lean();
            if (mongoProds.length > 0) {
                const mongoProdItems = mongoProds.map(p => ({
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
                store.products = dedupeProducts([...mongoProdItems, ...store.products]);
                saveData();
            }
            else if (store.products.length > 0) {
                await ProductModel.insertMany(store.products);
            }
            return store.products;
        }
        catch (e) {
            console.error('Error fetching products from MongoDB:', e);
        }
    }
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
// Fetch History Logs - Live query from MongoDB Atlas when connected, with store sync
export async function getHistoryLogs() {
    loadData();
    if (mongoose.connection.readyState === 1) {
        try {
            const mongoLogs = await HistoryModel.find().sort({ createdAt: -1 }).lean();
            if (mongoLogs.length > 0) {
                const mongoLogItems = mongoLogs.map(l => ({
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
                store.historyLogs = dedupeHistoryLogs([...mongoLogItems, ...store.historyLogs]);
                saveData();
            }
            else if (store.historyLogs.length > 0) {
                await HistoryModel.insertMany(store.historyLogs);
            }
            return store.historyLogs || [];
        }
        catch (e) {
            console.error('Error fetching history logs from MongoDB:', e);
        }
    }
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
