#!/bin/bash

# Script de nettoyage des migrations redondantes
# Supprime les migrations 026, 027, 028, 030 car elles sont consolidées dans 031

echo "🧹 Nettoyage des migrations redondantes..."
echo ""

# Répertoire des migrations
MIGRATIONS_DIR="/Users/RatiaryMario/Desktop/site sinoa/backend/migrations"

# Migrations à supprimer (redondantes)
REDUNDANT_MIGRATIONS=(
  "026_add_missing_order_columns.sql"
  "027_add_payment_and_checkout_columns.sql"
  "028_add_customer_info_columns.sql"
  "030_orders_complete_schema.sql"
)

# Archiver les fichiers supprimés
ARCHIVE_DIR="${MIGRATIONS_DIR}/.archive"
mkdir -p "$ARCHIVE_DIR"

echo "📦 Archivage des migrations redondantes..."
for migration in "${REDUNDANT_MIGRATIONS[@]}"; do
  if [ -f "$MIGRATIONS_DIR/$migration" ]; then
    echo "   ➜ Archivage: $migration"
    mv "$MIGRATIONS_DIR/$migration" "$ARCHIVE_DIR/$migration"
  fi
done

echo ""
echo "✅ Nettoyage complété!"
echo ""
echo "📋 Migrations restantes (ordre d'exécution):"
ls -1 "$MIGRATIONS_DIR"/*.sql | grep -v ".archive" | xargs -I {} basename {} | sort
echo ""
echo "📂 Migrations archivées (sauvegardées):"
ls -1 "$ARCHIVE_DIR"/*.sql 2>/dev/null || echo "   (aucune)"
echo ""
echo "💡 Si vous devez restaurer:"
echo "   mv $ARCHIVE_DIR/* $MIGRATIONS_DIR/"

