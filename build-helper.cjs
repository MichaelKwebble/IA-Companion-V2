const fs = require('fs');
const { execSync } = require('child_process');

const pkgPath = './package.json';
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const originalType = pkg.type;

console.log(`Original type: ${originalType}`);

// Remove "type": "module"
delete pkg.type;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('Temporarily removed "type": "module" from package.json');

try {
    console.log('Running electron-builder...');
    const buildCommand = 'electron-builder --config electron-builder.json';
    execSync(buildCommand, { stdio: 'inherit' });
} catch (error) {
    console.error('Build failed:', error);
    // Don't exit yet, we need to restore package.json
} finally {
    // Restore "type": "module"
    if (originalType) {
        pkg.type = originalType;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        console.log('Restored "type": "module" to package.json');
    }
}
