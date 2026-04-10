#!/bin/bash

# ✅ SCRIPT DE DÉPLOIEMENT COMPLET POUR RENDER
# Usage: bash scripts/deploy-to-render.sh

set -e

echo "🚀 DÉPLOIEMENT VERS RENDER"
echo "═════════════════════════════════════════"

# 1. Vérifier que les fichiers optimisés existent
echo "📋 Étape 1: Vérification des fichiers..."

FILES=(
  "src/server-startup.js"
  "src/startup.js"
  "src/controllers/orderController-optimized.js"
  "src/controllers/dashboardController-optimized.js"
  "migrations/020_add_performance_indexes.sql"
)

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "❌ Fichier manquant: $file"
    exit 1
  fi
done

echo "✅ Tous les fichiers sont présents"

# 2. Copier les fichiers optimisés
echo "📋 Étape 2: Installation des optimisations..."

# Sauvegarder les anciens
cp src/server.js src/server.js.backup 2>/dev/null || true
cp src/controllers/orderController.js src/controllers/orderController.js.backup 2>/dev/null || true
cp src/controllers/dashboardController.js src/controllers/dashboardController.js.backup 2>/dev/null || true

# Copier les nouveaux
cp src/server-startup.js src/server.js
cp src/controllers/orderController-optimized.js src/controllers/orderController.js
cp src/controllers/dashboardController-optimized.js src/controllers/dashboardController.js

echo "✅ Fichiers optimisés installés"

# 3. Valider la syntaxe Node.js
echo "📋 Étape 3: Validation de la syntaxe..."

node -c src/server.js && echo "✅ server.js valide" || exit 1
node -c src/startup.js && echo "✅ startup.js valide" || exit 1
node -c src/controllers/orderController.js && echo "✅ orderController.js valide" || exit 1
node -c src/controllers/dashboardController.js && echo "✅ dashboardController.js valide" || exit 1

# 4. Vérifier package.json
echo "📋 Étape 4: Vérification du package.json..."

# Vérifier que les packages nécessaires sont installés
npm ls express-rate-limit compression node-cache > /dev/null 2>&1 || {
  echo "📦 Installation des packages manquants..."
  npm install express-rate-limit compression node-cache
}

echo "✅ Package.json OK"

# 5. Instructions pour Render
echo ""
echo "═════════════════════════════════════════"
echo "✅ PRÊT POUR RENDER!"
echo "═════════════════════════════════════════"
echo ""
echo "📋 CHECKLIST FINAL:"
echo "  ✅ Fichiers optimisés installés"
echo "  ✅ Syntaxe validée"
echo "  ✅ Dépendances vérifiées"
echo ""
echo "🚀 PROCHAINES ÉTAPES:"
echo ""
echo "1️⃣  Assurez-vous que render.yaml existe à la racine du projet"
echo ""
echo "2️⃣  Push vers GitHub:"
echo "   git add ."
echo "   git commit -m 'Optimisations de performance et migrations auto'"
echo "   git push origin main"
echo ""
echo "3️⃣  Render va automatiquement:"
echo "   ✅ Installer les dépendances (npm install)"
echo "   ✅ Exécuter les migrations au démarrage"
echo "   ✅ Créer les indexes de performance"
echo "   ✅ Analyser les statistiques"
echo "   ✅ Démarrer le serveur"
echo ""
echo "4️⃣  Variables d'environnement à vérifier dans Render Dashboard:"
echo "   - NODE_ENV = production"
echo "   - DATABASE_URL = (doit être configurée)"
echo "   - JWT_SECRET = (doit être configurée)"
echo "   - FRONTEND_URL = https://votre-domaine.com"
echo ""
echo "5️⃣  Monitoring:"
echo "   curl https://votre-backend.render.com/api/health"
echo "   curl https://votre-backend.render.com/api/db-test"
echo ""
echo "═════════════════════════════════════════"
echo "✅ Déploiement préparé avec succès!"
echo "═════════════════════════════════════════"
