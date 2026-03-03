import express from 'express';
import { 
  createOrder, 
  getUserOrders, 
  getOrderById,
  cancelOrder
} from '../controllers/orderController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Routes client (authentifiées)
router.post('/', authenticateToken, createOrder);
router.get('/', authenticateToken, getUserOrders);
router.get('/:orderId', authenticateToken, getOrderById);
router.put('/:orderId/cancel', authenticateToken, cancelOrder);

export default router;
