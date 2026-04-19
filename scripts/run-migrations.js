import pool from '../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, '../migrations');

const runMigrations = async () => {
  try {
    console.log('🔄 Exécution des migrations en attente...');
    
    // Créer la table schema_migrations si elle n'existe pas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table schema_zmigrations vérifiée');

    // Récupérer les migrations déjà exécutées
    const result = await pool.query('SELECT name FROM schema_migrations');
    const executedMigrations = new Set(result.rows.map(row => row.name));
    console.log(`📊 ${executedMigrations.size} migrations déjà exécutées`);

    // Lire tous les fichiers de migration
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📁 ${migrationFiles.length} migrations trouvées\n`);

    let executedCount = 0;
    let skippedCount = 0;

    // Exécuter les migrations manquantes
    for (const file of migrationFiles) {
      const migrationName = file.replace('.sql', '');
      
      if (executedMigrations.has(migrationName)) {
        console.log(`⏭️  Ignorée: ${migrationName}`);
        skippedCount++;
        continue;
      }

      try {
        console.log(`⏳ Exécution de ${migrationName}...`);
        const migrationPath = path.join(migrationsDir, file);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        // Exécuter la migration
        await pool.query(migrationSQL);
        
        // Enregistrer la migration
        await pool.query(
          'INSERT INTO schema_migrations (name, executed_at) VALUES ($1, CURRENT_TIMESTAMP) ON CONFLICT (name) DO NOTHING',
          [migrationName]
        );
        
        console.log(`✅ ${migrationName} exécutée avec succès`);
        executedCount++;
      } catch (err) {
        console.error(`❌ Erreur lors de l'exécution de ${migrationName}:`);
        console.error(err.message);
        // Continuer avec la prochaine migration
      }
    }

    console.log(`\n🎉 Migration terminée!`);
    console.log(`✅ ${executedCount} nouvelles migrations exécutées`);
    console.log(`⏭️  ${skippedCount} migrations ignorées`);
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur critique lors des migrations:', err);
    process.exit(1);
  }
};

runMigrations();
