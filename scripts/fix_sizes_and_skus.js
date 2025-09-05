const fs = require('fs');
const path = require('path');

const dataPath = path.resolve(__dirname, '..', 'data', 'product.json');
const backupPath = path.resolve(__dirname, '..', 'data', `product.json.bak.${Date.now()}.json`);

let products;
try {
  const raw = fs.readFileSync(dataPath, 'utf8');
  products = JSON.parse(raw);
} catch (e) {
  console.error('Failed to read/parse product.json at', dataPath, e.message || e);
  process.exit(1);
}

// Backup original
fs.writeFileSync(backupPath, JSON.stringify(products, null, 2), 'utf8');
console.log('Backup written to:', backupPath);

const colors = [
  'Black','White','Red','Blue','Yellow','Green','Silver','Gray','Grey','Orange','Pink','Purple','Brown','Beige','Gold','Bronze','Copper','Maroon','Champagne','Teal','Cyan','Lime','Magenta','Navy','Olive','Tan','Burgundy','Ivory','Turquoise','Indigo','Violet'
];

const colorRegex = new RegExp('\\b(' + colors.join('|') + ')\\b', 'gi');

function normalizeNameForFix(name) {
  if (!name) return name;
  let s = String(name);
  // remove color words
  s = s.replace(colorRegex, '');
  // remove size letters (XS, S, M, L, XL, XXL etc)
  s = s.replace(/\b(XXXL|XXL|XL|XS|S|M|L)\b/gi, '');
  // remove numeric tokens that look like frame sizes (20..80)
  s = s.replace(/\b(\d{1,3})\b/g, (m, p1) => {
    const n = parseInt(p1, 10);
    if (n >= 20 && n <= 80) return '';
    return m; // keep numbers outside plausible size range (e.g., model numbers like 350)
  });
  // remove punctuation
  s = s.replace(/[\-_,()\/\\]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s || name;
}

function normalizeSkuForFix(sku) {
  if (!sku) return sku;
  let s = String(sku).trim();
  // remove trailing color token (e.g., -Red)
  s = s.replace(new RegExp('[-_\. ](' + colors.join('|') + ')$', 'i'), '');
  // remove trailing -<digits> if digit value is plausible size
  s = s.replace(/(-\s*)(\d{1,3})$/i, (m, p1, p2) => {
    const n = parseInt(p2, 10);
    if (n >= 20 && n <= 80) return '';
    return m;
  });
  // remove trailing -XS|S|M|L|XL|XXL
  s = s.replace(/(-\s*)(XS|S|M|L|XL|XXL)$/i, '');
  // remove trailing -W or -F (women/female markers)
  s = s.replace(/(-\s*)(W|F)$/i, '');
  // collapse punctuation
  s = s.replace(/(^-+|-+$)/g, '').trim();
  return s;
}

let nameChanges = 0;
let skuChanges = 0;

const newProducts = products.map(p => {
  const p2 = Object.assign({}, p);
  const origName = p.name || '';
  const origSku = p.sku || '';
  const newName = normalizeNameForFix(origName);
  const newSku = normalizeSkuForFix(origSku);
  if (newName !== origName) nameChanges++;
  if (newSku !== origSku) skuChanges++;
  p2.name = newName;
  p2.sku = newSku;
  return p2;
});

fs.writeFileSync(dataPath, JSON.stringify(newProducts, null, 2), 'utf8');
console.log('Wrote fixed products to:', dataPath);
console.log('Names updated:', nameChanges, 'SKUs updated:', skuChanges);
console.log('Backup is available at:', backupPath);

// Run quick validation using existing validation script if present
try {
  const { execSync } = require('child_process');
  console.log('\nRe-running validation script...');
  const out = execSync('node scripts/validate_merged_products.js', { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  console.error('Failed to re-run validation script:', e.message || e);
}

process.exit(0);
