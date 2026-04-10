import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Valider les variables critiques
if (!process.env.DATABASE_URL && (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME)) {
  console.error('❌ ERREUR: DATABASE_URL ou les variables DB_* doivent être configurées');
  console.error('Variables disponibles:');
  console.error('- DATABASE_URL:', process.env.DATABASE_URL ? '✅' : '❌');
  console.error('- DB_HOST:', process.env.DB_HOST ? '✅' : '❌');
  console.error('- DB_USER:', process.env.DB_USER ? '✅' : '❌');
  console.error('- DB_PASSWORD:', process.env.DB_PASSWORD ? '✅' : '❌');
  console.error('- DB_NAME:', process.env.DB_NAME ? '✅' : '❌');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ ERREUR: JWT_SECRET doit être configuré pour la sécurité');
  process.exit(1);
}

// Priorité: DATABASE_URL d'abord, puis les variables individuelles
let poolConfig;

if (process.env.DATABASE_URL) {
  console.log('🔗 Utilisation de DATABASE_URL');
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
} else {
  console.log('🔗 Utilisation des variables DB_* individuelles');
  poolConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
}

const pool = new Pool(poolConfig);

// Gestion des erreurs du pool
pool.on('error', (err) => {
  console.error('❌ Erreur inattendue sur client idle:', err);
  // Ne pas exit ici - laisser l'application gérer les erreurs
});

pool.on('connect', () => {
  console.log('✅ Connexion établie avec PostgreSQL');
});

// Drapeau pour suivre si la connexion a été testée
let connectionTested = false;

// Fonction pour tester la connexion de manière lazy
export async function ensureConnection() {
  if (connectionTested) {
    return;
  }

  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Base de données connectée');
    connectionTested = true;
  } catch (err) {
    console.error('❌ Impossible de se connecter à la base de données:', err.message);
    throw err;
  }
}

export default pool;
