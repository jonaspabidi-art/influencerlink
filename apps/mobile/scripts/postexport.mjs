import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Expo kör sin egen HTML-mall i SPA-läge och `app/+html.tsx` används inte, så
 * det som krävs för "Lägg till på hemskärmen" måste läggas in efter bygget:
 * utan apple-touch-icon får man en tom ruta på hemskärmen, och utan
 * apple-mobile-web-app-capable öppnas appen i Safari med adressfält i stället
 * för i helskärm.
 */
const file = new URL('../dist/index.html', import.meta.url);
let html = readFileSync(file, 'utf8');

const tags = [
  '<link rel="manifest" href="/manifest.json">',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  '<link rel="icon" type="image/png" href="/icon-192.png">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
  '<meta name="apple-mobile-web-app-title" content="Pacta">',
];

// viewport-fit=cover ger appen hela skärmen på telefoner med hak.
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover">',
);

const missing = tags.filter((tag) => !html.includes(tag.split(' ')[1]));
if (missing.length > 0) {
  html = html.replace('</head>', `  ${missing.join('\n  ')}\n</head>`);
}

// Överskrollning ska visa appens bakgrund, inte vitt.
html = html.replace('</head>', '  <style>body{background-color:#F7F2EA}</style>\n</head>');

writeFileSync(file, html);
console.log(`Lade till ${missing.length} taggar för hemskärm och helskärm.`);
