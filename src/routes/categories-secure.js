import express from 'express';
import { 
  getAllCategories,
  getAllCategoriesFlat,
  getCategoryWithChildren,
  getChildCategories,
  getSubcategoriesByCategory,
  getCategoryBySlug,
  createCategory, 
  updateCategory, 
  reorderCategory
} from '../controllers/categoryController.js';
import { preDeleteCategoryCheck, deleteCategory } from '../controllers/categoryController-secure-delete.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Routes publiques - ORDRE IMPORTANT!
router.get('/flat/all', getAllCategoriesFlat);  // Endpoint pour les catégories plates
router.get('/', getAllCategories);
// Routes spécifiques AVANT les génériques
router.get('/:parentId/children', getChildCategories);
router.get('/:categoryId/subcategories', getSubcategoriesByCategory);
router.get('/slug/:slug', getCategoryBySlug);
router.get('/:id', getCategoryWithChildren);

// Routes admin
router.post('/', authenticateToken, authorizeAdmin, createCategory);
router.put('/:id', authenticateToken, authorizeAdmin, updateCategory);
router.put('/:id/reorder', authenticateToken, authorizeAdmin, reorderCategory);

// ✅ ROUTES DE SUPPRESSION SÉCURISÉE
// 1️⃣ Pré-vérification: Récupère les données qui seront supprimées
router.get('/:id/delete-check', authenticateToken, authorizeAdmin, preDeleteCategoryCheck);

// 2️⃣ Suppression: Exige une confirmation explicite
router.delete('/:id', authenticateToken, authorizeAdmin, deleteCategory);

export default router;
