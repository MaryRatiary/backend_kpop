/**
 * 📝 Data Formatter - Convertir les noms de colonnes en snake_case pour le frontend
 */

// ✅ Formater un produit individuel
export const formatProductData = (product) => {
  if (!product) return null;

  return {
    // Identifiants et slugs
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,

    // Prix - ✅ IMPORTANT: Convertir en nombres!
    price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
    original_price: typeof product.original_price === 'string' ? parseFloat(product.original_price) : product.original_price,

    // Images - Retourner TOUS les formats possibles
    image: product.image || product.imageUrl || null,
    hover_image: product.hover_image || product.hoverImage || product.hoverimageg || null,
    images: product.images || [],

    // Catégories - IMPORTANT: Mapper categoryName vers category_name
    category_id: product.category_id,
    category_name: product.categoryName || product.category_name || null,
    group_id: product.group_id,
    group_name: product.groupName || product.group_name || null,

    // Stock et variantes
    stock: product.stock || 0,
    sizes: product.sizes || [],
    colors: product.colors || [],

    // État du produit
    featured: product.featured || false,
    rating: typeof product.rating === 'string' ? parseFloat(product.rating) : (product.rating || 0),
    sales: product.sales || 0,

    // Timestamps
    created_at: product.created_at || product.createdAt,
    updated_at: product.updated_at || product.updatedAt,

    // Avis
    reviews: product.reviews || []
  };
};

// ✅ Formater un tableau de produits
export const formatProductsArray = (products) => {
  if (!Array.isArray(products)) return [];
  return products.map(product => formatProductData(product));
};

// ✅ Formater une catégorie individuelle
export const formatCategoryData = (category) => {
  if (!category) return null;

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    image: category.image,
    parent_id: category.parent_id || category.parentid || null,
    level: category.level || 0,
    order: category.order || 0,
    product_count: category.product_count || category.productCount || 0,
    child_category_count: category.child_category_count || category.childCategoryCount || 0,
    created_at: category.created_at || category.createdAt,
    updated_at: category.updated_at || category.updatedAt,
    children: category.children || []
  };
};

// ✅ Formater un tableau de catégories
export const formatCategoriesArray = (categories) => {
  if (!Array.isArray(categories)) return [];
  return categories.map(category => formatCategoryData(category));
};
