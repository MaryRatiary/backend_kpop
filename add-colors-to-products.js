import pool from './src/config/database.js';

const COLORS = [
  { name: 'Noir', hex: '#000000' },
  { name: 'Blanc', hex: '#FFFFFF' },
  { name: 'Rose', hex: '#FF69B4' },
  { name: 'Bleu', hex: '#0000FF' },
  { name: 'Rouge', hex: '#FF0000' },
  { name: 'Vert', hex: '#008000' },
  { name: 'Jaune', hex: '#FFFF00' },
  { name: 'Violet', hex: '#800080' },
];

async function addColorsToProducts() {
  try {
    console.log('🎨 Ajout des couleurs aux produits...');
    
    const products = await pool.query('SELECT id FROM products LIMIT 100');
    console.log(`✅ ${products.rows.length} produits trouvés`);
    
    let addedCount = 0;
    for (const product of products.rows) {
      for (let i = 0; i < 3; i++) {
        const color = COLORS[i % COLORS.length];
        const result = await pool.query(
          `INSERT INTO product_colors (productId, colorName, colorHex, stock) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (productId, colorName) DO NOTHING
           RETURNING id`,
          [product.id, color.name, color.hex, 15]
        );
        if (result.rows.length > 0) addedCount++;
      }
    }
    
    console.log(`✅ ${addedCount} couleurs ajoutées!`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

addColorsToProducts();
