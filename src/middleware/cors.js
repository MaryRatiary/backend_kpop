import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// Origines autorisées selon l'environnement
const getAllowedOrigins = () => {
  const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';
  
  const origins = [
    'http://localhost:5173',        // Dev local Vite
    'http://localhost:3000',        // Dev local alternative
    'http://127.0.0.1:5173',        // Dev loopback
    'https://kpopshop.netlify.app', // Production Netlify (domaine par défaut)
  ];

  // Ajouter les URLs de production depuis les variables d'env
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  if (process.env.NETLIFY_URL) {
    origins.push(process.env.NETLIFY_URL);
  }

  console.log('🔐 CORS Origins autorisées:', origins);
  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Si pas d'origine (requête du même domaine, mobile, ou server-to-server), accepter
    if (!origin) {
      return callback(null, true);
    }
    
    // Vérifier si l'origine est dans la liste blanche
    if (allowedOrigins.includes(origin) || allowedOrigins.some(o => {
      if (o instanceof RegExp) return o.test(origin);
      return o === origin;
    })) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS bloqué pour l'origine: ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400, // 24h cache du preflight
};

export default cors(corsOptions);
