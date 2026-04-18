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

const reviews = [
  {
    author: "Sophie Martin",
    rating: 5,
    date: "2026-03-15",
    title: "T-shirt BLACKPINK parfait !",
    content: "J'ai commandé le t-shirt BLACKPINK Pink edition et c'est absolument magnifique ! Le design est identique aux photos, la qualité du tissu est excellente et le rendu des couleurs est impeccable. Je suis très impressionnée !",
    product: "T-shirt BLACKPINK"
  },
  {
    author: "Lucas Dubois",
    rating: 4,
    date: "2026-03-14",
    title: "Photocard BTS bien reçue",
    content: "J'ai reçu le set de 10 photocards BTS Dynamite. Elles sont en super état, pas de plis ni rayures. Un petit bémol sur le packaging qui aurait pu être mieux protégé, mais les cartes sont parfaites !",
    product: "Photocards BTS Dynamite"
  },
  {
    author: "Marie Chen",
    rating: 5,
    date: "2026-03-13",
    title: "Lightstick TWICE incroyable !",
    content: "Le lightstick TWICE officiel que j'ai commandé est fabuleux ! Les couleurs changent parfaitement, la batterie tient longtemps, et le design est exactement comme en concert. Mes amis fans l'adorent aussi !",
    product: "Lightstick TWICE"
  },
  {
    author: "Thomas Moreau",
    rating: 4,
    date: "2026-03-12",
    title: "Poster STRAY KIDS correct",
    content: "Les posters STRAY KIDS que j'ai commandés sont de bonne qualité. L'impression est nette et claire. Juste un petit souci avec le tube de livraison qui était légèrement endommagé, mais les posters vont bien.",
    product: "Posters STRAY KIDS"
  },
  {
    author: "Amélie Rousseau",
    rating: 5,
    date: "2026-03-11",
    title: "Coque téléphone NewJeans super !",
    content: "J'ai acheté la coque NewJeans pour mon iPhone et elle est arrivée très vite ! La protection est excellente, le design ne s'efface pas et c'est vraiment stylé. Je recommande absolument !",
    product: "Coque NewJeans"
  },
  {
    author: "Nicolas Lefevre",
    rating: 5,
    date: "2026-03-10",
    title: "Album SEVENTEEN collector's edition",
    content: "Collector's edition de SEVENTEEN Seventeen Album - tout y est ! Les photocards bonus, le livret haute qualité, le poster, et le design de boîte est magnifique. Un vrai bijou pour la collection !",
    product: "Album SEVENTEEN"
  },
  {
    author: "Jade Kim",
    rating: 5,
    date: "2026-03-09",
    title: "Figurines K-beauty collector pack",
    content: "J'ai commandé le pack complet de 6 figurines des idoles K-beauty et elles sont incroyables ! Le détail des visages est parfait, les poses sont dynamiques. Les boîtes d'emballage collectionneurs sont très belles !",
    product: "Figurines K-beauty"
  },
  {
    author: "Alexandra Martin",
    rating: 5,
    date: "2026-03-08",
    title: "Itzy Box merchandising",
    content: "La box merchandising ITZY complète avec cartes postales et cartes spéciales est arrivée. Tout est de super qualité, les cartes ont des finitions brillantes. Très content de cet achat pour ma collection !",
    product: "Box ITZY"
  },
  {
    author: "Clara Fontaine",
    rating: 4,
    date: "2026-03-07",
    title: "ITZY Set complet parfait",
    content: "L'ensemble ITZY que j'ai commandé avec cartes et sacs est arrivé en parfait état ! La qualité du packaging est exceptionnelle et tous les articles sont comme décrits. Je recommande vivement ce set !",
    product: "Set ITZY complet"
  },
  {
    author: "Raphaël Dupont",
    rating: 5,
    date: "2026-03-06",
    title: "Ensemble BTS Album + Cartes",
    content: "J'ai acheté l'ensemble BTS avec album CD et cartes photocards premium et c'est simplement parfait ! La qualité audio du CD est excellente et les cartes sont magnifiquement imprimées. Mes copains fans l'adorent !",
    product: "Ensemble BTS Album"
  }
];

async function seedReviews() {
  const client = await pool.connect();
  try {
    console.log('🌱 Insertion des avis personnalisés...\n');

    let reviewsAdded = 0;
    let reviewsSkipped = 0;

    for (const review of reviews) {
      try {
        // Chercher le produit par nom
        const productResult = await client.query(
          'SELECT id FROM products WHERE name ILIKE $1 LIMIT 1',
          [`%${review.product}%`]
        );

        if (productResult.rows.length === 0) {
          console.log(`⚠️  Produit "${review.product}" non trouvé - avis ignoré`);
          reviewsSkipped++;
          continue;
        }

        const productId = productResult.rows[0].id;
        const email = `${review.author.toLowerCase().replace(/\s+/g, '.')}@email.com`;

        // Insérer l'avis
        await client.query(
          `INSERT INTO reviews (productid, rating, title, content, author, email, verified, helpful, createdat, updatedat)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            productId,
            review.rating,
            review.title,
            review.content,
            review.author,
            email,
            true,
            Math.floor(Math.random() * 45),
            new Date(review.date),
            new Date(review.date)
          ]
        );
        
        reviewsAdded++;
        console.log(`✅ Avis de ${review.author} ajouté pour "${review.product}"`);
      } catch (err) {
        console.error(`❌ Erreur pour ${review.author}:`, err.message);
        reviewsSkipped++;
      }
    }

    console.log(`\n📊 Résumé:`);
    console.log(`   - Avis ajoutés: ${reviewsAdded}`);
    console.log(`   - Avis ignorés: ${reviewsSkipped}`);
    console.log(`   - Total: ${reviews.length}`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedReviews();
