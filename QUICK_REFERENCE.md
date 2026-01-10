# Git Configuration - Quick Reference

## 🎯 At a Glance

**Repository Size:** 163 files (99.6% reduction from 40,000+)

**Strategy:** Push only source code + Smart Home UI placeholder. Your other projects stay local.

---

## ✅ What Gets Pushed

| Category | Files | Description |
|----------|-------|-------------|
| **App Source** | ~100 | React/TypeScript/JS/CSS files |
| **Arduino Config** | ~21 | Index files and configuration |
| **projects.json** | 1 | **Only "Smart Home UI"** (your other projects stay local!) |
| **Documentation** | ~5 | SETUP.md, README.md, etc. |
| **Config Files** | ~36 | package.json, tsconfig, etc. |

---

## ❌ What's Ignored / Stays Local

| Category | Reason |
|----------|--------|
| **ESP32 Board Manager** (~35k files) | Download via app's Boards Manager |
| **Arduino Libraries** | Download via app's Library Manager |
| **Other Board Managers** | Not needed for this project |
| **node_modules** | Install with `npm install` |
| **Your other projects** (Test_new, Blink LED, etc) | Stay in your local projects.json only |

---

## 🚀 Push Workflow (IMPORTANT!)

### Using the Automated Script (Recommended)

```bash
./push-to-github.sh
```

**This script automatically:**
1. ✅ Backs up your full `projects.json` (with Test_new, Blink LED, Smart Home UI)
2. ✅ Creates a clean version with **only Smart Home UI**
3. ✅ Commits and pushes the clean version
4. ✅ Restores your full `projects.json` locally
5. ✅ Tells Git to ignore future changes to `projects.json`

**Result:** 
- GitHub gets: `projects.json` with only "Smart Home UI"
- Your computer keeps: `projects.json` with all your projects
- Future projects you add: Won't be synced to GitHub

### Manual Method (Advanced)

If you want to do it manually:

```bash
# 1. Backup your projects.json
cp projects.json projects.json.backup

# 2. Create clean version (only Smart Home UI)
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

# 3. Commit and push
git add .
git commit -m "Initial commit - optimized for team"
git push

# 4. Restore your full version
mv projects.json.backup projects.json

# 5. Ignore future changes
git update-index --assume-unchanged projects.json
```

---

## 👥 Team Setup (3 steps)

1. **Clone:** `git clone <your-repo>`
2. **Install:** `npm install`
3. **Run:** `npm run electron:dev`

They will see:
- ✅ "Smart Home UI" placeholder in projects.json
- ✅ Can add their own projects (which won't be synced)

First time in the app:
- Open Boards Manager → Install ESP32
- Done!

---

## 🔍 Understanding projects.json

### On YOUR Computer (after push)
```json
[
  { "name": "Test_new", ... },      ← Your local project
  { "name": "Blink LED", ... },     ← Your local project
  { "name": "Smart Home UI", ... }  ← Shared placeholder
]
```

### On GitHub (what team sees)
```json
[
  { "name": "Smart Home UI", ... }  ← Only this one!
]
```

### On Teammate's Computer
```json
[
  { "name": "Smart Home UI", ... }, ← From Git
  { "name": "Their Project", ... }  ← They add their own
]
```

**Everyone's `projects.json` is independent!**

---

## 📋 Verification Commands

```bash
# Verify git setup
./verify-git-setup.sh

# Check what will be committed
git status

# Count files to be pushed
git ls-files | wc -l

# See what's in projects.json locally
cat projects.json

# See what's committed in Git (what GitHub will have)
git show HEAD:projects.json
```

---

## 🔧 Important Notes

1. **Your projects stay local:**
   - ✅ Test_new, Blink LED remain on your computer
   - ✅ Only Smart Home UI goes to GitHub
   - ✅ Future projects you create won't be synced

2. **The push script is crucial:**
   - ✅ Always use `./push-to-github.sh` for the first push
   - ✅ It handles the projects.json swap automatically
   - ✅ Your local file is preserved

3. **After first push:**
   - ✅ Add more projects freely
   - ✅ Changes to projects.json won't show in `git status`
   - ✅ No risk of accidentally pushing your test projects

---

## 🛠️ Troubleshooting

### "I accidentally committed my full projects.json"

```bash
# Undo the last commit (keeps your changes)
git reset HEAD~1

# Run the push script again
./push-to-github.sh
```

### "I want to track projects.json changes again"

```bash
# Re-enable tracking
git update-index --no-assume-unchanged projects.json
```

### "I want to check what's in Git vs local"

```bash
# What's committed in Git
git show HEAD:projects.json

# What's on your computer
cat projects.json
```

---

## ✨ Key Benefits

✅ **Tiny repo** - 163 files instead of 40,000+  
✅ **Fast clones** - Seconds, not minutes  
✅ **Private test projects** - Stay on your computer only  
✅ **No conflicts** - Each dev has their own project list  
✅ **Shared placeholder** - Everyone starts with Smart Home UI  

---

**Questions?** Check SETUP.md or GIT_SYNC_SUMMARY.md for details.
