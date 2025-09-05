const fs = require('fs');
const path = require('path');

const dataPath = path.resolve(__dirname, '..', 'data', 'product.json');
const backupPath = path.resolve(__dirname, '..', 'data', `product.json.bak.conservative.${Date.now()}.json`);

let products;
try {
  products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (e) {
  console.error('Failed to read/parse product.json at', dataPath, e.message || e);
  process.exit(1);
}

// Backup
fs.writeFileSync(backupPath, JSON.stringify(products, null, 2), 'utf8');
console.log('Backup written to:', backupPath);

function parseAvailableSizes(desc) {
  if (!desc) return new Set();
  const m = desc.match(/Available sizes:\s*([^\.\n]+)/i);
  if (!m) return new Set();
  const list = m[1].split(/[\,\|;]+/).map(s => s.trim()).filter(Boolean);
  const normalized = new Set(list.map(s => {
    const num = s.match(/\d{1,3}/);
    if (num) return num[0];
    return s.toUpperCase();
  }));
  return normalized;
}

function parseAvailableColors(desc) {
  if (!desc) return new Set();
  const m = desc.match(/Available colors:\s*([^\.\n]+)/i);
  if (!m) return new Set();
  const list = m[1].split(/[\,\|;]+/).map(s => s.trim()).filter(Boolean);
  return new Set(list.map(s => s.toLowerCase()));
}

// existing SKUs set (original)
const existingSkus = new Set(products.map(p => (p.sku || '').trim()));
const proposedNewSkus = new Set();

let changed = 0;
let skippedDueToCollision = 0;

for (const p of products) {
  const origSku = (p.sku || '').trim();
  const desc = p.description || '';
  const availableSizes = parseAvailableSizes(desc); // set of strings (numbers or letters)
  const availableColors = parseAvailableColors(desc); // set of lowercase color names

  let candidate = origSku;

  // check trailing numeric size
  const mNum = origSku.match(/[-_. ](\d{1,3})$/);
  if (mNum) {
    const num = mNum[1];
    if (availableSizes.has(num)) {
      const newSku = origSku.replace(/[-_. ](\d{1,3})$/, '').trim();
      candidate = newSku || candidate;
    }
  }

  // check trailing size letters (XS, S, M, L, XL, XXL)
  const mLetter = origSku.match(/[-_. ](XS|S|M|L|XL|XXL)$/i);
  if (mLetter && candidate === origSku) { // only if not already changed by numeric rule
    const letter = mLetter[1].toUpperCase();
    if (availableSizes.has(letter)) {
      const newSku = origSku.replace(/[-_. ](XS|S|M|L|XL|XXL)$/i, '').trim();
      candidate = newSku || candidate;
    }
  }

  // check trailing color word
  if (candidate === origSku) {
    const mColor = origSku.match(/[-_. ]([A-Za-z]+)$/);
    if (mColor) {
      const colorWord = mColor[1].toLowerCase();
      if (availableColors.has(colorWord)) {
        const newSku = origSku.replace(new RegExp('[-_. ]' + colorWord + '$', 'i'), '').trim();
        candidate = newSku || candidate;
      }
    }
  }

  // if candidate differs, verify no collision with other original SKUs or proposed
  if (candidate !== origSku) {
    // Collision if candidate exists as an original SKU for another product
    const collidesWithExisting = existingSkus.has(candidate) && candidate !== origSku;
    const collidesWithProposed = proposedNewSkus.has(candidate);
    if (collidesWithExisting || collidesWithProposed) {
      skippedDueToCollision++;
      continue; // skip change to avoid creating duplicates
    }
    // Accept change
    p.sku = candidate;
    // update sets
    existingSkus.delete(origSku);
    existingSkus.add(candidate);
    proposedNewSkus.add(candidate);
    changed++;
  }
}

// Write back
fs.writeFileSync(dataPath, JSON.stringify(products, null, 2), 'utf8');
console.log('Wrote conservatively-fixed SKUs to:', dataPath);
console.log('SKUs changed:', changed, 'SKUs skipped due to collisions:', skippedDueToCollision);
console.log('Backup is at:', backupPath);

// run validation
try {
  const { execSync } = require('child_process');
  console.log('\nRe-running validation script...');
  const out = execSync('node scripts/validate_merged_products.js', { encoding: 'utf8' });
  console.log(out);
} catch (e) {
  console.error('Failed to re-run validation script:', e.message || e);
}

process.exit(0);
