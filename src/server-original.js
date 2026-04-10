import express from 'express';
import corsMiddleware from './middleware/cors.js';
import dotenv from 'dotenv';
import pool from './config/database.js';

// Importer les routes
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import categoriesRoutes from './routes/categories.js';
import ordersRoutes from './routes/orders.js';
import cartRoutes from './routes/cart.js';
import checkoutRoutes from './routes/checkout.js';
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

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
  res.json({ 
    status: 'Backend is running', 
    environment: NODE_ENV,
    timestamp: new Date() 
  });
});

// Test connexion base de données
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'Database connected',
      time: result.rows[0]
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ 
      error: 'Erreur de connexion à la base de données',
      message: NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Routes API
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('❌ Erreur non gérée:', err);
  
  // Ne pas exposer les détails de l'erreur en production
  const message = NODE_ENV === 'development' ? err.message : 'Erreur interne du serveur';
  
  res.status(err.status || 500).json({ 
    error: message,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Démarrer le serveur
const server = app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur le port ${PORT}`);
  console.log(`🌍 Environnement: ${NODE_ENV}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
});

// Gestion de l'arrêt gracieux
process.on('SIGTERM', async () => {
  console.log('SIGTERM reçu, arrêt du serveur...');
  server.close(async () => {
    console.log('Serveur fermé');
    await pool.end();
    console.log('Pool de connexion fermé');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT reçu, arrêt du serveur...');
  server.close(async () => {
    console.log('Serveur fermé');
    await pool.end();
    console.log('Pool de connexion fermé');
    process.exit(0);
  });
});

export default app;
