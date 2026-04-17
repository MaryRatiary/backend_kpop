/**
 * Utilitaires de chiffrement pour protéger les données sensibles
 * Chiffre les informations personnelles dans la base de données
 */
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
const ALGORITHM = 'aes-256-gcm';

/**
 * Chiffrer une chaîne de caractères
 */
export const encrypt = (text) => {
  if (!text) return null;
  
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Erreur de chiffrement:', error.message);
    return text; // Retourner le texte en clair en cas d'erreur
  }
};

/**
 * Déchiffrer une chaîne de caractères
 */
export const decrypt = (encrypted) => {
  if (!encrypted || typeof encrypted !== 'string') return null;
  
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted; // Format invalide, retourner tel quel
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Erreur de déchiffrement:', error.message);
    return null;
  }
};

/**
 * Hasher une chaîne (pour la vérification, non réversible)
 */
export const hash = (text) => {
  return crypto
    .createHash('sha256')
    .update(text + process.env.JWT_SECRET)
    .digest('hex');
};

/**
 * Vérifier un hash
 */
export const verifyHash = (text, hash) => {
  return hash === crypto
    .createHash('sha256')
    .update(text + process.env.JWT_SECRET)
    .digest('hex');
};

export default {
  encrypt,
  decrypt,
  hash,
  verifyHash,
};
