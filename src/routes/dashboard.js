import express from 'express';
import { 
  getAdminDashboard,
  getSalesStats,
  getOrderDetails,
  updateOrderStatus,
  getAllOrders
} from '../controllers/dashboardController.js';
import { getOrderByIdAdmin } from '../controllers/orderController.js';
import { authorizeAdmin } from '../middleware/auth.js';

const router = express.Router();

// Routes dashboard admin - utiliser authorizeAdmin au lieu de authenticateToken
router.get('/', authorizeAdmin, getAdminDashboard);
router.get('/stats', authorizeAdmin, getSalesStats);
router.get('/orders', authorizeAdmin, getAllOrders);
router.get('/orders/:orderId', authorizeAdmin, getOrderByIdAdmin);
router.put('/orders/:orderId', authorizeAdmin, updateOrderStatus);

export default router;
