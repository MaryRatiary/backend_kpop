#!/bin/bash

# Créer une sauvegarde
cp productController.js productController.js.backup

# Utiliser sed pour modifier la fonction updateProduct
# Ajouter categoryId dans la destructuration
sed -i '' '169s/const { /const { categoryId, /' productController.js

# Vérifier si la modification a été faite
echo "✅ Modification appliquée"
echo "Vérification..."
grep -A 10 "export const updateProduct" productController.js | head -15
