import express from 'express';
import { 
  getAllCategories,
  getCategoryWithChildren,
  getChildCategories,
  createCategory, 
  updateCategory, 
  deleteCategory 
} from '../controllers/categoryController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Routes publiques
router.get('/', getAllCategories);
router.get('/:id', getCategoryWithChildren);
router.get('/:parentId/children', getChildCategories);

// Routes admin
router.post('/', authenticateToken, authorizeAdmin, createCategory);
router.put('/:id', authenticateToken, authorizeAdmin, updateCategory);
router.delete('/:id', authenticateToken, authorizeAdmin, deleteCategory);

export default router;
