import pool from './src/config/database.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const createAdminUser = async () => {
  try {
    const email = 'maryratiary12@gmail.com';
    const password = 'qwertyuiop123';
    const first_name = 'Admin';
    const last_name = 'User';

    // Vérifier si l'utilisateur existe
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (userExists.rows.length > 0) {
      console.log('❌ L\'utilisateur admin existe déjà !');
      process.exit(1);
    }

    // Hasher le mot de passe
    console.log('🔐 Hachage du mot de passe en cours...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur admin
    const result = await pool.query(
      'INSERT INTO users (email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role',
      [email, hashedPassword, first_name, last_name, 'admin']
    );

    const user = result.rows[0];
    console.log('✅ Utilisateur admin créé avec succès !');
    console.log('📧 Email:', user.email);
    console.log('👤 Nom:', user.first_name, user.last_name);
    console.log('🔑 Rôle:', user.role);
    console.log('🆔 ID:', user.id);
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de la création de l\'utilisateur admin:', err);
    process.exit(1);
  }
};

createAdminUser();
