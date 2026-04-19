#!/usr/bin/env node
/**
 * Script pour exécuter toutes les migrations en séquence
 * Usage: node scripts/run-all-migrations.js
 */

import fs from 'fs';
import path from 'path';
import pool from '../src/config/database.js';

const __dirname = new URL('.', import.meta.url).pathname;
const migrationsDir = path.join(__dirname, '../migrations');

async function executeMigrations() {
  try {
    console.log('🔧 Démarrage des migrations...\n');

    // Lire tous les fichiers SQL de migrations
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📋 Trouvé ${files.length} fichiers de migration\n`);

    for (const file of files) {
      const migrationPath = path.join(migrationsDir, file);
      const migrationName = path.basename(file, '.sql');

      try {
        console.log(`⏳ Exécution de ${migrationName}...`);
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        await pool.query(sql);
        console.log(`✅ ${migrationName} exécutée avec succès!\n`);
      } catch (err) {
        // Continuer même si une migration échoue
        if (err.code === '23505' || err.message.includes('already exists')) {
          console.log(`⏭️  ${migrationName} déjà exécutée\n`);
        } else {
          console.error(`❌ Erreur dans ${migrationName}:`, err.message);
          console.error(`   Code: ${err.code}\n`);
        }
      }
    }

    // Afficher le résumé final
    console.log('\n✨ Migrations complétées!');
    
    const result = await pool.query(`
      SELECT name, applied_at 
      FROM schema_migrations 
      ORDER BY applied_at DESC 
      LIMIT 10
    `);

    console.log('\n📊 10 dernières migrations exécutées:');
    result.rows.forEach(row => {
      console.log(`   ✅ ${row.name} - ${new Date(row.applied_at).toLocaleString()}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur critique:', err.message);
    process.exit(1);
  }
}

executeMigrations();
