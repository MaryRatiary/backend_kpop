import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

const DEFAULT_REVIEWS = [
  {
    rating: 5,
    title: "Excellent produit !",
    content: "Très satisfait de mon achat. La qualité est exceptionnelle et la livraison était rapide. Je recommande vivement !",
    author: "Marie D."
  },
  {
    rating: 4,
    title: "Très bon rapport qualité-prix",
    content: "Produit de très bonne qualité. Correspond parfaitement à ma description. Livraison rapide et bien emballé.",
    author: "Jean P."
  },
  {
    rating: 5,
    title: "Très recommandé",
    content: "Je suis ravi de cet achat ! Les détails sont parfaits et le produit arrive en excellent état. Merci !",
    author: "Sophie M."
  },
  {
    rating: 4,
    title: "Satisfait",
    content: "Bon produit, livraison rapide. Conforme à mes attentes. Je suis content de mon achat.",
    author: "Thomas L."
  },
  {
    rating: 5,
    title: "Excellent !",
    content: "Produit magnifique, très bien fait. Je l'adore ! Merci pour la qualité et le service.",
    author: "Isabelle K."
  },
  {
    rating: 4,
    title: "Bon achat",
    content: "Très satisfait. Le produit est de qualité et bien livré. À recommander.",
    author: "Marc R."
  },
  {
    rating: 5,
    title: "Parfait !",
    content: "Exactement ce que je cherchais. Superbe qualité et service au top. Merci beaucoup !",
    author: "Nathalie B."
  },
  {
    rating: 4,
    title: "Vraiment super",
    content: "Très content de cet achat. Produit de qualité, emballage soigné. Merci !",
    author: "Paul D."
  }
];

async function seedReviews() {
  const client = await pool.connect();
  try {
    console.log('🌱 Ajout des avis par défaut à tous les produits...\n');

    // Récupérer tous les produits
    const productsResult = await client.query('SELECT id FROM products');
    const products = productsResult.rows;
    
    console.log(`📊 ${products.length} produits trouvés\n`);

    let reviewsAdded = 0;

    // Pour chaque produit, ajouter 3-5 avis aléatoires
    for (const product of products) {
      const numReviews = Math.floor(Math.random() * 3) + 3; // 3-5 avis par produit
      
      for (let i = 0; i < numReviews; i++) {
        const review = DEFAULT_REVIEWS[Math.floor(Math.random() * DEFAULT_REVIEWS.length)];
        
        // Ajouter une petite variation à la date (entre -60 et -1 jours)
        const daysAgo = Math.floor(Math.random() * 60) + 1;
        const createdDate = new Date();
        createdDate.setDate(createdDate.getDate() - daysAgo);

        try {
          const email = `${review.author.toLowerCase().replace(/\s+/g, '.')}${Math.floor(Math.random() * 1000)}@email.com`;
          await client.query(
            `INSERT INTO reviews (productid, rating, title, content, author, email, verified, helpful, createdat, updatedat)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              product.id,
              review.rating,
              review.title,
              review.content,
              review.author,
              email,
              true, // verified
              Math.floor(Math.random() * 20), // random helpful count 0-20
              createdDate,
              createdDate
            ]
          );
          reviewsAdded++;
        } catch (err) {
          console.error(`  ❌ Erreur pour produit ${product.id}:`, err.message);
        }
      }
    }

    console.log(`✅ ${reviewsAdded} avis ajoutés avec succès !\n`);
    console.log('📈 Statistiques :');
    console.log(`   - Total produits: ${products.length}`);
    console.log(`   - Total avis créés: ${reviewsAdded}`);
    console.log(`   - Moyenne avis/produit: ${(reviewsAdded / products.length).toFixed(1)}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedReviews();
