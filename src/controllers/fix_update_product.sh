#!/bin/bash

# Créer une sauvegarde
cp productController.js productController.js.backup.$(date +%s)

# Utiliser perl pour faire la modification (plus flexible que sed sur macOS)
perl -i -pe '
  if (/const completeProduct = await pool\.query\(`/) {
    $_ .= "      SELECT p.*, \n";
    $_ .= "             c.name as categoryName,\n";
    $_  = '';  # Ne pas dupliquer la ligne originale
    <>;  # Sauter la ligne SELECT p.*
  }
  s/^\s+SELECT p\.\*,\s*$/      SELECT p.*, \n             c.name as categoryName,/;
' productController.js

echo "✅ Modifications appliquées"
echo ""
echo "Vérification de la modification:"
sed -n '285,293p' productController.js

