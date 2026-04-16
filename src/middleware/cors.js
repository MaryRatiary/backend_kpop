import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// Origines autorisées selon l'environnement
const getAllowedOrigins = () => {
  const origins = [
    'http://localhost:5173',        // Dev local Vite
    'http://localhost:3000',        // Dev local alternative
    'http://127.0.0.1:5173',        // Dev loopback
    'https://kpopshop.netlify.app', // Production Netlify
  ];

  // Ajouter les URLs de production depuis les variables d'env
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  if (process.env.NETLIFY_URL) {
    origins.push(process.env.NETLIFY_URL);
  }

  return origins;
};

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Si pas d'origine (requête du même domaine ou mobile), accepter
    if (!origin) {
      return callback(null, true);
    }
    
    // Vérifier si l'origine est dans la liste blanche
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS bloqué pour l'origine: ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24h cache du preflight
};

export default cors(corsOptions);
