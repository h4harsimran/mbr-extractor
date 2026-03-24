#!/bin/bash

# MBR Extractor Development Script
# Runs both the worker and the frontend in parallel

# Function to handle script termination
cleanup() {
  echo -e "\n\033[0;31mStopping services...\033[0m"
  # Kill all child processes of this script
  pkill -P $$
  exit
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo -e "\033[0;32mStarting MBR Extractor Services...\033[0m"

# Start Worker (Hono + Wrangler)
echo -e "\033[0;34m[Worker] Starting...\033[0m"
(cd worker && npm run dev) &

# Give the worker a second to start its local server
sleep 2

# Start Frontend (React + Vite)
echo -e "\033[0;36m[Frontend] Starting...\033[0m"
(cd frontend && npm run dev) &

echo -e "\033[0;32mBoth services are running. Press Ctrl+C to stop.\033[0m"

# Wait for background processes
wait
