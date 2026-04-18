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

// ============================================
// ⚙️ CONFIGURATION PAR DÉFAUT
// ============================================

const DEFAULT_STOCK = 10;  // Stock par défaut pour les produits ET variantes

// ============================================
// 🎯 STRUCTURE DES CATÉGORIES (3 parents + 6 enfants)
// ============================================

const CATEGORY_STRUCTURE = {
  'Vêtements & Style': {
    description: 'Tous les vêtements et accessoires de mode Huntrix',
    emoji: '👕',
    children: [
      {
        name: 'T-shirts & Débardeurs',
        description: 'T-shirts et débardeurs de collection',
        products: ['T-shirt', 'Débardeur']
      },
      {
        name: 'Sweats & Pulls',
        description: 'Sweats, pulls et tricots',
        products: ['Sweat', 'Pull']
      },
      {
        name: 'Vestes & Costumes',
        description: 'Vestes, costumes et vêtements d\'extérieur',
        products: ['Veste', 'Costume']
      },
      {
        name: 'Pyjamas & Ensembles',
        description: 'Pyjamas et ensembles complets',
        products: ['Pyjama', 'Ensemble']
      },
      {
        name: 'Chaussures & Chaussons',
        description: 'Chaussures et chaussons confortables',
        products: ['Chaussure', 'Chausson']
      },
      {
        name: 'Accessoires Mode',
        description: 'Bonnets, casquettes, bob, mitaines et chaussettes',
        products: ['Casquette', 'Bonnet', 'Bob', 'Mitaine', 'Chaussettes', 'Chaussette']
      }
    ]
  },
  'Accessoires & Lifestyle': {
    description: 'Accessoires, bijoux et articles du quotidien',
    emoji: '🎒',
    children: [
      {
        name: 'Sacs & Maroquinerie',
        description: 'Sacs à dos, sacs à main, totebags et portefeuilles',
        products: ['Sac à dos', 'Sac a dos', 'Sac à main', 'Trousse', 'Portefeuille', 'Totebag', 'Sac à repas']
      },
      {
        name: 'Bijoux & Accessoires',
        description: 'Bracelets, colliers, boucles d\'oreilles et montres',
        products: ['Bracelet', 'Collier', 'Montre', 'Boucles d\'oreilles', 'Bijoux']
      },
      {
        name: 'Mode & Protection',
        description: 'Lunettes, masques et accessoires cheveux',
        products: ['Lunettes', 'Lunette', 'Masque', 'Pinces cheveux', 'Pince à cheveux', 'Perruque']
      },
      {
        name: 'Objets du Quotidien',
        description: 'Mugs, gourdes, boîtes, coques et articles pratiques',
        products: ['Mug', 'Gourde', 'Boite à déjeuner', 'Boite à bijoux', 'Coque', 'Boîte', 'Porte-Clés']
      },
      {
        name: 'Bureau & Tech',
        description: 'Tapis de souris, équipements de bureau et accessoires tech',
        products: ['Tapis de souris', 'Bureau', 'Tech']
      },
      {
        name: 'Décoration',
        description: 'Lampes, couvertures et articles de décoration',
        products: ['Lampe', 'Couverture', 'Décoration']
      }
    ]
  },
  'Collectibles & Fun': {
    description: 'Collections, figurines et articles spécialisés',
    emoji: '🎤',
    children: [
      {
        name: 'Peluches',
        description: 'Peluches de collection',
        products: ['Peluche']
      },
      {
        name: 'Figurines',
        description: 'Figurines et statues de collection',
        products: ['Figurine']
      },
      {
        name: 'Photocards & Cartes',
        description: 'Photocards, cartes collectibles et trading cards',
        products: ['Photocards', 'Cartes']
      },
      {
        name: 'Lightsticks',
        description: 'Lightsticks et accessoires lumineux',
        products: ['Lightstick']
      },
      {
        name: 'Posters & Stickers',
        description: 'Posters, stickers et autocollants',
        products: ['Poster', 'Stickers', 'Autocollant']
      },
      {
        name: 'Box & Cosplay',
        description: 'Boxes édition spéciale, calendriers et accessoires cosplay',
        products: ['Box', 'Calendrier', 'Epée', 'Cosplay', 'Accessoires cosplay']
      }
    ]
  }
};

// ============================================
// 📦 PARSING DES DONNÉES
// ============================================

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

// ============================================
// 📝 FONCTION POUR FORMATTER LA DESCRIPTION EN MARKDOWN
// ============================================

const formatDescriptionAsMarkdown = (record) => {
  let markdown = '';
  
  // ── Titre principal ────────────────────────────────────────
  markdown += `# ${record.Nom?.trim() || 'Produit'}

`;
  
  // ── Description courte ─────────────────────────────────────
  const shortDesc = record.Description_Courte?.trim() || '';
  let displayShortDesc = '';
  
  if (shortDesc && shortDesc.toLowerCase() !== 'description' && shortDesc.length > 10) {
    displayShortDesc = shortDesc;
    markdown += `*${displayShortDesc}*

`;
  }
  
  // ── Traitement de la description complète ──────────────────
  if (record.Description_Complete?.trim()) {
    let fullDesc = record.Description_Complete.trim();
    
    // ── Extraire et nettoyer la description principale ────────
    const descMatch = fullDesc.match(/^(.*?)(?=Guide des tailles|Points clés|Pourquoi tu vas adorer|L'esprit|Détails|$)/is);
    if (descMatch && descMatch[1]) {
      let mainDesc = descMatch[1].trim();
      
      // Nettoyer: supprimer "Description\n" au début
      mainDesc = mainDesc.replace(/^Description\s*\n+/i, '').trim();
      
      // IMPORTANT: Supprimer le doublon (normaliser pour comparer)
      if (displayShortDesc) {
        const normalizedShortDesc = displayShortDesc.replace(/\s+/g, ' ').toLowerCase();
        const normalizedMainDesc = mainDesc.replace(/\s+/g, ' ').toLowerCase();
        
        if (normalizedMainDesc.startsWith(normalizedShortDesc)) {
          mainDesc = mainDesc.substring(displayShortDesc.length).trim();
        }
      }
      
      // Supprimer les espaces excessifs, garder les paragraphes
      mainDesc = mainDesc
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n\n');
    }
    
    // ── Points clés (bullets) ──────────────────────────────
    const bulletMatch = fullDesc.match(/Points clés\s*\n+(.*?)(?=Guide des tailles|L'esprit|Détails|$)/is);
    if (bulletMatch && bulletMatch[1]) {
      const bulletText = bulletMatch[1].trim();
      const bullets = bulletText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 5 && line.length < 150 && !line.startsWith('Taille') && !line.startsWith('Guide'))
        .slice(0, 10);
      
      if (bullets.length > 2) {
        markdown += `## Points clés

`;
        bullets.forEach(bullet => {
          markdown += `- ${bullet}
`;
        });
        markdown += `
`;
      }
    }
    
    // ── Guide des tailles (tableaux) ───────────────────────
    if (fullDesc.match(/Guide des tailles/i)) {
      const tableMarkdown = parseTableSection(fullDesc);
      if (tableMarkdown.trim()) {
        markdown += tableMarkdown;
      }
    }
    
    // ── L'esprit Huntrix ───────────────────────────────────
    const spiritMatch = fullDesc.match(/L'esprit\s+Huntrix[,:]?\s*(.*?)(?=Détails|Caractéristiques|$)/is);
    if (spiritMatch && spiritMatch[1]) {
      let spirit = spiritMatch[1].trim();
      spirit = spirit.replace(/\s+/g, ' ').slice(0, 300).trim();
      
      if (spirit.length > 20 && spirit.toLowerCase() !== 'huntrix') {
        markdown += `## L'esprit Huntrix

*${spirit}*

`;
      }
    }
  }
  
  // ── Type de produit ────────────────────────────────────────
  if (record.Type_Produit?.trim()) {
    markdown += `## Caractéristiques

`;
    markdown += `- **Type de produit**: ${record.Type_Produit.trim()}
`;
  }
  
  // ── Variantes (couleurs et tailles) ────────────────────────
  const variants = parseVariants(record.Variantes_Details);
  
  if (variants.colors.length > 0) {
    markdown += `- **Couleurs disponibles**: ${variants.colors.join(', ')}
`;
  }
  
  if (variants.sizes.length > 0) {
    markdown += `- **Tailles disponibles**: ${variants.sizes.join(', ')}
`;
  }
  
  if (variants.colors.length > 0 || variants.sizes.length > 0) {
    markdown += `
`;
  }
  
  // ── Avis (uniquement si rating > 0) ─────────────────────
  const rating = record.Avis_Note ? parseFloat(record.Avis_Note) : 0;
  if (rating > 0) {
    markdown += `## Avis

`;
    markdown += `- **Note**: ⭐ ${rating}/5
`;
    if (record.Avis_Nombre?.trim()) {
      markdown += `- **Nombre d'avis**: ${record.Avis_Nombre.trim()}
`;
    }
    markdown += `
`;
  }
  
  // Nettoyer les espaces excessifs à la fin
  return markdown.replace(/\n\n\n+/g, '\n\n').trim();
};

// ── Parseur pour tableaux (robuste) ────────────────────────
const parseTableSection = (fullText) => {
  const tableMatch = fullText.match(/Guide des tailles\s*(.*?)(?=L'esprit|Détails|Caractéristiques|Pourquoi|$)/is);
  if (!tableMatch || !tableMatch[1]) return '';
  
  let tableSection = tableMatch[1].trim();
  
  // Nettoyer les newlines multiples
  tableSection = tableSection.replace(/\n+/g, ' ').trim();
  
  // Si c'est une seule ligne, parser les patterns numériques
  if (!tableSection.includes('|')) {
    const rowPattern = /([A-Z0-9/]+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/g;
    const rows = [];
    let match;
    
    while ((match = rowPattern.exec(tableSection)) !== null) {
      rows.push([match[1], match[2], match[3], match[4], match[5]]);
    }
    
    if (rows.length > 0) {
      let result = `## Guide des tailles

`;
      let headers = ['Taille', 'Col 1', 'Col 2', 'Col 3', 'Col 4'];
      
      if (tableSection.match(/1\/2 Poitrine/i)) {
        headers = ['Taille', '1/2 Poitrine', 'Longueur', 'Manches'];
        rows.forEach(row => row.splice(4, 1));
      } else if (tableSection.match(/Épaules/i)) {
        headers = ['Taille', 'Épaules', 'Poitrine', 'Longueur', 'Manches'];
      }
      
      result += `| ${headers.join(' | ')} |
`;
      result += `| ${headers.map(() => '---').join(' | ')} |
`;
      
      rows.forEach(row => {
        result += `| ${row.slice(0, headers.length).join(' | ')} |
`;
      });
      
      result += `
`;
      return result;
    }
  }
  
  // Parser comme tableau avec pipes
  const lines = tableSection.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  if (lines.length < 2) return '';
  
  const headerLineIdx = lines.findIndex(l => l.toLowerCase().includes('taille'));
  if (headerLineIdx === -1) return '';
  
  const headerLine = lines[headerLineIdx];
  let headers = [];
  
  if (headerLine.includes('|')) {
    headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
  } else {
    headers = headerLine.split(/\s{2,}/).map(h => h.trim()).filter(h => h);
  }
  
  if (headers.length === 0) return '';
  
  let result = `## Guide des tailles

`;
  result += `| ${headers.join(' | ')} |
`;
  result += `| ${headers.map(() => '---').join(' | ')} |
`;
  
  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.match(/^[-=|\s]+$/) || line.length < 3) continue;
    
    let cells = [];
    if (line.includes('|')) {
      cells = line.split('|').map(c => c.trim()).filter(c => c);
    } else {
      cells = line.split(/\s{2,}/).map(c => c.trim()).filter(c => c);
    }
    
    if (cells.length >= headers.length * 0.75) {
      result += `| ${cells.slice(0, headers.length).join(' | ')} |
`;
    }
  }
  
  result += `
`;
  return result;
};

// ============================================
// 🔍 FONCTION POUR TROUVER LA CATÉGORIE ENFANT
// ============================================

const findChildCategory = (productType) => {
  for (const [parentName, parentData] of Object.entries(CATEGORY_STRUCTURE)) {
    for (const child of parentData.children) {
      if (child.products.some(p => p.toLowerCase() === productType.toLowerCase())) {
        return { parentName, childName: child.name };
      }
    }
  }
  // Fallback: si le type n'est pas trouvé, le placer dans Collectibles & Fun > Box & Cosplay
  return { parentName: 'Collectibles & Fun', childName: 'Box & Cosplay' };
};

// ============================================
// 🚀 IMPORT PRINCIPAL
// ============================================

async function importHuntrixUnified() {
  const client = await pool.connect();
  try {
    console.log('🚀 Import Huntrix - Structure complète avec stock par défaut\n');

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

    // 4. CRÉER les 3 catégories PARENT
    console.log('📁 Création des 3 catégories parents...');
    const parentCategories = {};
    let parentOrder = 0;

    for (const [parentName, parentData] of Object.entries(CATEGORY_STRUCTURE)) {
      const result = await client.query(
        `INSERT INTO categories (name, slug, level, "order", description, parentId) 
         VALUES ($1, $2, $3, $4, $5, NULL) RETURNING id`,
        [parentName, slugify(parentName), 0, parentOrder++, parentData.description]
      );
      parentCategories[parentName] = result.rows[0].id;
      console.log(`  ${parentData.emoji} ${parentName} (ID: ${parentCategories[parentName]})`);
    }
    console.log();

    // 5. CRÉER les 6 catégories ENFANTS
    console.log('🏷️  Création des 6 catégories enfants...\n');
    const childCategoryMap = {}; // { 'Parent > Child': categoryId }

    for (const [parentName, parentData] of Object.entries(CATEGORY_STRUCTURE)) {
      let childOrder = 0;
      console.log(`  ${parentData.emoji} ${parentName}`);

      for (const childData of parentData.children) {
        const result = await client.query(
          `INSERT INTO categories (name, slug, parentId, level, "order", description) 
           VALUES ($1, $2, $3, 1, $4, $5) RETURNING id`,
          [childData.name, slugify(childData.name), parentCategories[parentName], childOrder++, childData.description]
        );

        const categoryId = result.rows[0].id;
        const key = `${parentName} > ${childData.name}`;
        childCategoryMap[key] = categoryId;
        console.log(`    └─ ${childData.name} (ID: ${categoryId})`);
      }
      console.log();
    }

    // 6. CRÉER UN MAPPING TYPE_PRODUIT -> CATEGORY_ID
    console.log('🔗 Construction du mapping produits → catégories...\n');
    const productTypeToCategoryId = {};

    for (const [parentName, parentData] of Object.entries(CATEGORY_STRUCTURE)) {
      for (const childData of parentData.children) {
        const key = `${parentName} > ${childData.name}`;
        const categoryId = childCategoryMap[key];

        for (const productType of childData.products) {
          productTypeToCategoryId[productType.toLowerCase()] = categoryId;
        }
      }
    }

    // 7. IMPORTER les produits
    console.log(`📦 Import de ${records.length} produits (stock: ${DEFAULT_STOCK})...\n`);
    let productsCreated = 0;
    let imagesCreated = 0;
    let variantsCreated = 0;
    let errors = 0;
    let unmappedTypes = new Set();

    for (const record of records) {
      const productType = record.Type_Produit?.trim();
      const categoryId = productTypeToCategoryId[productType?.toLowerCase()];

      if (!categoryId) {
        unmappedTypes.add(productType);
        continue;
      }

      try {
        const productSlug = record.Handle?.trim() || slugify(record.Nom);
        const price = parseFloat(record.Prix_Min_EUR) || 0;
        const originalPrice = parseFloat(record.Prix_Barre_EUR) || price;
        const rating = record.Avis_Note ? parseFloat(record.Avis_Note) : 0;
        const createdAt = parseDate(record.Date_Publication);

        const description = formatDescriptionAsMarkdown(record);
        
        // ✅ CORRIGÉ: Ajouter DEFAULT_STOCK au produit lui-même
        const productResult = await client.query(
          `INSERT INTO products (name, slug, description, price, originalPrice, categoryId, groupId, rating, stock, createdAt)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            record.Nom?.trim(),
            productSlug,
            description,
            price,
            originalPrice,
            categoryId,
            groupId,
            rating,
            DEFAULT_STOCK,  // ✅ Stock par défaut pour le produit
            createdAt
          ]
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

        // Variantes (couleurs et tailles) - Stock par défaut: 10
        const variants = parseVariants(record.Variantes_Details);
        
        for (const color of variants.colors) {
          try {
            await client.query(
              `INSERT INTO product_colors (productId, colorName, stock) VALUES ($1, $2, $3)`,
              [productId, color, DEFAULT_STOCK]  // ✅ Stock par défaut pour couleur
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
              [productId, size, DEFAULT_STOCK]  // ✅ Stock par défaut pour taille
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
      }
    }

    console.log(`\n✅ Import unifié terminé!\n`);
    console.log(`📊 Statistiques:`);
    console.log(`   - 3 catégories parents`);
    console.log(`   - 6 catégories enfants`);
    console.log(`   - ${productsCreated} produits importés (stock: ${DEFAULT_STOCK} chacun)`);
    console.log(`   - ${imagesCreated} images assignées`);
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

importHuntrixUnified();