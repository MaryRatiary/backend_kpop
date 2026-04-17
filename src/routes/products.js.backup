import express from 'express';
import { 
  getAllProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  addProductImage,
  addProductSize,
  addProductColor,
  updateSizeStock,
  updateColorStock
} from '../controllers/productController.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Routes publiques
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Routes admin
router.post('/', authenticateToken, authorizeAdmin, createProduct);
router.put('/:id', authenticateToken, authorizeAdmin, updateProduct);
router.delete('/:id', authenticateToken, authorizeAdmin, deleteProduct);

// Images
router.post('/:productId/images', authenticateToken, authorizeAdmin, addProductImage);

// Tailles et stock
router.post('/:productId/sizes', authenticateToken, authorizeAdmin, addProductSize);
router.put('/:productId/sizes/:sizeId', authenticateToken, authorizeAdmin, updateSizeStock);

// Couleurs et stock
router.post('/:productId/colors', authenticateToken, authorizeAdmin, addProductColor);
router.put('/:productId/colors/:colorId', authenticateToken, authorizeAdmin, updateColorStock);

export default router;
