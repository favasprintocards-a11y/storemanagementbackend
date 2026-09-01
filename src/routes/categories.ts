import { Router, Request, Response } from 'express';
import { getCategories, setCategories, renameCategory, deleteCategory } from '../data.js';

const router = Router();

// GET all categories
router.get('/', async (_req: Request, res: Response) => {
  const categories = await getCategories();
  res.json(categories);
});

// POST add a new category
router.post('/', async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Valid category name is required' });
    return;
  }

  const categories = await getCategories();
  const trimmed = name.trim();

  if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
    res.status(400).json({ error: 'Category already exists' });
    return;
  }

  categories.push(trimmed);
  await setCategories(categories);
  res.status(201).json(categories);
});

// PUT rename a category
router.put('/rename', async (req: Request, res: Response) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName || typeof oldName !== 'string' || typeof newName !== 'string') {
    res.status(400).json({ error: 'Both oldName and newName are required' });
    return;
  }

  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();

  if (!trimmedOld || !trimmedNew) {
    res.status(400).json({ error: 'Category names cannot be empty' });
    return;
  }

  const categories = await getCategories();
  if (
    trimmedOld.toLowerCase() !== trimmedNew.toLowerCase() &&
    categories.some(c => c.toLowerCase() === trimmedNew.toLowerCase())
  ) {
    res.status(400).json({ error: 'A category with this name already exists' });
    return;
  }

  const result = await renameCategory(trimmedOld, trimmedNew);
  res.json(result);
});

// PUT rename category by param
router.put('/:name', async (req: Request, res: Response) => {
  const oldName = decodeURIComponent(req.params.name);
  const { newName } = req.body;

  if (!oldName || !newName || typeof newName !== 'string') {
    res.status(400).json({ error: 'Valid newName is required' });
    return;
  }

  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();

  if (!trimmedOld || !trimmedNew) {
    res.status(400).json({ error: 'Category names cannot be empty' });
    return;
  }

  const categories = await getCategories();
  if (
    trimmedOld.toLowerCase() !== trimmedNew.toLowerCase() &&
    categories.some(c => c.toLowerCase() === trimmedNew.toLowerCase())
  ) {
    res.status(400).json({ error: 'A category with this name already exists' });
    return;
  }

  const result = await renameCategory(trimmedOld, trimmedNew);
  res.json(result);
});

// DELETE a category
router.delete('/:name', async (req: Request, res: Response) => {
  const targetName = decodeURIComponent(req.params.name).trim();
  if (!targetName) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }

  const result = await deleteCategory(targetName);
  res.json(result.categories);
});

export default router;
