#!/usr/bin/env bash
# move to vagarish dir
cd `dirname "$0"`
pm2 stop "npm run start"
npm run init
pm2 start "npm run start"