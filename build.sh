#!/bin/bash
set -e

echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Building Python package..."
python3 -m build

echo "Build complete. Artifacts are in dist/"
