import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// Valider les variables critiques
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  console.error('❌ ERREUR: DATABASE_URL ou DB_HOST doit être configuré');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ ERREUR: JWT_SECRET doit être configuré pour la sécurité');
  process.exit(1);
}

// Supporter DATABASE_URL (Render) ou les variables individuelles
const pool = new Pool(
  process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }
    : {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      }
);

// Gestion des erreurs du pool
pool.on('error', (err) => {
  console.error('❌ Erreur inattendue sur client idle:', err);
  process.exit(-1);
});

pool.on('connect', () => {
  console.log('✅ Connexion établie avec PostgreSQL');
});

// Test de connexion au démarrage
try {
  const testConnection = await pool.query('SELECT NOW()');
  console.log('✅ Base de données connectée');
} catch (err) {
  console.error('❌ Impossible de se connecter à la base de données:', err.message);
  process.exit(1);
}

export default pool;
