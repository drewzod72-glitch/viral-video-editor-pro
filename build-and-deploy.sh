#!/usr/bin/env bash
set -euo pipefail

# Clean previous builds
rm -rf dist .vite dist.zip

# Install deps
npm install

# Production build
npm run build

# Package for deployment
if command -v zip >/dev/null 2>&1; then
  zip -r dist.zip dist/
else
  # Fallback: tar.gz if zip is unavailable
  tar -czf dist.tar.gz dist/
  echo "Created dist.tar.gz instead of dist.zip"
fi

echo "Done. Output:"
ls -lh dist.zip 2>/dev/null || ls -lh dist.tar.gz 2>/dev/null
