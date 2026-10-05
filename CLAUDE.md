# Frigobilan

Outil web d'aide à l'étude pour frigoristes, en français, livré en **un seul fichier HTML hors ligne** (PWA installable sur iPhone via GitHub Pages).

## Organisation

- `src/frigobilan.html` : l'application (HTML, CSS et un bloc `<script>` par onglet). **C'est ici qu'on modifie l'app.**
- `src/stations/` : modules ES purs (sans DOM), testés avec `node --test`, intégrés au HTML par le build à l'emplacement `<script data-inline="…"></script>`. `model.js` = stations de vannes (données, migration, nomenclature, CSV), exposé dans la page sous `window.FBStations`.
- `tools/build.mjs` : assemble le fichier unique → `dist/frigobilan.html` (à télécharger) et `frigobilan.html` à la racine (servi par GitHub Pages, ne pas modifier à la main).
- `tools/smoke.mjs` : test de bout en bout Playwright (format iPhone, hors ligne) sur `dist/frigobilan.html`.
- `sw.js`, `manifest.webmanifest`, `icons/`, `index.html` : app installable et hors ligne.

## Commandes

```
npm install
npm run build        # après toute modification de src/
npm test             # tests unitaires + vérifie que les fichiers construits sont à jour
npm run test:e2e     # bout en bout (Chromium)
```

## Données

`window.Store` (dans `src/frigobilan.html`) enregistre les projets dans `localStorage` (`frigobilan-store-v2`).
Un projet a des chambres (`rooms`) ; les parties `bilan`, `room`, `brassage`, `elec` sont par chambre, les autres (`consult`, `dn`, `stations`) par projet.
`normalize(p)` migre chaque projet au chargement et à l'import : toute évolution du format doit rester compatible avec les anciens projets et exports JSON.
Les évaporateurs (`rooms[].brassage.evaps[]`) ont un `id` stable ; une station le référence par `evapId`.

## Règles

- Interface et textes en français ; thèmes sombre et clair via les variables CSS de `:root`.
- Mobile d'abord (iPhone) ; fonctionne aussi à la souris.
- Aucun CDN ni appel réseau ajouté (les polices Google existantes ont un repli système).
- Aucun nom de client réel dans le code, les exemples ou les tests : noms de code uniquement (Projet Alpha…).
- Ne pas modifier les formules de calcul existantes (Bilan, Brassage, Électricité, DN rapide).
