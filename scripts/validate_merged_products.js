const fs = require('fs');
const path = require('path');

const dataPath = path.resolve(__dirname, '..', 'data', 'product.json');
const reportPath = path.resolve(__dirname, '..', 'data', 'validation_report.json');

let products;
try {
  products = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (e) {
  console.error('Failed to read/parse product.json at', dataPath, e.message || e);
  process.exit(1);
}

const colors = [
  'Black','White','Red','Blue','Yellow','Green','Silver','Gray','Grey','Orange','Pink','Purple','Brown','Beige','Gold','Bronze','Copper','Maroon','Champagne','Teal','Cyan','Lime','Magenta','Navy','Olive','Tan','Burgundy','Ivory','Turquoise','Indigo','Violet'
];

const colorRegex = new RegExp('\\b(' + colors.join('|') + ')\\b', 'gi');
const sizeLettersRegex = /\b(XXXL|XXL|XL|XS|S|M|L)\b/gi;
const sizeNumberRegex = /\b\d{2,3}\b/g;

function findMatches(str, regex) {
  if (!str) return [];
  const out = [];
  let m;
  // Reset lastIndex for global regexes
  if (regex.global) regex.lastIndex = 0;
  while ((m = regex.exec(str)) !== null) {
    out.push(m[0]);
  }
  return out;
}

function normalizeName(name) {
  if (!name) return '';
  let s = String(name);
  // replace punctuation with spaces
  s = s.replace(/[\-_,()\/\\]/g, ' ');
  // remove known color words
  s = s.replace(colorRegex, '');
  // remove size tokens (letters)
  s = s.replace(/\b(XXXL|XXL|XL|XS|S|M|L)\b/gi, '');
  // remove numeric sizes
  s = s.replace(/\b\d{1,3}\b/g, '');
  // remove womens/w suffix tokens
  s = s.replace(/\b(\w-?W|W|Women|Women\'s|Womens|Womans)\b/gi, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

const nameHasColor = [];
const nameHasSize = [];
const skuHasColor = [];
const skuHasSize = [];
const ldHasColorOrSize = [];
const skuMap = new Map();
const groups = new Map();

products.forEach(prod => {
  const id = prod.id || '(no-id)';
  const name = prod.name || '';
  const sku = prod.sku || '';
  const desc = prod.description || '';
  const large = prod.largeDescription || '';

  // detect colors in name
  const nameColorMatches = findMatches(name, colorRegex);
  if (nameColorMatches.length) {
    nameHasColor.push({ id, name, sku, colors: Array.from(new Set(nameColorMatches)) });
  }

  // detect sizes in name (numbers or letter sizes)
  const nameNumSizes = findMatches(name, sizeNumberRegex);
  const nameLetterSizes = findMatches(name, sizeLettersRegex);
  if (nameNumSizes.length || nameLetterSizes.length) {
    nameHasSize.push({ id, name, sku, sizes: Array.from(new Set([].concat(nameNumSizes, nameLetterSizes))) });
  }

  // detect colors in sku
  const skuColorMatches = findMatches(sku, colorRegex);
  if (skuColorMatches.length) {
    skuHasColor.push({ id, sku, name, colors: Array.from(new Set(skuColorMatches)) });
  }

  // detect size-like tokens in sku (trailing -digits or -M/-L etc or last segment letter groups)
  const hasSkuTrailingDigits = /-\s*\d{1,3}$/.test(sku);
  const hasSkuTrailingSizeLetters = /-\s*(XS|S|M|L|XL|XXL)$/i.test(sku);
  const hasSkuTrailingLetters = /-[A-Za-z]{1,3}$/.test(sku);

  if (hasSkuTrailingDigits || hasSkuTrailingSizeLetters || hasSkuTrailingLetters) {
    skuHasSize.push({ id, sku, name });
  }

  // largeDescription mentions color or size
  const ldColorMatches = findMatches(large, colorRegex);
  const ldNumMatches = findMatches(large, sizeNumberRegex);
  if (ldColorMatches.length || ldNumMatches.length) {
    ldHasColorOrSize.push({ id, name, sku, colors: Array.from(new Set(ldColorMatches)), sizes: Array.from(new Set(ldNumMatches)) });
  }

  // track sku duplicates
  if (!skuMap.has(sku)) skuMap.set(sku, []);
  skuMap.get(sku).push({ id, name, sku, categoryId: prod.categoryId, price: prod.price });

  // grouping by normalized name
  const base = normalizeName(name).toLowerCase();
  if (!groups.has(base)) groups.set(base, []);
  groups.get(base).push({ id, name, sku, categoryId: prod.categoryId, price: prod.price, largeDescription: prod.largeDescription });
});

// find sku duplicates
const skuDuplicates = [];
for (const [sku, items] of skuMap.entries()) {
  if (items.length > 1) skuDuplicates.push({ sku, items });
}

// find groups with multiple items and conflicting attrs
const conflictingGroups = [];
for (const [base, items] of groups.entries()) {
  if (items.length > 1) {
    const categorySet = new Set(items.map(i => i.categoryId || ''));
    const priceSet = new Set(items.map(i => String(i.price || '')));
    const largeSet = new Set(items.map(i => (i.largeDescription || '').slice(0, 200)));

    conflictingGroups.push({
      base,
      count: items.length,
      categoryCount: categorySet.size,
      priceCount: priceSet.size,
      largeDescriptionVariants: largeSet.size,
      items
    });
  }
}

const report = {
  timestamp: new Date().toISOString(),
  totalProducts: products.length,
  anomalies: {
    nameHasColorCount: nameHasColor.length,
    nameHasSizeCount: nameHasSize.length,
    skuHasColorCount: skuHasColor.length,
    skuHasSizeCount: skuHasSize.length,
    largeDescriptionMentionsCount: ldHasColorOrSize.length,
    skuDuplicatesCount: skuDuplicates.length,
    conflictingGroupsCount: conflictingGroups.length
  },
  details: {
    nameHasColor: nameHasColor.slice(0, 200),
    nameHasSize: nameHasSize.slice(0, 200),
    skuHasColor: skuHasColor.slice(0, 200),
    skuHasSize: skuHasSize.slice(0, 200),
    largeDescriptionMentions: ldHasColorOrSize.slice(0, 200),
    skuDuplicates: skuDuplicates.slice(0, 200),
    conflictingGroups: conflictingGroups.slice(0, 200)
  }
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log('Validation complete. Report written to:', reportPath);
console.log('Summary:', JSON.stringify(report.anomalies, null, 2));

process.exit(0);
