import express from 'express';
import corsMiddleware from './middleware/cors.js';
import dotenv from 'dotenv';
import pool from './config/database.js';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { initializeDatabase } from './startup.js';

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

// ✅ Middleware de compression
app.use(compression());

// Middleware CORS
app.use(corsMiddleware);

// ✅ Réduire limite JSON à 5mb
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// ✅ Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, réessayez plus tard',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Trop de tentatives de connexion, réessayez plus tard',
});

// Middleware de logging avec timing
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      console.warn(`⚠️ SLOW: ${req.method} ${req.path} - ${duration}ms`);
    }
  });
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
app.use('/api/auth', authLimiter, authRoutes);
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

// ✅ Gestion des erreurs globales améliorée
app.use((err, req, res, next) => {
  console.error('❌ Erreur non gérée:', err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  const message = NODE_ENV === 'development' ? err.message : 'Erreur interne du serveur';
  const status = err.status || err.statusCode || 500;
  
  res.status(status).json({ 
    error: message,
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ✅ Démarrer le serveur APRÈS initialisation de la BDD
const startServer = async () => {
  try {
    // ✅ EXÉCUTER L'INITIALISATION AU DÉMARRAGE
    await initializeDatabase();

    const server = app.listen(PORT, () => {
      console.log(`✅ Serveur démarré sur le port ${PORT}`);
      console.log(`🌍 Environnement: ${NODE_ENV}`);
      console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL}`);
    });

    // Gestion de l'arrêt gracieux
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} reçu, arrêt gracieux du serveur...`);
      server.close(async () => {
        console.log('Serveur fermé');
        try {
          await pool.end();
          console.log('Pool de connexion fermé');
        } catch (err) {
          console.error('Erreur lors de la fermeture du pool:', err);
        }
        process.exit(0);
      });
      
      // Force shutdown après 10 secondes
      setTimeout(() => {
        console.error('⚠️ Forçage de l\'arrêt après 10 secondes');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Gestion des rejets de Promises non gérées
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Promise rejection non gérée:', reason);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Exception non gérée:', error);
      process.exit(1);
    });

  } catch (err) {
    console.error('❌ Erreur lors du démarrage:', err);
    process.exit(1);
  }
};

// Lancer le serveur
startServer();

export default app;
