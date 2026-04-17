import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function checkDB() {
  try {
    const products = await pool.query('SELECT COUNT(*) as count FROM products');
    const categories = await pool.query('SELECT COUNT(*) as count FROM categories');
    const subcategories = await pool.query('SELECT COUNT(*) as count FROM subcategories');
    const images = await pool.query('SELECT COUNT(*) as count FROM product_images');
    
    console.log('🔍 État de la base de données:');
    console.log(`   - Produits: ${products.rows[0].count}`);
    console.log(`   - Catégories: ${categories.rows[0].count}`);
    console.log(`   - Sous-catégories: ${subcategories.rows[0].count}`);
    console.log(`   - Images: ${images.rows[0].count}`);
    
    // Vérifier les produits par catégorie
    const byCategory = await pool.query(`
      SELECT c.name, COUNT(p.id) as count 
      FROM categories c 
      LEFT JOIN products p ON c.id = p.categoryId 
      GROUP BY c.id, c.name
    `);
    console.log('\n📊 Produits par catégorie:');
    byCategory.rows.forEach(row => {
      console.log(`   - ${row.name}: ${row.count}`);
    });
    
  } catch (err) {
    console.error('Erreur:', err.message);
  } finally {
    await pool.end();
  }
}

checkDB();
