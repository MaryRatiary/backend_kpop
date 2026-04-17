import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const slugify = (str) => {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const TYPE_TO_PARENT = {
  'T-shirt': 'Vêtements & Accessoires',
  'Sweat': 'Vêtements & Accessoires',
  'Pull': 'Vêtements & Accessoires',
  'Veste': 'Vêtements & Accessoires',
  'Pyjama': 'Vêtements & Accessoires',
  'Costume': 'Vêtements & Accessoires',
  'Chaussure': 'Vêtements & Accessoires',
  'Chausson': 'Vêtements & Accessoires',
  'Casquette': 'Vêtements & Accessoires',
  'Bonnet': 'Vêtements & Accessoires',
  'Mitaine': 'Vêtements & Accessoires',
  'Sac a dos': 'Accessoires & Décoration',
  'Sac à dos': 'Accessoires & Décoration',
  'Sac à main': 'Accessoires & Décoration',
  'Trousse': 'Accessoires & Décoration',
  'Boite à déjeuner': 'Accessoires & Décoration',
  'Boite à bijoux': 'Accessoires & Décoration',
  'Montre': 'Accessoires & Décoration',
  'Bracelet': 'Accessoires & Décoration',
  'Collier': 'Accessoires & Décoration',
  'Gourde': 'Accessoires & Décoration',
  'Mug': 'Accessoires & Décoration',
  'Lampe': 'Accessoires & Décoration',
  'Couverture': 'Accessoires & Décoration',
  'Poster': 'Accessoires & Décoration',
  'Stickers': 'Accessoires & Décoration',
  'Coque': 'Accessoires & Décoration',
  'Figurine': 'Collectibles & Loisirs',
  'Peluche': 'Collectibles & Loisirs',
  'Photocards': 'Collectibles & Loisirs',
  'Calendrier': 'Collectibles & Loisirs',
  'Box': 'Collectibles & Loisirs',
  'Epée': 'Collectibles & Loisirs',
  'Lightstick': 'Collectibles & Loisirs',
  'Ensemble': 'Collectibles & Loisirs',
};

const parseVariants = (variantDetails) => {
  if (!variantDetails) return { colors: [], sizes: [] };
  const colors = [];
  const sizes = [];
  const parts = variantDetails.split('|').map(p => p.trim());
  parts.forEach(part => {
    if (part.startsWith('Couleur:')) {
      colors.push(...part.replace('Couleur:', '').trim().split(',').map(c => c.trim()).filter(c => c));
    } else if (part.match(/^(Taille|Pointure|Modèle|Ensemble|Option|Capacité|Longueur):/)) {
      const match = part.match(/^[^:]+:\s*(.+)$/);
      if (match) sizes.push(...match[1].split(',').map(s => s.trim()).filter(s => s));
    }
  });
  return { colors, sizes };
};

const parseImages = (imageUrls) => {
  if (!imageUrls) return [];
  return imageUrls.split('|').map(url => url.trim()).filter(url => url && url.startsWith('http'));
};

const parseDate = (dateStr) => {
  if (!dateStr || dateStr === '') return new Date();
  try { return new Date(dateStr); } catch { return new Date(); }
};

async function importHuntrixUnified() {
  const client = await pool.connect();
  try {
    console.log('🚀 Import Huntrix - Structure unifiée (categories uniquement)\n');

    // 1. SUPPRIMER les données existantes
    console.log('🗑️  Suppression des données existantes...');
    await client.query('DELETE FROM order_items');
    await client.query('DELETE FROM product_colors');
    await client.query('DELETE FROM product_sizes');
    await client.query('DELETE FROM product_images');
    await client.query('DELETE FROM reviews');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM categories WHERE parentId IS NOT NULL');
    await client.query('DELETE FROM categories WHERE parentId IS NULL');
    await client.query('DELETE FROM kpop_groups');
    console.log('✓ Données supprimées\n');

    // 2. CRÉER le groupe Huntrix
    const groupResult = await client.query(
      `INSERT INTO kpop_groups (name, slug, description) VALUES ($1, $2, $3) RETURNING id`,
      ['Huntrix', 'huntrix', 'Collection officielle Huntrix - Demon Hunters']
    );
    const groupId = groupResult.rows[0].id;
    console.log(`✓ Groupe Huntrix créé (ID: ${groupId})\n`);

    // 3. LIRE le CSV
    console.log('📖 Lecture du CSV...');
    const csvPath = path.join(__dirname, '..', 'produits_huntrix.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true, skip_empty_lines: true, relax_quotes: true, escape: '"'
    });
    console.log(`✓ ${records.length} produits trouvés\n`);

    // Découvrir tous les types uniques
    const typesSet = new Set();
    records.forEach(record => {
      const type = record.Type_Produit?.trim();
      if (type) typesSet.add(type);
    });
    const uniqueTypes = Array.from(typesSet).sort();
    console.log(`✓ ${uniqueTypes.length} types de produits découverts\n`);

    // 4. CRÉER les 3 catégories PARENT
    console.log('📁 Création des 3 catégories parents...');
    const parentCategories = {};
    const parentData = {
      'Vêtements & Accessoires': 'Tous les vêtements et accessoires Huntrix',
      'Accessoires & Décoration': 'Accessoires, bijoux et articles de décoration',
      'Collectibles & Loisirs': 'Figurines, collections et articles spécialisés'
    };

    let order = 0;
    for (const [parentName, desc] of Object.entries(parentData)) {
      const result = await client.query(
        `INSERT INTO categories (name, slug, level, "order", description, parentId) 
         VALUES ($1, $2, $3, $4, $5, NULL) RETURNING id`,
        [parentName, slugify(parentName), 0, order++, desc]
      );
      parentCategories[parentName] = result.rows[0].id;
      console.log(`  ✓ ${parentName} (ID: ${parentCategories[parentName]})`);
    }
    console.log();

    // 5. CRÉER les catégories ENFANTS (une par type de produit)
    console.log('📂 Création des catégories enfants par type de produit...\n');
    const categoryCache = {};
    
    for (const productType of uniqueTypes) {
      const parentName = TYPE_TO_PARENT[productType] || 'Collectibles & Loisirs';
      const parentId = parentCategories[parentName];

      if (!parentId) {
        console.log(`  ⚠️  Type "${productType}" → parent introuvable`);
        continue;
      }

      const slug = slugify(productType);
      const result = await client.query(
        `INSERT INTO categories (name, slug, parentId, level, description) 
         VALUES ($1, $2, $3, 1, $4) RETURNING id`,
        [productType, slug, parentId, `Produits ${productType}`]
      );

      const categoryId = result.rows[0].id;
      categoryCache[productType] = categoryId;
      console.log(`  ✓ ${parentName.padEnd(30)} > ${productType}`);
    }
    console.log();

    // 6. IMPORTER les produits
    console.log(`📦 Import de ${records.length} produits...\n`);
    let productsCreated = 0;
    let imagesCreated = 0;
    let variantsCreated = 0;
    let errors = 0;

    for (const record of records) {
      const productType = record.Type_Produit?.trim();
      const categoryId = categoryCache[productType];
      
      if (!categoryId) continue;

      try {
        const productSlug = record.Handle?.trim() || slugify(record.Nom);
        const price = parseFloat(record.Prix_Min_EUR) || 0;
        const originalPrice = parseFloat(record.Prix_Barre_EUR) || price;
        const rating = record.Avis_Note ? parseFloat(record.Avis_Note) : 0;
        const createdAt = parseDate(record.Date_Publication);

        const productResult = await client.query(
          `INSERT INTO products (name, slug, description, price, originalPrice, categoryId, groupId, rating, createdAt)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [record.Nom?.trim(), productSlug, record.Description_Complete?.trim() || record.Description_Courte?.trim() || '',
           price, originalPrice, categoryId, groupId, rating, createdAt]
        );
        const productId = productResult.rows[0].id;

        // Images
        const images = parseImages(record.Images_URLs);
        for (let i = 0; i < images.length; i++) {
          try {
            await client.query(
              `INSERT INTO product_images (productId, imageUrl, isMainImage, "order") VALUES ($1, $2, $3, $4)`,
              [productId, images[i], i === 0, i]
            );
            imagesCreated++;
          } catch (imgErr) {
            // Ignorer les erreurs d'images silencieusement
          }
        }

        // Variantes (couleurs et tailles)
        const variants = parseVariants(record.Variantes_Details);
        for (const color of variants.colors) {
          try {
            await client.query(
              `INSERT INTO product_colors (productId, colorName, stock) VALUES ($1, $2, $3)`,
              [productId, color, 0]
            );
            variantsCreated++;
          } catch (colorErr) {
            // Ignorer les erreurs de couleurs silencieusement
          }
        }
        for (const size of variants.sizes) {
          try {
            await client.query(
              `INSERT INTO product_sizes (productId, size, stock) VALUES ($1, $2, $3)`,
              [productId, size, 0]
            );
            variantsCreated++;
          } catch (sizeErr) {
            // Ignorer les erreurs de tailles silencieusement
          }
        }

        productsCreated++;
        if (productsCreated % 50 === 0) {
          console.log(`  [${Math.round((productsCreated / records.length) * 100)}%] ${productsCreated}/${records.length}`);
        }

      } catch (error) {
        errors++;
        // Continuer sans arrêter la boucle
      }
    }

    console.log(`\n✅ Import unifié terminé!\n`);
    console.log(`📊 Statistiques:`);
    console.log(`   - 3 catégories parents`);
    console.log(`   - ${uniqueTypes.length} catégories enfants (types de produit)`);
    console.log(`   - ${productsCreated} produits importés`);
    console.log(`   - ${imagesCreated} images assignées`);
    console.log(`   - ${variantsCreated} variantes créées`);
    if (errors > 0) console.log(`   - ${errors} erreurs gérées\n`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

importHuntrixUnified();
