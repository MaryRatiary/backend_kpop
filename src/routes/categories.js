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
import { preDeleteCategoryCheck, deleteCategorySecure } from '../controllers/categorySecureDelete.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// ⚠️ IMPORTANT: L'ordre des routes est CRUCIAL en Express!
// Les routes SPÉCIFIQUES doivent être AVANT les routes GÉNÉRIQUES

// 1️⃣ ROUTE PRINCIPALE - Obtenir toutes les catégories
router.get('/', getAllCategories);

// 2️⃣ Routes publiques avec chemins EXPLICITES (avant les paramètres)
router.get('/flat/all', getAllCategoriesFlat);
router.get('/slug/:slug', getCategoryBySlug);

// 3️⃣ Routes avec paramètres NOMMÉS pour éviter les conflits
// Ces routes ont des noms de paramètres différents pour que Express ne les confonde pas
router.get('/:categoryId/children', getChildCategories);
router.get('/:categoryId/subcategories', getSubcategoriesByCategory);

// 4️⃣ Routes admin avec paramètres spécifiques
router.get('/:id/delete-check', authenticateToken, authorizeAdmin, preDeleteCategoryCheck);

// 5️⃣ Routes CRUD (doivent être après les GET spécifiques)
router.post('/', authenticateToken, authorizeAdmin, createCategory);
router.put('/:id', authenticateToken, authorizeAdmin, updateCategory);
router.put('/:id/reorder', authenticateToken, authorizeAdmin, reorderCategory);
router.delete('/:id', authenticateToken, authorizeAdmin, deleteCategorySecure);

// 6️⃣ Route générique GET pour récupérer une catégorie par ID (EN DERNIER!)
router.get('/:id', getCategoryWithChildren);

export default router;
