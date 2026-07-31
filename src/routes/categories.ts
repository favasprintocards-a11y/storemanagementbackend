import { Router, Request, Response } from 'express';
import { getCategories, setCategories } from '../data.js';

const router = Router();

// GET all categories
router.get('/', (_req: Request, res: Response) => {
  res.json(getCategories());
});

// POST add a new category
router.post('/', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Valid category name is required' });
    return;
  }

  const categories = getCategories();
  const trimmed = name.trim();

  if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
    res.status(400).json({ error: 'Category already exists' });
    return;
  }

  categories.push(trimmed);
  setCategories(categories);
  res.status(201).json(categories);
});

// DELETE a category
router.delete('/:name', (req: Request, res: Response) => {
  const targetName = decodeURIComponent(req.params.name).trim().toLowerCase();
  const categories = getCategories();
  const filtered = categories.filter(c => c.trim().toLowerCase() !== targetName);

  if (filtered.length === categories.length) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  setCategories(filtered);
  res.json(filtered);
});

export default router;
