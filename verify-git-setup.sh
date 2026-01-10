#!/bin/bash

echo "🔍 Git Setup Verification"
echo "========================="
echo ""

echo "✅ Files that WILL BE PUSHED:"
TOTAL_FILES=$(git ls-files --cached --others --exclude-standard | wc -l | xargs)
APP_FILES=$(git ls-files --cached --others --exclude-standard | grep -E '\.(js|jsx|ts|tsx|css|html|json)$' | wc -l | xargs)
ARDUINO_FILES=$(git ls-files --cached --others --exclude-standard arduino/ | wc -l | xargs)

echo "  - Total files: $TOTAL_FILES"
echo "  - App source files (js/ts/css/html): $APP_FILES"
echo "  - Arduino config files: $ARDUINO_FILES"
echo "  - projects.json: $(git ls-files projects.json 2>/dev/null | wc -l | xargs) file"
echo ""

echo "❌ Files that will NOT BE PUSHED (ignored):"
git check-ignore arduino/data/packages/esp32/ >/dev/null 2>&1 && echo "  - ESP32 board manager: ✓ ignored" || echo "  - ESP32 board manager: ⚠️  NOT ignored"
git check-ignore arduino/data/packages/arduino/ >/dev/null 2>&1 && echo "  - Arduino board manager: ✓ ignored" || echo "  - Arduino board manager: ⚠️  NOT ignored"
git check-ignore arduino/user/libraries/ >/dev/null 2>&1 && echo "  - Downloaded libraries: ✓ ignored" || echo "  - Downloaded libraries: ⚠️  NOT ignored"
echo ""

echo "📊 Repository Size Comparison:"
echo "  - Total files in directory: ~40,000+"
echo "  - Files to be committed: $TOTAL_FILES"
PERCENTAGE=$(echo "scale=1; (40000 - $TOTAL_FILES) / 40000 * 100" | bc)
echo "  - Reduction: ~${PERCENTAGE}%"
echo ""

echo "✨ Setup Status:"
if [ "$TOTAL_FILES" -lt "500" ]; then
    echo "  ✅ EXCELLENT - Repository is optimized!"
    echo "  You're only pushing essential source code."
else
    echo "  ⚠️  WARNING - More files than expected ($TOTAL_FILES)"
    echo "  Check your .gitignore configuration."
fi
echo ""

echo "📋 Next Steps:"
if [ -f "push-to-github.sh" ]; then
    echo "  Run: ./push-to-github.sh"
    echo "  This will commit and push your changes to GitHub."
else
    echo "  Run: git add . && git commit -m 'Initial commit' && git push"
fi
