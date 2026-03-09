import express from 'express';
import { 
  getAdminDashboard,
  getSalesStats,
  getOrderDetails,
  updateOrderStatus,
  getAllOrders
} from '../controllers/dashboardController.js';
import { getOrderByIdAdmin } from '../controllers/orderController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Routes dashboard admin
router.get('/', authenticateToken, getAdminDashboard);
router.get('/stats', authenticateToken, getSalesStats);
router.get('/orders', authenticateToken, getAllOrders);
router.get('/orders/:orderId', authenticateToken, getOrderByIdAdmin);
router.put('/orders/:orderId', authenticateToken, updateOrderStatus);

export default router;
