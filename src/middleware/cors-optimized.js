import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
  // ✅ OPTIMISATION: Cache les requêtes preflight pendant 1 heure
  maxAge: 3600,
  // ✅ Spécifier explicitement les headers autorisés
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Accept-Encoding',
    'Origin'
  ],
  // ✅ Réduire les méthodes exposées
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposedHeaders: ['X-Total-Count', 'Cache-Control']
};

export default cors(corsOptions);
