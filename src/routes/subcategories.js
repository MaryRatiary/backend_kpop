import express from 'express';
import { 
  getSubcategoriesByCategory, 
  createSubcategory, 
  updateSubcategory, 
  deleteSubcategory 
} from '../controllers/subcategoryController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Routes publiques
router.get('/category/:categoryId', getSubcategoriesByCategory);

// Routes admin
router.post('/', authenticateToken, authorizeAdmin, createSubcategory);
router.put('/:id', authenticateToken, authorizeAdmin, updateSubcategory);
router.delete('/:id', authenticateToken, authorizeAdmin, deleteSubcategory);

export default router;
