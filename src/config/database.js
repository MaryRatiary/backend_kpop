import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

console.log(`🌍 Environnement: ${isProduction ? 'PRODUCTION' : 'DÉVELOPPEMENT'}`);

// Validation selon l'environnement
if (isProduction) {
  // En production: DATABASE_URL est obligatoire (fournie par Render)
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERREUR: DATABASE_URL est obligatoire en production');
    process.exit(1);
  }
} else {
  // En développement: variables DB_* individuelles
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error('❌ ERREUR: Variables de base de données manquantes en développement');
    console.error('Configurez dans votre .env:');
    console.error('- DB_HOST:', process.env.DB_HOST ? '✅' : '❌');
    console.error('- DB_USER:', process.env.DB_USER ? '✅' : '❌');
    console.error('- DB_PASSWORD:', process.env.DB_PASSWORD ? '✅' : '❌');
    console.error('- DB_NAME:', process.env.DB_NAME ? '✅' : '❌');
    process.exit(1);
  }
}

if (!process.env.JWT_SECRET) {
  console.error('❌ ERREUR: JWT_SECRET doit être configuré pour la sécurité');
  process.exit(1);
}

// Configuration de la connexion
let poolConfig;

if (isProduction) {
  console.log('🔗 Utilisation de DATABASE_URL (Render)');
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
} else {
  console.log('🔗 Utilisation des variables DB_* locales');
  poolConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    ssl: false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };
}

const pool = new Pool(poolConfig);

// Gestion des erreurs du pool
pool.on('error', (err) => {
  console.error('❌ Erreur inattendue sur client idle:', err);
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
