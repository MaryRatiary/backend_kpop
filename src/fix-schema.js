#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function fixDatabaseSchema() {
  console.log('🔧 Démarrage du fix de schéma...');
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connexion établie');

    const fixScript = `
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'version') THEN
          ALTER TABLE schema_migrations ADD COLUMN version VARCHAR(255) UNIQUE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'name') THEN
          ALTER TABLE schema_migrations ADD COLUMN name VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'applied_at') THEN
          ALTER TABLE schema_migrations ADD COLUMN applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schema_migrations' AND column_name = 'migration') THEN
          ALTER TABLE schema_migrations ADD COLUMN migration VARCHAR(255);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id') THEN
          ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
    `;

    await client.query(fixScript);
    console.log('✅ Schema fix appliqué!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await client.end();
  }
}

fixDatabaseSchema();