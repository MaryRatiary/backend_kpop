#!/usr/bin/env node
/**
 * Script de migration de la base de données
 * Exécute les migrations en attente
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

// Charger le fichier .env avant tout
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Client } = pg;

async function runMigrations() {
  console.log('\n🔧 Exécution des migrations...\n');
  
  // Construire la connexion correctement
  let connectionConfig;
  
  if (process.env.DATABASE_URL) {
    connectionConfig = {
      connectionString: process.env.DATABASE_URL
    };
    console.log('🔗 Utilisation de DATABASE_URL (Render/Production)');
  } else {
    connectionConfig = {
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'sinoa_kpop'
    };
    console.log('🔗 Utilisation des variables DB_* locales');
    console.log(`   Host: ${connectionConfig.host}:${connectionConfig.port}`);
    console.log(`   Database: ${connectionConfig.database}`);
  }

  const client = new Client(connectionConfig);

  try {
    await client.connect();
    console.log('✅ Connexion établie avec PostgreSQL\n');

    // Lire le fichier migration 050
    const migrationPath = path.join(__dirname, '../migrations/050_complete_stable_rebuild.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.log('⏭️  Migration 050 non trouvée, skipped');
      await client.end();
      return;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('⏳ Exécution de la migration 050_complete_stable_rebuild.sql...');
    
    try {
      await client.query(migrationSQL);
      console.log('✅ Migration 050 exécutée avec succès!\n');
    } catch (migrationError) {
      // Si la migration 050 échoue (déjà exécutée), continuer
      if (migrationError.message.includes('already exists') || 
          migrationError.message.includes('duplicate')) {
        console.log('⏭️  Migration 050 déjà exécutée\n');
      } else {
        console.error('❌ Erreur migration 050:', migrationError.message);
        console.error('   Code:', migrationError.code);
      }
    }

    // Vérifier le schéma
    console.log('📊 Vérification du schéma...\n');
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('✅ Tables existantes:');
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n✨ Migrations complétées!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur critique:', error.message);
    console.error('\nDétails:', error);
    process.exit(1);
  } finally {
    try {
      await client.end();
    } catch (e) {
      // Ignorer les erreurs de fermeture
    }
  }
}

runMigrations();
