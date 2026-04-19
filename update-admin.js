import pool from './src/config/database.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const updateAdminUser = async () => {
  try {
    const email = 'maryratiary12@gmail.com';
    const password = 'qwertyuiop123';
    const first_name = 'Admin';
    const last_name = 'User';

    // Hasher le mot de passe
    console.log('🔐 Hachage du mot de passe en cours...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Mettre à jour l'utilisateur admin
    const result = await pool.query(
      'UPDATE users SET password = $1, first_name = $2, last_name = $3, role = $4 WHERE email = $5 RETURNING id, email, first_name, last_name, role',
      [hashedPassword, first_name, last_name, 'admin', email]
    );

    if (result.rows.length === 0) {
      console.log('❌ Utilisateur non trouvé !');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('✅ Utilisateur admin mis à jour avec succès !');
    console.log('📧 Email:', user.email);
    console.log('👤 Nom:', user.first_name, user.last_name);
    console.log('🔑 Rôle:', user.role);
    console.log('🆔 ID:', user.id);
    console.log('✓ Le mot de passe a été hashé automatiquement avec bcrypt');
    
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de la mise à jour de l\'utilisateur admin:', err);
    process.exit(1);
  }
};

updateAdminUser();
