import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

export const initializeDatabase = async () => {
  try {
    console.log('🔄 Vérification de l\'initialisation de la base de données...');

    // Vérifier si l'utilisateur admin existe
    const adminExists = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['maryratiary12@gmail.com']
    );

    if (adminExists.rows.length > 0) {
      console.log('✅ Utilisateur admin trouvé - base de données déjà initialisée');
      return;
    }

    console.log('📝 Création de l\'utilisateur admin...');
    const hashedPassword = await bcrypt.hash('qwertyuiop123', 10);

    await pool.query(
      'INSERT INTO users (email, password, first_name, last_name, role, created_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)',
      ['maryratiary12@gmail.com', hashedPassword, 'Admin', 'User', 'admin']
    );

    console.log('✅ Utilisateur admin créé automatiquement !');
    console.log('📧 Email: maryratiary12@gmail.com');
    console.log('🔑 Mot de passe: qwertyuiop123');
    console.log('👤 Rôle: admin');
  } catch (err) {
    console.error('⚠️  Erreur lors de l\'initialisation de la base de données:', err.message);
    // Ne pas arrêter le serveur si l'initialisation échoue
  }
};
