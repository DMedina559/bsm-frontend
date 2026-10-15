#!/bin/bash
set -e

echo "Building frontend..."
npm ci
npm run build

echo "Building Python package..."
python3 -m build

echo "Build complete. Artifacts are in dist/"
