import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'kpop_db',
});

async function checkColorsVsThumbnails() {
  try {
    console.log('🔍 Vérification des produits avec plus de couleurs que de photos...\n');

    const query = `
      SELECT 
        p.id,
        p.name,
        p.slug,
        COUNT(DISTINCT pc.id) as color_count,
        COUNT(DISTINCT pi.id) as photo_count,
        COUNT(DISTINCT CASE WHEN pi.isMainImage = true THEN pi.id END) as main_photo_count,
        COUNT(DISTINCT CASE WHEN pi.isHoverImage = true THEN pi.id END) as hover_photo_count
      FROM products p
      LEFT JOIN product_colors pc ON p.id = pc.productId
      LEFT JOIN product_images pi ON p.id = pi.productId
      GROUP BY p.id, p.name, p.slug
      HAVING COUNT(DISTINCT pc.id) > COUNT(DISTINCT pi.id)
      ORDER BY (COUNT(DISTINCT pc.id) - COUNT(DISTINCT pi.id)) DESC;
    `;

    const result = await pool.query(query);

    if (result.rows.length === 0) {
      console.log('✅ Aucun produit avec plus de couleurs que de photos détecté.');
    } else {
      console.log(`⚠️  ${result.rows.length} produit(s) trouvé(s) avec plus de couleurs que de photos:\n`);
      
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.name} (ID: ${row.id})`);
        console.log(`   Slug: ${row.slug}`);
        console.log(`   Couleurs: ${row.color_count}`);
        console.log(`   Photos totales: ${row.photo_count}`);
        console.log(`   - Photos principales: ${row.main_photo_count}`);
        console.log(`   - Photos hover: ${row.hover_photo_count}`);
        console.log(`   Différence: ${row.color_count - row.photo_count} couleur(s) de plus\n`);
      });
    }

    // Statistiques globales
    const statsQuery = `
      SELECT 
        COUNT(*) as total_products,
        AVG(color_count) as avg_colors,
        AVG(photo_count) as avg_photos,
        MAX(color_count) as max_colors,
        MAX(photo_count) as max_photos
      FROM (
        SELECT 
          p.id,
          COUNT(DISTINCT pc.id) as color_count,
          COUNT(DISTINCT pi.id) as photo_count
        FROM products p
        LEFT JOIN product_colors pc ON p.id = pc.productId
        LEFT JOIN product_images pi ON p.id = pi.productId
        GROUP BY p.id
      ) as subquery;
    `;

    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];

    console.log('\n📊 Statistiques globales:');
    console.log(`   Total de produits: ${stats.total_products}`);
    console.log(`   Moyenne de couleurs par produit: ${parseFloat(stats.avg_colors).toFixed(2)}`);
    console.log(`   Moyenne de photos par produit: ${parseFloat(stats.avg_photos).toFixed(2)}`);
    console.log(`   Max de couleurs: ${stats.max_colors}`);
    console.log(`   Max de photos: ${stats.max_photos}`);

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  } finally {
    await pool.end();
  }
}

checkColorsVsThumbnails();
