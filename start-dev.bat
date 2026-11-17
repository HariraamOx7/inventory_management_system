@echo off
cd /d "D:\PROJECT\shop_new_ui"

echo Starting Frontend...
start cmd /k "cd shop\Stores\frontend && npm run dev"

echo Starting Backend...
start cmd /k "cd shop\Stores\backend && npm run dev"
