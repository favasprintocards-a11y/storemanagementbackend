import { Router } from 'express';
import { getProducts, setProducts, getHistoryLogs, setHistoryLogs } from '../data.js';
const router = Router();
function calculateStatus(qty, threshold) {
    if (qty <= 0)
        return 'Out of Stock';
    if (qty <= threshold)
        return 'Low Stock';
    return 'In Stock';
}
// GET all products
router.get('/', (_req, res) => {
    res.json(getProducts());
});
// POST create product
router.post('/', (req, res) => {
    const { name, category, quantity, minThreshold, unit, image, supplier, description } = req.body;
    if (!name || !category) {
        res.status(400).json({ error: 'Name and category are required' });
        return;
    }
    const products = getProducts();
    const qty = Number(quantity) || 0;
    const threshold = Number(minThreshold) || 5;
    const newItem = {
        id: `PRD-${Date.now()}`,
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
    setProducts(products);
    // Add history log
    const logs = getHistoryLogs();
    const newLog = {
        id: `LOG-${Date.now()}`,
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
    setHistoryLogs(logs);
    res.status(201).json(newItem);
});
// PUT update product
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const products = getProducts();
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
        const newItem = {
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
        setProducts(products);
        res.status(200).json(newItem);
        return;
    }
    const existing = products[index];
    const { name, category, quantity, minThreshold, unit, image, supplier, description } = req.body;
    const newQty = quantity !== undefined ? Number(quantity) : existing.quantity;
    const newThreshold = minThreshold !== undefined ? Number(minThreshold) : existing.minThreshold;
    const updatedItem = {
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
    setProducts(products);
    res.json(updatedItem);
});
// DELETE product
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const products = getProducts();
    const item = products.find(p => p.id === id);
    if (!item) {
        res.status(404).json({ error: 'Product not found' });
        return;
    }
    const updatedProducts = products.filter(p => p.id !== id);
    setProducts(updatedProducts);
    // Add history log
    const logs = getHistoryLogs();
    const deleteLog = {
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
    setHistoryLogs(logs);
    res.json({ message: 'Product deleted successfully', id });
});
export default router;
