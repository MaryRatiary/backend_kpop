/**
 * Utilitaire pour formater les données des produits
 * Nettoie et parse les données JSON imbriquées
 */

export const formatProductData = (product) => {
  if (!product) return null;

  // Parser les images si c'est un string
  if (product.images && typeof product.images === 'string') {
    try {
      product.images = JSON.parse(product.images);
    } catch (e) {
      product.images = [];
    }
  }
  if (!Array.isArray(product.images)) {
    product.images = product.images ? [product.images] : [];
  }

  // Parser et nettoyer les sizes
  if (product.sizes && Array.isArray(product.sizes)) {
    product.sizes = product.sizes.map(size => {
      // Si size.size est un string JSON, le parser
      if (size.size && typeof size.size === 'string') {
        try {
          const parsed = JSON.parse(size.size);
          return {
            id: size.id,
            productid: size.productid,
            size: parsed.size || parsed,
            stock: parsed.stock || size.stock || 0,
            createdAt: size.createdat || size.createdAt,
            updatedAt: size.updatedat || size.updatedAt
          };
        } catch (e) {
          return {
            id: size.id,
            productid: size.productid,
            size: size.size,
            stock: size.stock || 0,
            createdAt: size.createdat || size.createdAt,
            updatedAt: size.updatedat || size.updatedAt
          };
        }
      }
      return size;
    });
  }
  if (!Array.isArray(product.sizes)) {
    product.sizes = [];
  }

  // Parser et nettoyer les colors
  if (product.colors && Array.isArray(product.colors)) {
    product.colors = product.colors.map(color => ({
      id: color.id,
      productid: color.productid,
      colorName: color.colorname || color.colorName,
      colorHex: color.colorhex || color.colorHex,
      stock: color.stock || 0,
      createdAt: color.createdat || color.createdAt,
      updatedAt: color.updatedat || color.updatedAt
    }));
  }
  if (!Array.isArray(product.colors)) {
    product.colors = [];
  }

  // Normaliser les noms de colonnes (PostgreSQL retourne en minuscules)
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: parseFloat(product.price),
    originalPrice: product.originalprice ? parseFloat(product.originalprice) : null,
    categoryId: product.categoryid,
    categoryName: product.categoryname,
    groupId: product.groupid,
    groupName: product.groupname,
    stock: product.stock || 0,
    featured: product.featured || false,
    sales: product.sales || 0,
    image: product.image,
    hoverImage: product.hoverimage,
    images: product.images || [],
    sizes: product.sizes || [],
    colors: product.colors || [],
    reviews: product.reviews || [],
    createdAt: product.createdat || product.createdAt,
    updatedAt: product.updatedat || product.updatedAt
  };
};

export const formatProductsArray = (products) => {
  if (!Array.isArray(products)) return [];
  return products.map(formatProductData);
};
