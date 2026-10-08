# Frigobilan

Outil web d'aide à l'étude pour frigoristes, en français, livré en **un seul fichier HTML hors ligne** (PWA installable sur iPhone via GitHub Pages).

## Organisation

- `src/frigobilan.html` : l'application (HTML, CSS et un bloc `<script>` par onglet). **C'est ici qu'on modifie l'app.**
- `src/stations/` : modules ES purs (sans DOM), testés avec `node --test`, intégrés au HTML par le build à l'emplacement `<script data-inline="…"></script>`. Stations de vannes, exposées dans la page sous `window.FBStations` :
  - `types.js` : catalogue des types de stations (régulation 2 voies / 3 voies, boucle à débit constant, dégivrage par mélange, électrique, par échangeur), décrits comme des topologies : niveaux, tronçons, verticales, emplacements de composants, options, remarques de conception ;
  - `model.js` : données, migration, composants, nomenclature, CSV ;
  - `layout.js` : implantation générique (colonnes compactées, position de chaque composant, tubes, coudes et tés détectés, contrôle des tubes pendants ou croisés), source unique pour le 2D, le 3D et les métrés ;
  - `schema2d.js` : schéma de principe en SVG (texte), symboles dans le style du schéma de référence ;
  - `model3d.js` : modèle 3D low-poly procédural (Three.js, testable sous node), `viewer3d.js` : rendu WebGL à la demande, OrbitControls, vues, sélection, PNG.
    Ce bundle 3D (`index3d.js` → `window.FBStations3D`, ~565 Ko minifié) est rangé dans un `<script type="text/plain">` et exécuté seulement à la première ouverture de l'onglet Stations.
- `src/fonts/` : police Mona Sans (SIL OFL, `OFL.txt`) intégrée en base64 par le build à l'emplacement `<style data-inline="fonts">`.
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
L'onglet Stations (bloc `<script>` « Stations de vannes » dans `src/frigobilan.html`) lit et écrit `Store.get/set("stations")`.
`normalize(p)` migre chaque projet au chargement et à l'import : toute évolution du format doit rester compatible avec les anciens projets et exports JSON.
Les évaporateurs (`rooms[].brassage.evaps[]`) ont un `id` stable ; une station le référence par `evapId`.

## Règles

- Interface et textes en français ; thèmes sombre et clair via les variables CSS de `:root`.
- Mobile d'abord (iPhone) ; fonctionne aussi à la souris.
- Aucun CDN ni appel réseau : polices, Three.js et modules sont intégrés au fichier (vérifié par `tests/build.test.mjs`).
- Aucun nom de client réel dans le code, les exemples ou les tests : noms de code uniquement (Projet Alpha…).
- Ne pas modifier les formules de calcul existantes (Bilan, Brassage, Électricité, DN rapide).
- Stations de vannes : contenu générique rédigé pour l'app ; ne pas reprendre de documents internes d'entreprise (numérotations, textes, marques).
- Ajouter un type de station = une entrée dans `types.js` ; `tests/types.test.mjs` vérifie automatiquement toutes ses combinaisons d'options.
