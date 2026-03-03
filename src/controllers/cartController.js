import pool from '../config/database.js';

// Ajouter un produit au panier
export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId, quantity, size, color } = req.body;

    // Vérifier que le produit existe
    const product = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Vérifier le stock
    if (product.rows[0].stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Ajouter/mettre à jour le panier (utiliser une table temporaire ou session)
    // Pour simplifier, on retourne une structure de panier
    res.json({
      message: 'Product added to cart',
      cartItem: {
        productId,
        quantity,
        size,
        color,
        price: product.rows[0].price,
        name: product.rows[0].name
      }
    });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({ error: 'Failed to add to cart' });
  }
};

// Obtenir le panier de l'utilisateur
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Retourner le panier (stocké localement côté client pour MVP)
    res.json({
      message: 'Cart retrieved',
      userId,
      items: []
    });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({ error: 'Failed to get cart' });
  }
};

// Supprimer un produit du panier
export const removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    
    res.json({ message: 'Product removed from cart', productId });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({ error: 'Failed to remove from cart' });
  }
};

// Vider le panier
export const clearCart = async (req, res) => {
  try {
    res.json({ message: 'Cart cleared' });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
};
