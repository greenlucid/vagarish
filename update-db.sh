#!/usr/bin/env bash
# move to vagarish dir
cd `dirname "$0"`
npx pm2 stop "npm run start"
npm run init
npx pm2 start "npm run start"