// Génère index.html (page complète, ouvrable hors ligne ou via GitHub Pages)
// à partir de hyperscale.html (le corps de la page, aussi utilisé pour l'artifact).
// Usage : node tools/build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'hyperscale.html'), 'utf8');
fs.writeFileSync(path.join(root, 'index.html'),
  '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '</head>\n<body>\n' + page + '\n</body>\n</html>\n', 'utf8');
console.log('index.html généré');
