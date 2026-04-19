import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Validation d'email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Inscription
export const register = async (req, res) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'L\'email et le mot de passe sont obligatoires' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
    }

    // Vérifier si l'utilisateur existe
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (userExists.rows.length > 0) {
      return res.status(409).json({ error: 'Cet email est déjà enregistré' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const result = await pool.query(
      'INSERT INTO users (email, password, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, first_name, last_name, role',
      [email.toLowerCase(), hashedPassword, first_name || '', last_name || '', 'customer']
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.status(201).json({
      message: 'Inscription réussie',
      user,
      token
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Erreur lors de l\'inscription' });
  }
};

// Connexion
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'L\'email et le mot de passe sont obligatoires' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    // Trouver l'utilisateur
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Générer le token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY || '7d' }
    );

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
};

// Obtenir le profil de l'utilisateur
export const getProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const result = await pool.query(
      'SELECT id, email, first_name, last_name, phone, address, city, postal_code, country, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
};

// Mettre à jour le profil
export const updateProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const { first_name, last_name, phone, address, city, postal_code, country } = req.body;

    // Validation optionnelle
    if (phone && !/^[\d\s\-\+\(\)]+$/.test(phone)) {
      return res.status(400).json({ error: 'Numéro de téléphone invalide' });
    }

    if (postal_code && !/^[\d\s\-]+$/.test(postal_code)) {
      return res.status(400).json({ error: 'Code postal invalide' });
    }

    const result = await pool.query(
      'UPDATE users SET first_name = $1, last_name = $2, phone = $3, address = $4, city = $5, postal_code = $6, country = $7, updatedAt = CURRENT_TIMESTAMP WHERE id = $8 RETURNING id, email, first_name, last_name, phone, address, city, postal_code, country',
      [first_name || null, last_name || null, phone || null, address || null, city || null, postal_code || null, country || null, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({ message: 'Profil mis à jour', user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
  }
};
