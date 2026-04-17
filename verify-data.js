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

async function verifyData() {
  try {
    console.log('🔍 Vérification des données...\n');
    
    // Total produits
    const totalProducts = await pool.query('SELECT COUNT(*) as count FROM products');
    console.log(`✓ Total produits: ${totalProducts.rows[0].count}`);
    
    // Produits par catégorie (directement)
    const productsByCategory = await pool.query(`
      SELECT c.id, c.name, COUNT(p.id) as count 
      FROM categories c 
      LEFT JOIN products p ON c.id = p.categoryId 
      WHERE c.parentid IS NULL
      GROUP BY c.id, c.name
      ORDER BY c.name
    `);
    
    console.log('\n📊 Produits attachés DIRECTEMENT aux catégories principales:');
    productsByCategory.rows.forEach(row => {
      console.log(`   ${row.name}: ${row.count} produits`);
    });
    
    // Produits par sous-catégorie
    const productsBySubcategory = await pool.query(`
      SELECT c.name as parent_category, s.name as subcategory, COUNT(p.id) as count
      FROM categories c
      JOIN subcategories s ON c.id = s.categoryId
      LEFT JOIN products p ON s.id = p.subcategoryId
      GROUP BY c.id, c.name, s.id, s.name
      ORDER BY c.name, s.name
    `);
    
    console.log('\n📂 Produits par sous-catégories:');
    let totalInSubcats = 0;
    productsBySubcategory.rows.forEach(row => {
      console.log(`   ${row.parent_category} > ${row.subcategory}: ${row.count}`);
      totalInSubcats += row.count;
    });
    
    console.log(`\n✓ Total en sous-catégories: ${totalInSubcats}`);
    console.log(`✓ Total général: ${parseInt(totalProducts.rows[0].count)}`);
    
  } catch (err) {
    console.error('Erreur:', err.message);
  } finally {
    await pool.end();
  }
}

verifyData();
