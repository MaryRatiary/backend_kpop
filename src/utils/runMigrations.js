import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const migrationsDir = path.join(__dirname, '../migrations');

const runMigrations = async () => {
  console.log('\n🔄 Vérification des migrations...');

  // Construire la connexion
  let connectionConfig;
  if (process.env.DATABASE_URL) {
    connectionConfig = { connectionString: process.env.DATABASE_URL };
    console.log('🔗 Utilisation de DATABASE_URL (Render)');
  } else {
    connectionConfig = {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'sinoa_kpop',
    };
  }

  const pool = new Pool(connectionConfig);

  try {
    await pool.query('SELECT 1');
    console.log('✅ Connexion établie avec PostgreSQL');

    // Créer la table schema_migrations si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table schema_migrations existe déjà');

    // Récupérer les migrations déjà exécutées
    const result = await pool.query('SELECT name FROM schema_migrations');
    const executedMigrations = new Set(result.rows.map(row => row.name));
    console.log(`📊 ${executedMigrations.size} migrations déjà exécutées`);

    // Lire tous les fichiers SQL du dossier migrations
    if (!fs.existsSync(migrationsDir)) {
      console.warn('⚠️  Dossier migrations introuvable:', migrationsDir);
      await pool.end();
      return true;
    }

    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📁 ${migrationFiles.length} fichiers de migration trouvés\n`);

    let executedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of migrationFiles) {
      const migrationName = file.replace('.sql', '');

      // Vérifier si déjà exécutée
      if (executedMigrations.has(migrationName)) {
        console.log(`⏭️  Migration '${migrationName}' déjà exécutée`);
        skippedCount++;
        continue;
      }

      try {
        console.log(`⏳ Exécution de ${migrationName}...`);
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Exécuter la migration
        await pool.query(migrationSQL);

        // Enregistrer dans schema_migrations
        await pool.query(
          'INSERT INTO schema_migrations (name, applied_at) VALUES ($1, CURRENT_TIMESTAMP) ON CONFLICT (name) DO NOTHING',
          [migrationName]
        );

        console.log(`✅ ${migrationName} exécutée avec succès`);
        executedCount++;
      } catch (err) {
        // Si la migration contient déjà son propre INSERT dans schema_migrations,
        // l'erreur "already exists" est normale
        if (
          err.message.includes('already exists') ||
          err.message.includes('duplicate key') ||
          err.code === '23505' ||
          err.code === '42P07'
        ) {
          console.log(`⏭️  ${migrationName} déjà appliquée (ignorée)`);
          // Enregistrer quand même pour éviter de réessayer
          await pool.query(
            'INSERT INTO schema_migrations (name, applied_at) VALUES ($1, CURRENT_TIMESTAMP) ON CONFLICT (name) DO NOTHING',
            [migrationName]
          ).catch(() => {});
          skippedCount++;
        } else {
          console.error(`❌ Erreur lors de l'exécution de ${migrationName}:`, err.message);
          errorCount++;
          // Continuer avec la prochaine migration
        }
      }
    }

    console.log(`\n🎉 Migrations terminées!`);
    console.log(`✅ ${executedCount} nouvelles migrations exécutées`);
    console.log(`⏭️  ${skippedCount} migrations ignorées`);
    if (errorCount > 0) {
      console.warn(`⚠️  ${errorCount} migrations en erreur`);
    }
    console.log('✨ Base de données préservée!\n');

    await pool.end();
    return errorCount === 0;
  } catch (err) {
    console.error('❌ Erreur critique lors des migrations:', err.message);
    await pool.end().catch(() => {});
    return false;
  }
};

export default runMigrations;