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

const DEFAULT_STOCK = 10;

const CATEGORY_STRUCTURE = {
  'Vêtements & Style': {
    description: 'Tous les vêtements et accessoires de mode Huntrix',
    emoji: '👕',
    children: [
      { name: 'T-shirts & Débardeurs', description: 'T-shirts et débardeurs de collection', products: ['T-shirt', 'Débardeur'] },
      { name: 'Sweats & Pulls', description: 'Sweats, pulls et tricots', products: ['Sweat', 'Pull'] },
      { name: 'Vestes & Costumes', description: 'Vestes, costumes et vêtements d\'extérieur', products: ['Veste', 'Costume'] },
      { name: 'Pyjamas & Ensembles', description: 'Pyjamas et ensembles complets', products: ['Pyjama', 'Ensemble'] },
      { name: 'Chaussures & Chaussons', description: 'Chaussures et chaussons confortables', products: ['Chaussure', 'Chausson'] },
      { name: 'Accessoires Mode', description: 'Bonnets, casquettes, bob, mitaines et chaussettes', products: ['Casquette', 'Bonnet', 'Bob', 'Mitaine', 'Chaussettes', 'Chaussette'] }
    ]
  },
  'Accessoires & Lifestyle': {
    description: 'Accessoires, bijoux et articles du quotidien',
    emoji: '🎒',
    children: [
      { name: 'Sacs & Maroquinerie', description: 'Sacs à dos, sacs à main, totebags et portefeuilles', products: ['Sac à dos', 'Sac a dos', 'Sac à main', 'Trousse', 'Portefeuille', 'Totebag', 'Sac à repas'] },
      { name: 'Bijoux & Accessoires', description: 'Bracelets, colliers, boucles d\'oreilles et montres', products: ['Bracelet', 'Collier', 'Montre', 'Boucles d\'oreilles', 'Bijoux'] },
      { name: 'Mode & Protection', description: 'Lunettes, masques et accessoires cheveux', products: ['Lunettes', 'Lunette', 'Masque', 'Pinces cheveux', 'Pince à cheveux', 'Perruque'] },
      { name: 'Objets du Quotidien', description: 'Mugs, gourdes, boîtes, coques et articles pratiques', products: ['Mug', 'Gourde', 'Boite à déjeuner', 'Boite à bijoux', 'Coque', 'Boîte', 'Porte-Clés'] },
      { name: 'Bureau & Tech', description: 'Tapis de souris, équipements de bureau et accessoires tech', products: ['Tapis de souris', 'Bureau', 'Tech'] },
      { name: 'Décoration', description: 'Lampes, couvertures et articles de décoration', products: ['Lampe', 'Couverture', 'Décoration'] }
    ]
  },
  'Collectibles & Fun': {
    description: 'Collections, figurines et articles spécialisés',
    emoji: '🎤',
    children: [
      { name: 'Peluches', description: 'Peluches de collection', products: ['Peluche'] },
      { name: 'Figurines', description: 'Figurines et statues de collection', products: ['Figurine'] },
      { name: 'Photocards & Cartes', description: 'Photocards, cartes collectibles et trading cards', products: ['Photocards', 'Cartes'] },
      { name: 'Lightsticks', description: 'Lightsticks et accessoires lumineux', products: ['Lightstick'] },
      { name: 'Posters & Stickers', description: 'Posters, stickers et autocollants', products: ['Poster', 'Stickers', 'Autocollant'] },
      { name: 'Box & Cosplay', description: 'Boxes édition spéciale, calendriers et accessoires cosplay', products: ['Box', 'Calendrier', 'Epée', 'Cosplay', 'Accessoires cosplay'] }
    ]
  }
};

const parseImages = (image_urls) => {
  if (!image_urls) return [];
  return image_urls.split('|').map(url => url.trim()).filter(url => url && url.startsWith('http'));
};

const parseDate = (dateStr) => {
  if (!dateStr || dateStr === '') return new Date();
  try { return new Date(dateStr); } catch { return new Date(); }
};

const formatDescriptionAsMarkdown = (record) => {
  let markdown = `# ${record.Nom?.trim() || 'Produit'}\n\n`;
  
  const shortDesc = record.Description_Courte?.trim() || '';
  if (shortDesc && shortDesc.toLowerCase() !== 'description' && shortDesc.length > 10) {
    markdown += `*${shortDesc}*\n\n`;
  }
  
  if (record.Description_Complete?.trim()) {
    let fullDesc = record.Description_Complete.trim();
    const descMatch = fullDesc.match(/^(.*?)(?=Guide des tailles|Points clés|Pourquoi tu vas adorer|L'esprit|Détails|$)/is);
    if (descMatch && descMatch[1]) {
      let mainDesc = descMatch[1].trim().replace(/^Description\s*\n+/i, '').trim();
      mainDesc = mainDesc.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n\n');
      if (mainDesc.length > 20) markdown += `${mainDesc}\n\n`;
    }
  }
  
  if (record.Type_Produit?.trim()) {
    markdown += `## Caractéristiques\n\n- **Type de produit**: ${record.Type_Produit.trim()}\n\n`;
  }
  
  return markdown.replace(/\n\n\n+/g, '\n\n').trim();
};

async function importHuntrixVariantes() {
  const client = await pool.connect();
  try {
    console.log('🚀 Import Huntrix - CSV structuré avec variantes et images\n');

    // 1. Suppression des données
    console.log('🗑️  Suppression des données existantes...');
    await client.query('DELETE FROM order_items');
    await client.query('DELETE FROM product_colors');
    await client.query('DELETE FROM product_sizes');
    await client.query('DELETE FROM product_images');
    await client.query('DELETE FROM reviews');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM categories WHERE parent_id IS NOT NULL');
    await client.query('DELETE FROM categories WHERE parent_id IS NULL');
    await client.query('DELETE FROM kpop_groups');
    console.log('✓ Données supprimées\n');

    // 2. Créer le groupe Huntrix
    const groupResult = await client.query(
      `INSERT INTO kpop_groups (name, slug, description) VALUES ($1, $2, $3) RETURNING id`,
      ['Huntrix', 'huntrix', 'Collection officielle Huntrix - Demon Hunters']
    );
    const group_id = groupResult.rows[0].id;
    console.log(`✓ Groupe Huntrix créé (ID: ${group_id})\n`);

    // 3. Lire le CSV structuré avec variantes
    console.log('📖 Lecture du CSV structuré avec variantes...');
    const csvPath = path.join(__dirname, '..', 'produits_huntrix_variantes_structure.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true, skip_empty_lines: true, relax_quotes: true, escape: '"'
    });
    console.log(`✓ ${records.length} lignes variantes trouvées\n`);

    // 4. Grouper les variantes par produit (Handle)
    console.log('📊 Regroupement des variantes par produit...');
    const productsByHandle = {};
    
    for (const record of records) {
      const handle = record.Handle?.trim();
      if (!handle) continue;
      
      if (!productsByHandle[handle]) {
        productsByHandle[handle] = {
          product: record,
          variantes: []
        };
      }
      productsByHandle[handle].variantes.push(record);
    }
    
    const totalProducts = Object.keys(productsByHandle).length;
    console.log(`✓ ${totalProducts} produits uniques trouvés\n`);

    // 5. Créer les 3 catégories parents
    console.log('📁 Création des 3 catégories parents...');
    const parentCategories = {};
    let parentOrder = 0;

    for (const [parentName, parentData] of Object.entries(CATEGORY_STRUCTURE)) {
      const result = await client.query(
        `INSERT INTO categories (name, slug, level, "order", description, parent_id) 
         VALUES ($1, $2, $3, $4, $5, NULL) RETURNING id`,
        [parentName, slugify(parentName), 0, parentOrder++, parentData.description]
      );
      parentCategories[parentName] = result.rows[0].id;
      console.log(`  ${parentData.emoji} ${parentName} (ID: ${parentCategories[parentName]})`);
    }
    console.log();

    // 6. Créer les 6 catégories enfants
    console.log('🏷️  Création des 6 catégories enfants...\n');
    const childCategoryMap = {};

    for (const [parentName, parentData] of Object.entries(CATEGORY_STRUCTURE)) {
      let childOrder = 0;
      console.log(`  ${parentData.emoji} ${parentName}`);

      for (const childData of parentData.children) {
        const result = await client.query(
          `INSERT INTO categories (name, slug, parent_id, level, "order", description) 
           VALUES ($1, $2, $3, 1, $4, $5) RETURNING id`,
          [childData.name, slugify(childData.name), parentCategories[parentName], childOrder++, childData.description]
        );

        const category_id = result.rows[0].id;
        const key = `${parentName} > ${childData.name}`;
        childCategoryMap[key] = category_id;
        console.log(`    └─ ${childData.name} (ID: ${category_id})`);
      }
      console.log();
    }

    // 7. Créer le mapping type_produit -> category_id
    console.log('🔗 Construction du mapping produits → catégories...\n');
    const productTypeToCategoryId = {};

    for (const [parentName, parentData] of Object.entries(CATEGORY_STRUCTURE)) {
      for (const childData of parentData.children) {
        const key = `${parentName} > ${childData.name}`;
        const category_id = childCategoryMap[key];

        for (const productType of childData.products) {
          productTypeToCategoryId[productType.toLowerCase()] = category_id;
        }
      }
    }

    // 8. Importer les produits et variantes
    console.log(`📦 Import de ${totalProducts} produits avec variantes (stock: ${DEFAULT_STOCK})...\n`);
    let productsCreated = 0;
    let imagesCreated = 0;
    let variantsCreated = 0;
    let errors = 0;
    let unmappedTypes = new Set();

    const productHandles = Object.keys(productsByHandle);

    for (let idx = 0; idx < productHandles.length; idx++) {
      const handle = productHandles[idx];
      const productData = productsByHandle[handle];
      const firstRecord = productData.product;

      const productType = firstRecord.Type_Produit?.trim();
      const category_id = productTypeToCategoryId[productType?.toLowerCase()];

      if (!category_id) {
        unmappedTypes.add(productType);
        continue;
      }

      try {
        const productSlug = firstRecord.Handle?.trim() || slugify(firstRecord.Nom);
        const price = parseFloat(firstRecord.Prix_Min_EUR) || 0;
        const original_price = parseFloat(firstRecord.Prix_Barre_EUR) || price;
        const rating = firstRecord.Avis_Note ? parseFloat(firstRecord.Avis_Note) : 0;
        const created_at = parseDate(firstRecord.Date_Publication);

        const description = formatDescriptionAsMarkdown(firstRecord);
        
        // Créer le produit
        const productResult = await client.query(
          `INSERT INTO products (name, slug, description, price, original_price, category_id, group_id, rating, stock, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            firstRecord.Nom?.trim(),
            productSlug,
            description,
            price,
            original_price,
            category_id,
            group_id,
            rating,
            DEFAULT_STOCK,
            created_at
          ]
        );
        const product_id = productResult.rows[0].id;

        // Images principales du produit
        const images = parseImages(firstRecord.Images_URLs);
        for (let i = 0; i < images.length; i++) {
          try {
            await client.query(
              `INSERT INTO product_images (product_id, image_url, is_main_image, "order") VALUES ($1, $2, $3, $4)`,
              [product_id, images[i], i === 0, i]
            );
            imagesCreated++;
          } catch (imgErr) {
            // Ignorer silencieusement
          }
        }

        // Traiter les variantes avec leurs images
        const variantesByTitle = {};
        
        for (const varRecord of productData.variantes) {
          const varTitle = varRecord.Variante_Titre?.trim();
          if (!varTitle) continue;

          if (!variantesByTitle[varTitle]) {
            variantesByTitle[varTitle] = {
              title: varTitle,
              details: varRecord.Variante_Details?.trim() || varTitle,
              imagePrincipale: varRecord.Variante_Image_Principale?.trim(),
              imageThumbnail: varRecord.Variante_Image_Thumbnail?.trim(),
              records: []
            };
          }
          variantesByTitle[varTitle].records.push(varRecord);
        }

        // Créer les variantes avec images
        for (const varTitle of Object.keys(variantesByTitle)) {
          const varData = variantesByTitle[varTitle];
          
          // Déterminer si c'est une couleur ou une taille
          const isColor = /couleur|color|bleu|blanc|noir|rouge|rose|violet|jaune|vert|gris|marron|orange/i.test(varData.details);
          const isSize = /taille|size|s|m|l|xl|xxl|cm|ans|\d+/.test(varData.details);
          
          try {
            if (isColor && !isSize) {
              await client.query(
                `INSERT INTO product_colors (product_id, color_name, stock) VALUES ($1, $2, $3)`,
                [product_id, varData.title, DEFAULT_STOCK]
              );
            } else if (isSize) {
              await client.query(
                `INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, $2, $3)`,
                [product_id, varData.title, DEFAULT_STOCK]
              );
            }
            
            // Ajouter l'image de variante si disponible
            if (varData.imagePrincipale) {
              try {
                await client.query(
                  `INSERT INTO product_images (product_id, image_url, is_main_image, "order") VALUES ($1, $2, $3, $4)`,
                  [product_id, varData.imagePrincipale, false, images.length + variantsCreated]
                );
                imagesCreated++;
              } catch (varImgErr) {
                // Ignorer silencieusement
              }
            }
            
            variantsCreated++;
          } catch (varErr) {
            // Ignorer silencieusement
          }
        }

        productsCreated++;
        if (productsCreated % 10 === 0) {
          console.log(`  [${Math.round((productsCreated / totalProducts) * 100)}%] ${productsCreated}/${totalProducts}`);
        }

      } catch (error) {
        errors++;
      }
    }

    console.log(`\n✅ Import structuré terminé!\n`);
    console.log(`📊 Statistiques:`);
    console.log(`   - 3 catégories parents`);
    console.log(`   - 6 catégories enfants`);
    console.log(`   - ${productsCreated} produits importés (stock: ${DEFAULT_STOCK} chacun)`);
    console.log(`   - ${imagesCreated} images assignées (produit + variante)`);
    console.log(`   - ${variantsCreated} variantes créées (stock: ${DEFAULT_STOCK} chacun)`);
    if (errors > 0) console.log(`   - ${errors} erreurs gérées`);
    if (unmappedTypes.size > 0) {
      console.log(`\n⚠️  Types de produits non mappés (${unmappedTypes.size}):`);
      [...unmappedTypes].slice(0, 10).forEach(type => console.log(`   - ${type}`));
      if (unmappedTypes.size > 10) console.log(`   ... et ${unmappedTypes.size - 10} autres`);
    }
    console.log();

  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

importHuntrixVariantes();
