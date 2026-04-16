import express from 'express';
import { 
  getProductReviews, 
  createReview, 
  markAsHelpful, 
  markAsNotHelpful,
  deleteReview
} from '../controllers/reviewController.js';

const router = express.Router();

// Routes publiques
router.get('/product/:productId', getProductReviews);

// Routes protégées (optionnel - pour créer des avis)
router.post('/product/:productId', createReview);

// Marquer comme utile/non utile (public)
router.put('/:reviewId/helpful', markAsHelpful);
router.put('/:reviewId/not-helpful', markAsNotHelpful);

// Supprimer (admin)
router.delete('/:reviewId', deleteReview);

export default router;
