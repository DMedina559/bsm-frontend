#!/bin/bash
set -e
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
npm ci
npm run build:python
