#!/bin/bash

# MBR Extractor Commit Script
# Automatically adds all changes and prompts for a commit message

# 1. Add all changes
echo -e "\033[0;34mStaging all changes...\033[0m"
git add .

# 2. Prompt for commit message
echo -ne "\033[0;32mEnter commit message: \033[0m"
read commit_message

# Check if message is empty
if [ -z "$commit_message" ]; then
  echo -e "\033[0;31mError: Commit message cannot be empty.\033[0m"
  exit 1
fi

# 3. Perform commit
git commit -m "$commit_message"

echo -e "\033[0;32mChanges committed successfully.\033[0m"
