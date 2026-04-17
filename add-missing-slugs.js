import pool from './src/config/database.js';

async function addMissingSlugs() {
  try {
    console.log('🔍 Recherche des catégories sans slug...');
    
    // Trouver toutes les catégories
    const categories = await pool.query('SELECT id, name, slug FROM categories ORDER BY id');
    
    let updatedCount = 0;
    
    for (const cat of categories.rows) {
      if (!cat.slug || cat.slug === null || cat.slug === '') {
        // Générer un slug à partir du nom
        const slug = cat.name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[é]/g, 'e')
          .replace(/[è]/g, 'e')
          .replace(/[ê]/g, 'e')
          .replace(/[à]/g, 'a')
          .replace(/[ç]/g, 'c')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .trim('-');
        
        console.log(`  Mise à jour: ${cat.id} - "${cat.name}" -> "${slug}"`);
        
        await pool.query(
          'UPDATE categories SET slug = $1 WHERE id = $2',
          [slug, cat.id]
        );
        
        updatedCount++;
      }
    }
    
    console.log(`✅ ${updatedCount} catégorie(s) mise(s) à jour avec des slugs`);
    
  } catch (err) {
    console.error('❌ Erreur:', err);
  } finally {
    await pool.end();
  }
}

addMissingSlugs();
