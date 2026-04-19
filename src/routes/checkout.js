import express from 'express';
import { 
  createOrder,
  getUserOrders,
  getOrderById,
  getOrderByIdAdmin,
  cancelOrder,
  updateOrderStatus,
  retrySyncWithShopify
} from '../controllers/orderController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// ============ USER ROUTES (authentification requise) ============

// POST /api/checkout - Créer une commande
router.post('/', authenticateToken, createOrder);

// GET /api/checkout - Obtenir toutes les commandes de l'utilisateur
router.get('/', authenticateToken, getUserOrders);

// GET /api/checkout/:orderId - Obtenir les détails d'une commande (utilisateur)
router.get('/:orderId', authenticateToken, getOrderById);

// PUT /api/checkout/:orderId/cancel - Annuler une commande
router.put('/:orderId/cancel', authenticateToken, cancelOrder);

// ✨ NEW: PUT /api/checkout/:orderId/retry-sync - Réessayer la synchronisation Shopify
router.put('/:orderId/retry-sync', authenticateToken, retrySyncWithShopify);

// ============ ADMIN ROUTES (authentification requise) ============

// GET /api/checkout/admin/:orderId - Obtenir les détails complets d'une commande (admin)
router.get('/admin/:orderId', authenticateToken, getOrderByIdAdmin);

// PUT /api/checkout/admin/:orderId - Mettre à jour le statut d'une commande (admin)
router.put('/admin/:orderId', authenticateToken, updateOrderStatus);

export default router;