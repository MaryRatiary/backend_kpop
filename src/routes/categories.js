import express from 'express';
import { 
  getAllCategories,
  getCategoryWithChildren,
  getChildCategories,
  getSubcategoriesByCategory,
  createCategory, 
  updateCategory, 
  deleteCategory,
  reorderCategory
} from '../controllers/categoryController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Routes publiques - ORDRE IMPORTANT!
router.get('/', getAllCategories);
// 🔴 Routes spécifiques AVANT les génériques
router.get('/:parentId/children', getChildCategories);
router.get('/:categoryId/subcategories', getSubcategoriesByCategory);
router.get('/:id', getCategoryWithChildren);

// Routes admin
router.post('/', authenticateToken, authorizeAdmin, createCategory);
router.put('/:id', authenticateToken, authorizeAdmin, updateCategory);
router.put('/:id/reorder', authenticateToken, authorizeAdmin, reorderCategory);
router.delete('/:id', authenticateToken, authorizeAdmin, deleteCategory);

export default router;
