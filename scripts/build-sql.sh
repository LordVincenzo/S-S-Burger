#!/usr/bin/env bash
# Junta todas las migraciones + el seed en un solo archivo para pegar
# en el SQL Editor de Supabase al montar un proyecto NUEVO.
# Uso: bash scripts/build-sql.sh
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=supabase/instalacion-completa.sql

{
  echo "-- ============================================================="
  echo "-- S&S Burger — Instalación completa"
  echo "--"
  echo "-- Generado con scripts/build-sql.sh — no editar a mano."
  echo "-- Sirve para montar un proyecto NUEVO desde cero."
  echo "-- Si tu base ya está instalada, ejecuta solo la migración que falte."
  echo "-- ============================================================="
  for f in supabase/migrations/*.sql supabase/seed.sql; do
    echo
    echo "-- >>>>>>>>>>>>>>>>>>>>  $f  <<<<<<<<<<<<<<<<<<<<"
    echo
    cat "$f"
  done
} > "$OUT"

echo "Generado $OUT ($(wc -l < "$OUT") líneas)"
