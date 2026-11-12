// Génère index.html (page complète, ouvrable hors ligne ou via GitHub Pages)
// à partir de hyperscale.html (le corps de la page, aussi utilisé pour l'artifact).
// Usage : node tools/build.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'hyperscale.html'), 'utf8');
fs.writeFileSync(path.join(root, 'index.html'),
  '<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' +
  '<meta name="description" content="Hyperscale : jeu de gestion d\'une salle de datacenter pour réviser le BTS SIO option SISR.">\n' +
  '<meta name="theme-color" content="#16191d">\n' +
  '<link rel="manifest" href="manifest.webmanifest">\n' +
  '<link rel="icon" href="icon.svg" type="image/svg+xml">\n' +
  '<link rel="apple-touch-icon" href="icon-192.png">\n' +
  '</head>\n<body>\n' + page + '\n</body>\n</html>\n', 'utf8');
console.log('index.html généré');
