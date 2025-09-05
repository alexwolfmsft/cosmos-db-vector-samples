const fs = require('fs');
const path = require('path');

const dataPath = path.resolve(__dirname, '..', 'data', 'product.json');
const raw = fs.readFileSync(dataPath, 'utf8');
let products;
try {
  products = JSON.parse(raw);
} catch (err) {
  console.error('Failed to parse JSON at', dataPath, err.message);
  process.exit(1);
}

const colors = [
  'Black','Red','Yellow','Silver','Blue','White','Green','Orange','Purple','Pink','Gray','Grey','Gold','Brown','Beige','Multi','Olive','Maroon','Cyan','Magenta'
];

const colorRegex = new RegExp('\\b(' + colors.join('|') + ')\\b', 'gi');

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function parseName(name) {
  let original = name || '';
  // find size at end (e.g., ", 48" or " 48")
  const sizeMatch = original.match(/(?:,|\s|-)?\s*(\d{1,3})\s*$/);
  const sizeFound = sizeMatch ? sizeMatch[1] : null;

  // find colors
  const colorsFound = [];
  let m;
  colorRegex.lastIndex = 0;
  while ((m = colorRegex.exec(original)) !== null) {
    colorsFound.push(capitalize(m[1]));
  }

  // remove color words and trailing size from name
  let base = original.replace(colorRegex, '');
  if (sizeFound) {
    base = base.replace(/(?:,|\s|-)?\s*\d{1,3}\s*$/, '');
  }
  // remove stray separators like ' - ' or trailing commas
  base = base.replace(/\s*-\s*$/, '').replace(/,\s*$/, '').trim();
  base = base.replace(/\s+/g, ' ');

  return { base: base.trim(), colorsFound: Array.from(new Set(colorsFound)), sizeFound };
}

// Group by base name (normalized)
const groups = new Map();
for (const p of products) {
  const { base, colorsFound, sizeFound } = parseName(p.name || '');
  const key = base.toLowerCase();
  if (!groups.has(key)) groups.set(key, { base, items: [] });
  groups.get(key).items.push(Object.assign({}, p, { _colorsFound: colorsFound, _sizeFound: sizeFound }));
}

const merged = [];
for (const [key, g] of groups.entries()) {
  const items = g.items;
  const colorsSet = new Set();
  const sizesSet = new Set();
  for (const it of items) {
    (it._colorsFound || []).forEach(c => colorsSet.add(c));
    if (it._sizeFound) sizesSet.add(it._sizeFound);
  }

  const rep = items[0];
  // normalize sku: remove trailing -<digits> (size), then remove trailing single-letter color codes on last segment
  let sku = rep.sku || '';
  sku = sku.replace(/-\s*\d+$/,'');
  // if last segment ends with a single uppercase letter, drop it
  const segs = sku.split('-');
  if (segs.length>0) {
    const last = segs[segs.length-1];
    if (last && last.length>1 && /[A-Z]$/.test(last)) {
      segs[segs.length-1] = last.replace(/[A-Z]$/,'');
      sku = segs.join('-');
    }
  }
  sku = sku.replace(/-$/, '');

  // name without color/size
  const name = g.base;

  // description: take rep.description then append available colors/sizes
  let description = rep.description || '';
  if (colorsSet.size > 0) {
    description = description.replace(/\"?The product called \\".*?\\"?/, function(match){
      // preserve original description if it's the default; we'll still append colors
      return match;
    });
    description = (description || '') + (description && !description.endsWith('.') ? '.' : '');
    description += ' Available colors: ' + Array.from(colorsSet).join(', ') + '.';
  }
  if (sizesSet.size > 0) {
    description += ' Available sizes: ' + Array.from(sizesSet).join(', ') + '.';
  }

  const mergedItem = {
    id: rep.id,
    categoryId: rep.categoryId,
    sku: sku || rep.sku,
    name: name,
    description: description || rep.description,
    price: rep.price,
    largeDescription: rep.largeDescription
  };

  // preserve other fields if present (non-conflicting)
  // copy any other properties from rep that are not in mergedItem
  for (const k of Object.keys(rep)) {
    if (!mergedItem.hasOwnProperty(k) && !k.startsWith('_')) mergedItem[k] = rep[k];
  }

  merged.push(mergedItem);
}

// write back
fs.writeFileSync(dataPath, JSON.stringify(merged, null, 2), 'utf8');
console.log('Merged', products.length, 'entries into', merged.length, 'entries.');
console.log('Wrote merged product list to', dataPath);
