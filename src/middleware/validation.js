/**
 * Middleware de validation des inputs
 * Utilise express-validator pour valider tous les inputs
 */
import { body, query, param, validationResult } from 'express-validator';

/**
 * Middleware pour gérer les erreurs de validation
 */
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Données invalides',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Validations pour l'authentification
 */
export const validateRegister = [
  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Email invalide')
    .isLength({ max: 255 })
    .withMessage('Email trop long'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le mot de passe doit contenir majuscules, minuscules, chiffres et caractères spéciaux'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Prénom obligatoire')
    .isLength({ min: 2, max: 50 })
    .withMessage('Prénom invalide'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Nom obligatoire')
    .isLength({ min: 2, max: 50 })
    .withMessage('Nom invalide'),
];

export const validateLogin = [
  body('email')
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Email invalide'),
  body('password')
    .notEmpty()
    .withMessage('Mot de passe obligatoire'),
];

/**
 * Validations pour les profils utilisateur
 */
export const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Prénom invalide'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Nom invalide'),
  body('phone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Numéro de téléphone invalide'),
  body('address')
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage('Adresse trop longue'),
  body('city')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Ville invalide'),
  body('postalCode')
    .optional()
    .trim()
    .matches(/^[A-Z0-9\s\-]+$/i)
    .withMessage('Code postal invalide'),
  body('country')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Pays invalide'),
];

/**
 * Validations pour les produits
 */
export const validateProductCreate = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Nom du produit obligatoire')
    .isLength({ min: 3, max: 255 })
    .withMessage('Nom invalide'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Description trop longue'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Prix invalide'),
  body('categoryId')
    .isInt({ min: 1 })
    .withMessage('Catégorie invalide'),
];

export const validateProductUpdate = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID produit invalide'),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 255 })
    .withMessage('Nom invalide'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Prix invalide'),
];

/**
 * Validations pour les commandes
 */
export const validateOrderCreate = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Au moins un article obligatoire'),
  body('items.*.productId')
    .isInt({ min: 1 })
    .withMessage('ID produit invalide'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Quantité invalide'),
  body('shippingAddress')
    .notEmpty()
    .withMessage('Adresse de livraison obligatoire'),
  body('shippingAddress.street')
    .trim()
    .isLength({ min: 5, max: 255 })
    .withMessage('Rue invalide'),
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Ville invalide'),
  body('shippingAddress.zipCode')
    .trim()
    .matches(/^[A-Z0-9\s\-]+$/i)
    .withMessage('Code postal invalide'),
  body('shippingAddress.country')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Pays invalide'),
];

/**
 * Validations pour les avis/reviews
 */
export const validateReviewCreate = [
  body('productId')
    .isInt({ min: 1 })
    .withMessage('ID produit invalide'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Note doit être entre 1 et 5'),
  body('comment')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Commentaire doit faire entre 10 et 1000 caractères'),
];

/**
 * Validations pour la pagination
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page invalide'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limite invalide'),
];

export default {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validateProductCreate,
  validateProductUpdate,
  validateOrderCreate,
  validateReviewCreate,
  validatePagination,
};
