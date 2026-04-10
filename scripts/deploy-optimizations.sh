#!/bin/bash

# ✅ SCRIPT DE DÉPLOIEMENT DES OPTIMISATIONS EN PRODUCTION
# Usage: bash deploy-optimizations.sh

set -e

echo "🚀 DÉPLOIEMENT DES OPTIMISATIONS"
echo "=================================="

# 1. Installer les dépendances manquantes
echo "📦 Étape 1: Installation des dépendances..."
cd /Users/RatiaryMario/Desktop/site\ sinoa/backend
npm install express-rate-limit compression --save

# 2. Sauvegarder les fichiers originaux
echo "💾 Étape 2: Sauvegarde des fichiers originaux..."
cp src/config/database.js src/config/database.js.backup
cp src/server.js src/server.js.backup
cp src/controllers/productController.js src/controllers/productController.js.backup

# 3. Remplacer par les versions optimisées
echo "🔄 Étape 3: Déploiement des fichiers optimisés..."
cp src/config/database-optimized.js src/config/database.js
cp src/server-optimized.js src/server.js
cp src/controllers/productController-optimized.js src/controllers/productController.js

# 4. Appliquer les indexes SQL
echo "🗄️  Étape 4: Création des indexes de performance..."
# Vous devez adapter DATABASE_URL à votre environnement
psql $DATABASE_URL -f scripts/create-performance-indexes.sql

# 5. Valider les changements
echo "✅ Étape 5: Validation des fichiers..."
node -c src/config/database.js && echo "✅ database.js valide"
node -c src/server.js && echo "✅ server.js valide"
node -c src/controllers/productController.js && echo "✅ productController.js valide"

# 6. Tests de performance (optionnel)
echo "⚡ Étape 6: Tests recommandés..."
echo "Vous pouvez maintenant tester avec:"
echo "  npm run dev"
echo ""
echo "📊 Améliorations attendues:"
echo "  • GET /products: 7-10s → 500ms (14-20x plus rapide)"
echo "  • POST /products: 2-3s → 200ms (10-15x plus rapide)"
echo "  • Pool connexions: 10 → 50 (5x plus de capacité)"
echo "  • Mémoire: 50MB limit → 5MB (sécurité)"
echo ""
echo "🎉 Déploiement terminé!"
