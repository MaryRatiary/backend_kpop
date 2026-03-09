import fs from 'fs';
import path from 'path';
import pool from '../src/config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const runMigrations = async () => {
  try {
    console.log('🚀 Démarrage de l\'initialisation de la base de données...');
    console.log('📊 DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurée' : '❌ Non configurée');

    const migrationsDir = path.join(process.cwd(), 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.error('❌ Le dossier migrations n\'existe pas');
      process.exit(1);
    }

    // Lire tous les fichiers de migration
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📁 Migrations trouvées: ${files.length}`);
    files.forEach(file => console.log(`  - ${file}`));

    // Exécuter chaque migration
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`\n▶️  Exécution de: ${file}`);
      
      try {
        await pool.query(sql);
        console.log(`✅ ${file} exécutée avec succès`);
      } catch (err) {
        console.error(`⚠️  Erreur lors de l'exécution de ${file}:`, err.message);
        // Ne pas interrompre, continuer avec les autres migrations
      }
    }

    console.log('\n✅ Toutes les migrations ont été traitées!');
    
    // Vérifier que l'admin a bien été créé
    const adminCheck = await pool.query('SELECT id, email, role FROM users WHERE email = $1', ['admin123@gmail.com']);
    if (adminCheck.rows.length > 0) {
      console.log('✅ Compte admin créé:', adminCheck.rows[0].email);
    } else {
      console.log('⚠️  Compte admin non trouvé');
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur critique:', err);
    process.exit(1);
  }
};

runMigrations();
