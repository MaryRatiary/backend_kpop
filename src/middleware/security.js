/**
 * Middleware de sécurité renforcée
 * Corrige les vulnérabilités critiques identifiées
 */
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Configuration Helmet pour les headers de sécurité
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 an
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

// Rate limiting pour l'authentification
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max par IP
  message: 'Trop de tentatives de connexion, réessayez après 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development', // Désactiver en dev
  handler: (req, res) => {
    res.status(429).json({
      error: 'Trop de tentatives',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

// Rate limiting général pour les APIs
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requêtes par minute
  message: 'Trop de requêtes, réessayez plus tard',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting strict pour les uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10, // 10 uploads par heure
  message: 'Limite d\'uploads atteinte, réessayez plus tard',
});

// Middleware pour forcer HTTPS en production
export const enforceHttps = (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
  }
  next();
};

// Middleware pour nettoyer les inputs (XSS prevention)
export const sanitizeInputs = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    const sanitized = {};
    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Supprimer les caractères dangereux
        sanitized[key] = obj[key]
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim();
      } else if (typeof obj[key] === 'object') {
        sanitized[key] = sanitize(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
    return sanitized;
  };
  
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);
  next();
};

// Middleware pour limiter la taille des fichiers
export const fileSizeLimiter = (req, res, next) => {
  const maxSize = 10 * 1024; // 10KB pour JSON
  
  req.on('data', (chunk) => {
    if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
      res.status(413).json({ error: 'Payload trop volumineux' });
      req.connection.destroy();
    }
  });
  next();
};

export default {
  securityHeaders,
  authLimiter,
  apiLimiter,
  uploadLimiter,
  enforceHttps,
  sanitizeInputs,
  fileSizeLimiter,
};
