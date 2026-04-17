/**
 * Serveur avec sécurité renforcée
 * Intègre tous les correctifs de sécurité identifiés
 */
import express from 'express';
import corsMiddleware from './middleware/cors.js';
import dotenv from 'dotenv';
import pool from './config/database.js';
import runMigrations from './utils/runMigrations.js';
import compression from 'compression';

// 🔒 Middlewares de sécurité
import { 
  securityHeaders, 
  authLimiter, 
  apiLimiter, 
  enforceHttps, 
  sanitizeInputs 
} from './middleware/security.js';

// 📋 Validations
import { handleValidationErrors } from './middleware/validation.js';

// Importer les routes
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import reviewsRoutes from './routes/reviews.js';
import categoriesRoutes from './routes/categories.js';
import ordersRoutes from './routes/orders.js';
import cartRoutes from './routes/cart.js';
import checkoutRoutes from './routes/checkout.js';
import dashboardRoutes from './routes/dashboard.js';
import shopifyRoutes from './routes/shopify.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ════════════════════════════════════════════════════════════
// 🔒 COUCHE 1: SÉCURITÉ GLOBALE
// ════════════════════════════════════════════════════════════

// Forcer HTTPS en production
app.use(enforceHttps);

// Headers de sécurité (Helmet)
app.use(securityHeaders);

// Compression des réponses
app.use(compression());

// Rate limiting global
app.use(apiLimiter);

// ════════════════════════════════════════════════════════════
// 🔒 COUCHE 2: PARSING DES DONNÉES
// ════════════════════════════════════════════════════════════

// CORS
app.use(corsMiddleware);

// Middleware pour capturer le body brut des webhooks Shopify
app.use((req, res, next) => {
  if (req.path.startsWith('/api/shopify/webhooks')) {
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk.toString('utf8');
    });
    req.on('end', () => {
      req.rawBody = rawBody;
      express.json({ limit: '10kb' })(req, res, next);
    });
  } else {
    next();
  }
});

// Parser JSON avec limite réduite
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// ════════════════════════════════════════════════════════════
// 🔒 COUCHE 3: NETTOYAGE DES DONNÉES
// ════════════════════════════════════════════════════════════

// Nettoyer les inputs (XSS prevention)
app.use(sanitizeInputs);

// ════════════════════════════════════════════════════════════
// 📝 LOGGING
// ════════════════════════════════════════════════════════════

// Middleware de logging sécurisé
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const path = req.path;
  
  // Ne pas logger les tokens sensibles
  const logSafeBody = req.body && typeof req.body === 'object'
    ? { ...req.body, password: '***', token: '***' }
    : req.body;
  
  console.log(`[${timestamp}] ${method} ${path}`);
  next();
});

// ════════════════════════════════════════════════════════════
// 🛣️ ROUTES
// ════════════════════════════════════════════════════════════

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV
  });
});

// Routes avec rate limiting spécifique
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/shopify', shopifyRoutes);

// ════════════════════════════════════════════════════════════
// 🚨 GESTION DES ERREURS
// ════════════════════════════════════════════════════════════

// Middleware pour gérer les erreurs de validation
app.use(handleValidationErrors);

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('❌ Erreur:', err.message);
  
  // En production, ne JAMAIS exposer les détails
  const errorResponse = {
    error: 'Erreur serveur',
    ...(NODE_ENV === 'development' && { message: err.message, stack: err.stack }),
  };
  
  // Codes d'erreur spécifiques
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Données invalides', details: err.message });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  
  res.status(err.status || 500).json(errorResponse);
});

// Route 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// ════════════════════════════════════════════════════════════
// 🚀 DÉMARRAGE DU SERVEUR
// ════════════════════════════════════════════════════════════

async function startServer() {
  try {
    console.log('\n🚀 Démarrage du serveur sécurisé...\n');
    
    // Exécuter les migrations au démarrage
    const migrationsOK = await runMigrations();
    if (!migrationsOK) {
      console.warn('⚠️  Les migrations ont eu des problèmes, mais le serveur continue...\n');
    }

    // Vérifier la connexion à la base de données
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('✅ Connexion à la base de données établie');
      console.log(`📅 Heure du serveur: ${result.rows[0].now}\n`);
    } catch (error) {
      console.error('❌ Erreur de connexion à la base de données:', error.message);
      process.exit(1);
    }

    // Afficher les infos du serveur
    console.log(`🌍 Environnement: ${NODE_ENV}`);
    console.log(`🔒 Sécurité: RENFORCÉE`);
    console.log(`⚡ Rate limiting: ACTIVÉ`);
    console.log(`🛡️  Headers de sécurité: ACTIVÉS`);
    
    if (NODE_ENV === 'production') {
      console.log('🔐 HTTPS: FORCÉ');
      console.log('🔗 Utilisation de DATABASE_URL (Render)');
    }

    // Afficher les infos de Shopify si disponibles
    const shopifyUrl = process.env.SHOPIFY_SHOP_URL;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
    if (shopifyUrl && shopifyToken) {
      console.log('🔍 Initialisation Shopify:');
      console.log(`   SHOPIFY_SHOP_URL: ✅`);
      console.log(`   SHOPIFY_ACCESS_TOKEN: ✅`);
      console.log(`   Base URL: ${shopifyUrl}/admin/api/2024-01`);
    }

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`\n✅ Serveur sécurisé démarré sur le port ${PORT}`);
      console.log(`🎉 Serveur en ligne!`);
      console.log(`🌍 Environnement: ${NODE_ENV}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      console.log(`🔗 Frontend URL: ${frontendUrl}`);
      console.log(`🛒 Shopify Integration: ${shopifyUrl ? '✅ Activée' : '❌ Désactivée'}`);
      console.log(`\n📊 Sécurité:`);
      console.log(`   • Rate limiting: ✅`);
      console.log(`   • CORS: ✅`);
      console.log(`   • XSS Protection: ✅`);
      console.log(`   • Validation des inputs: ✅`);
      console.log(`   • Headers sécurisés: ✅`);
      console.log('\n');
    });
  } catch (error) {
    console.error('❌ Erreur au démarrage du serveur:', error.message);
    process.exit(1);
  }
}

// Démarrer le serveur
startServer();

export default app;
