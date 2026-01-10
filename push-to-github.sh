#!/bin/bash

echo "🚀 Git Push Workflow for IA Companion V2"
echo "========================================"
echo ""

# Step 1: Check current status
echo "📋 Step 1: Checking current status..."
CHANGES=$(git status --porcelain | wc -l | xargs)

if [ "$CHANGES" -eq "0" ]; then
    echo "   ✅ No changes to commit"
    echo ""
    echo "Your repository is up to date!"
    exit 0
fi

echo "   📝 Found $CHANGES changed files"
echo ""

# Step 2: Handle projects.json specially
if [ -f "projects.json" ]; then
    echo "🔄 Step 2: Preparing projects.json..."
    
    # Backup the current projects.json (with all your projects)
    cp projects.json projects.json.backup
    echo "   ✅ Backed up your full projects.json"
    
    # Create the clean version (only Smart Home UI)
    cat > projects.json << 'EOF'
[
  {
    "id": "2",
    "name": "Smart Home UI",
    "type": "design",
    "lastModified": "1 hour ago"
  }
]
EOF
    echo "   ✅ Created clean version (only Smart Home UI) for Git"
    echo ""
fi

# Step 3: Show what will be committed
echo "📦 Step 3: Files to be committed (sample):"
git status --short | head -10
if [ "$CHANGES" -gt "10" ]; then
    echo "   ... and $((CHANGES - 10)) more files"
fi
echo ""

# Step 4: Confirm
read -p "Do you want to commit and push these changes? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "❌ Aborted by user"
    
    # Restore the full projects.json
    if [ -f "projects.json.backup" ]; then
        mv projects.json.backup projects.json
        echo "   ✅ Restored your full projects.json"
    fi
    exit 1
fi

# Step 5: Get commit message
echo ""
echo "📝 Step 4: Enter commit message:"
read -p "Message: " COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
    echo "❌ Commit message cannot be empty"
    
    # Restore the full projects.json
    if [ -f "projects.json.backup" ]; then
        mv projects.json.backup projects.json
        echo "   ✅ Restored your full projects.json"
    fi
    exit 1
fi

# Step 6: Add all files
echo ""
echo "➕ Step 5: Adding files..."
git add .

# Step 7: Commit
echo "💾 Step 6: Committing..."
git commit -m "$COMMIT_MSG"

if [ $? -ne 0 ]; then
    echo "❌ Commit failed"
    
    # Restore the full projects.json
    if [ -f "projects.json.backup" ]; then
        mv projects.json.backup projects.json
        echo "   ✅ Restored your full projects.json"
    fi
    exit 1
fi

# Step 8: Restore the full projects.json BEFORE pushing
if [ -f "projects.json.backup" ]; then
    echo ""
    echo "🔄 Step 7: Restoring your full projects.json..."
    mv projects.json.backup projects.json
    echo "   ✅ Your projects.json now has all your projects again"
fi

# Step 9: Tell Git to ignore future changes to projects.json
echo ""
echo "🔒 Step 8: Configuring Git to ignore future changes to projects.json..."
git update-index --assume-unchanged projects.json
echo "   ✅ Future changes to projects.json will NOT be tracked"
echo ""

# Step 10: Push
echo "🚀 Step 9: Pushing to GitHub..."
git push

if [ $? -eq 0 ]; then
    echo ""
    echo "✨ SUCCESS! Your changes have been pushed to GitHub"
    echo ""
    echo "📊 What happened:"
    echo "   ✅ Pushed projects.json with only 'Smart Home UI'"
    echo "   ✅ Restored your full projects.json locally"
    echo "   ✅ Future changes to projects.json will NOT be synced"
    echo ""
    echo "You can now add more projects locally without affecting Git!"
    echo ""
else
    echo ""
    echo "❌ Push failed. Please check your internet connection and try again."
    echo "   You can manually push with: git push"
    exit 1
fi
