import pool from '../src/config/database.js';
import { formatProductData, formatProductsArray } from '../src/utils/dataFormatter.js';

const testProducts = async () => {
  try {
    console.log('🧪 Test de récupération et formatage des produits...\n');

    // Test 1: Récupérer tous les produits
    const allProducts = await pool.query(`
      SELECT 
        p.*,
        c.name as categoryName, 
        g.name as groupName,
        (SELECT imageUrl FROM product_images WHERE productId = p.id AND isMainImage = true ORDER BY "order" ASC LIMIT 1) as image,
        (SELECT json_agg(imageUrl ORDER BY "order" ASC) FROM product_images WHERE productId = p.id) as images,
        (SELECT json_agg(row_to_json(ps.*)) FROM product_sizes ps WHERE ps.productId = p.id) as sizes,
        (SELECT json_agg(row_to_json(pc.*)) FROM product_colors pc WHERE pc.productId = p.id) as colors
      FROM products p 
      LEFT JOIN categories c ON p.categoryId = c.id 
      LEFT JOIN kpop_groups g ON p.groupId = g.id 
      LIMIT 1
    `);

    if (allProducts.rows.length === 0) {
      console.log('⚠️  Aucun produit trouvé dans la base de données');
      await pool.end();
      process.exit(0);
    }

    const product = allProducts.rows[0];
    console.log('📦 Produit brut avant formatage:');
    console.log(JSON.stringify(product, null, 2));

    console.log('\n✨ Produit après formatage:');
    const formatted = formatProductData(product);
    console.log(JSON.stringify(formatted, null, 2));

    // Vérifications
    console.log('\n✅ Vérifications:');
    console.log(`  - ID: ${formatted.id ? '✅' : '❌'}`);
    console.log(`  - Name: ${formatted.name ? '✅' : '❌'}`);
    console.log(`  - Price: ${formatted.price ? '✅' : '❌'}`);
    console.log(`  - Images (array): ${Array.isArray(formatted.images) ? '✅' : '❌'}`);
    console.log(`  - Sizes (array): ${Array.isArray(formatted.sizes) ? '✅' : '❌'}`);
    console.log(`  - Colors (array): ${Array.isArray(formatted.colors) ? '✅' : '❌'}`);
    
    if (formatted.sizes.length > 0) {
      console.log(`  - Size[0].size: ${typeof formatted.sizes[0].size === 'string' ? '✅ (string)' : '❌'}`);
      console.log(`  - Size[0].stock: ${typeof formatted.sizes[0].stock === 'number' ? '✅ (number)' : '❌'}`);
    }
    
    if (formatted.colors.length > 0) {
      console.log(`  - Color[0].colorName: ${formatted.colors[0].colorName ? '✅' : '❌'}`);
      console.log(`  - Color[0].colorHex: ${formatted.colors[0].colorHex ? '✅' : '❌'}`);
    }

    console.log('\n🎉 Test terminé avec succès!');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors du test:', err);
    await pool.end();
    process.exit(1);
  }
};

testProducts();
