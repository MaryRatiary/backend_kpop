import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  console.error('❌ ERREUR: DATABASE_URL ou DB_HOST doit être configuré');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ ERREUR: JWT_SECRET doit être configuré pour la sécurité');
  process.exit(1);
}

const poolConfig = process.env.DATABASE_URL 
  ? { 
      connectionString: process.env.DATABASE_URL, 
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 50,
      min: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      query_timeout: 30000,
    }
  : {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 50,
      min: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      query_timeout: 30000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('❌ Erreur inattendue sur client idle:', err);
  setTimeout(() => {
    console.log('🔄 Tentative de reconnexion à la base de données...');
  }, 5000);
});

pool.on('connect', () => {
  console.log('✅ Connexion établie avec PostgreSQL');
});

try {
  const testConnection = await pool.query('SELECT NOW()');
  console.log('✅ Base de données connectée');
} catch (err) {
  console.error('❌ Impossible de se connecter à la base de données:', err.message);
  process.exit(1);
}

export default pool;
