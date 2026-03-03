import express from 'express';
import { 
  addToCart, 
  getCart, 
  removeFromCart, 
  clearCart 
} from '../controllers/cartController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Routes protégées (authentification requise)
router.post('/', authenticateToken, addToCart);
router.get('/', authenticateToken, getCart);
router.delete('/:productId', authenticateToken, removeFromCart);
router.delete('/', authenticateToken, clearCart);

export default router;
