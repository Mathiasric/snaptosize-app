#!/bin/bash
set -e
npx @opennextjs/cloudflare build
cp .open-next/worker.js .open-next/assets/_worker.js
