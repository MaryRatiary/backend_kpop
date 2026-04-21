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

// ============================================================
// MIDDLEWARE WEBHOOKS SHOPIFY
// Doit être AVANT express.json() pour capturer le rawBody
// ============================================================
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

// ============================================================
// MIDDLEWARE GÉNÉRAUX
// ============================================================
app.use(corsMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================================
// ROUTES DE BASE
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    message: 'API Sinoa KPOP',
    status: 'online',
    version: '1.0.0',
    shopifyIntegration: 'enabled',
  });
});

app.post('/', (req, res) => {
  res.json({
    message: 'API Sinoa KPOP',
    status: 'online',
    version: '1.0.0',
  });
});

app.get('/install', (req, res) => {
  res.json({
    message: 'Shopify App Installation',
    status: 'ready',
    appName: 'Sinoa KPOP',
  });
});

// ============================================================
// ROUTES APPLICATIVES
// ============================================================
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

// ============================================================
// GESTION DES ERREURS
// ============================================================
app.use((err, req, res, next) => {
  console.error('Erreur:', err);
  res.status(500).json({
    error: 'Erreur serveur',
    message: NODE_ENV === 'development' ? err.message : 'Une erreur est survenue',
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// ============================================================
// ENREGISTREMENT AUTOMATIQUE DES WEBHOOKS SHOPIFY
// ============================================================
async function registerShopifyWebhooks() {
  const shopifyUrl  = process.env.SHOPIFY_SHOP_URL;
  const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const backendUrl  = process.env.BACKEND_URL;

  if (!shopifyUrl || !shopifyToken) {
    console.log('⏭️  Shopify non configuré, webhooks ignorés');
    return;
  }

  if (!backendUrl) {
    console.warn('⚠️  BACKEND_URL manquant — webhooks Shopify non enregistrés automatiquement');
    console.warn('   Ajoutez BACKEND_URL=https://backend-kpop-9wn7.onrender.com dans vos variables d\'env');
    return;
  }

  // Import dynamique pour éviter les imports circulaires au niveau module
  const { default: shopifyClient } = await import('./services/shopifyClient.js');

  const webhooksToRegister = [
    { topic: 'products/create',         address: `${backendUrl}/api/shopify/webhooks/products/create` },
    { topic: 'products/update',         address: `${backendUrl}/api/shopify/webhooks/products/update` },
    { topic: 'products/delete',         address: `${backendUrl}/api/shopify/webhooks/products/delete` },
    { topic: 'inventory_levels/update', address: `${backendUrl}/api/shopify/webhooks/inventory/update` },
  ];

  try {
    const existing = await shopifyClient.getWebhooks();
    const existingAddresses = existing.map(w => w.address);

    console.log('\n🔗 Enregistrement des webhooks Shopify produits...');

    for (const wh of webhooksToRegister) {
      if (existingAddresses.includes(wh.address)) {
        console.log(`   ⏭️  Déjà enregistré: ${wh.topic}`);
      } else {
        try {
          await shopifyClient.createWebhook(wh.topic, wh.address);
          console.log(`   ✅ Enregistré: ${wh.topic}`);
        } catch (err) {
          console.error(`   ❌ Erreur ${wh.topic}:`, err.message);
        }
      }
    }

    console.log('');
  } catch (err) {
    // Ne pas crasher le serveur si Shopify est inaccessible au démarrage
    console.warn('⚠️  Impossible d\'enregistrer les webhooks Shopify au démarrage:', err.message);
  }
}

// ============================================================
// DÉMARRAGE DU SERVEUR
// ============================================================
async function startServer() {
  try {
    console.log('\n🚀 Démarrage du serveur...\n');

    // 1. Migrations
    const migrationsOK = await runMigrations();
    if (!migrationsOK) {
      console.warn('⚠️  Les migrations ont eu des problèmes, mais le serveur continue...\n');
    }

    // 2. Connexion base de données
    try {
      const result = await pool.query('SELECT NOW()');
      console.log('✅ Connexion à la base de données établie');
      console.log(`📅 Heure du serveur: ${result.rows[0].now}\n`);
    } catch (error) {
      console.error('❌ Erreur de connexion à la base de données:', error);
      process.exit(1);
    }

    // 3. Initialisation (admin user, etc.)
    await initializeDatabase();

    // 4. Infos environnement
    console.log(`🌍 Environnement: ${NODE_ENV}`);
    if (NODE_ENV === 'production') {
      console.log('🔗 Utilisation de DATABASE_URL (Render)');
    }

    // 5. Infos Shopify
    const shopifyUrl  = process.env.SHOPIFY_SHOP_URL;
    const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
    if (shopifyUrl && shopifyToken) {
      console.log('\n🔍 Configuration Shopify:');
      console.log(`   SHOPIFY_SHOP_URL: ✅`);
      console.log(`   SHOPIFY_ACCESS_TOKEN: ✅`);
      console.log(`   Base URL: https://${shopifyUrl}/admin/api/2024-01`);
      console.log(`   BACKEND_URL: ${process.env.BACKEND_URL || '❌ MANQUANT'}`);
    }

    // 6. Démarrer le serveur HTTP
    app.listen(PORT, () => {
      console.log(`\n✅ Serveur démarré sur le port ${PORT}`);
      console.log(`🎉 Serveur en ligne!`);
      console.log(`🌍 Environnement: ${NODE_ENV}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      console.log(`🔗 Frontend URL: ${frontendUrl}`);
      console.log(`🛍  Shopify Integration: ${shopifyUrl ? '✅ Activée' : '❌ Désactivée'}\n`);
    });

    // 7. Enregistrer les webhooks Shopify APRÈS le démarrage
    //    (en arrière-plan, ne bloque pas le serveur)
    await registerShopifyWebhooks();

  } catch (error) {
    console.error('❌ Erreur au démarrage du serveur:', error);
    process.exit(1);
  }
}

startServer();

export default app;