import express from 'express';
import corsMiddleware from './middleware/cors.js';
import dotenv from 'dotenv';
import pool from './config/database.js';
import runMigrations from './utils/runMigrations.js';
import { initializeDatabase } from './utils/initializeDB.js';

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
import shopifyOrdersRoutes from './routes/shopify-orders.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware pour capturer le body brut des webhooks Shopify
app.use((req, res, next) => {
  if (req.path.startsWith('/api/shopify/webhooks')) {
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk.toString('utf8');
    });
    req.on('end', () => {
      req.rawBody = rawBody;
      express.json({ limit: '50mb' })(req, res, next);
    });
  } else {
    next();
  }
});

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes de base
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/shopify', shopifyRoutes);
app.use('/api/admin/shopify', shopifyOrdersRoutes);

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error('Erreur:', err);
  res.status(500).json({
    error: 'Erreur serveur',
    message: NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// Route 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

/**
 * Démarrer le serveur avec les migrations
 */
async function startServer() {
  try {
    console.log('\n🚀 Démarrage du serveur...\n');
    
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
      console.error('❌ Erreur de connexion à la base de données:', error);
      process.exit(1);
    }

    // Initialiser la base de données (créer l'utilisateur admin si nécessaire)
    await initializeDatabase();

    // Afficher les infos du serveur
    console.log(`🌍 Environnement: ${NODE_ENV}`);
    if (NODE_ENV === 'production') {
      console.log('🔗 Utilisation de DATABASE_URL (Render)');
    }

    // Afficher les infos de Shopify si disponibles
    const shopifyUrl = process.env.SHOPIFY_SHOP_URL;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
    if (shopifyUrl && shopifyToken) {
      console.log('🔍 Initialisation ShopifyClient:');
      console.log(`   SHOPIFY_SHOP_URL: ✅`);
      console.log(`   SHOPIFY_ACCESS_TOKEN: ✅`);
      console.log(`   Base URL: ${shopifyUrl}/admin/api/2024-01`);
    }

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log(`✅ Serveur démarré sur le port ${PORT}`);
      console.log(`\n🎉 Serveur en ligne!`);
      console.log(`🌍 Environnement: ${NODE_ENV}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      console.log(`🔗 Frontend URL: ${frontendUrl}`);
      console.log(`🛍 Shopify Integration: ${shopifyUrl ? '✅ Activée' : '❌ Désactivée'}`);
      console.log('\n');
    });
  } catch (error) {
    console.error('❌ Erreur au démarrage du serveur:', error);
    process.exit(1);
  }
}

// Démarrer le serveur
startServer();

export default app;
