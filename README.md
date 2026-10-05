# frigobilan

Bilan frigorifique de chambre froide : une application web en un seul fichier (`frigobilan.html`).

Onglets : Bilan, Visuel, Brassage, Consultation fournisseur, Électricité, **Stations de vannes** (station eau glycolée TOR par évaporateur : schéma de principe, modèle 3D manipulable au doigt, nomenclature en CSV) et **DN rapide** (diamètre des tuyauteries d'eau glacée ou glycolée, repris de l'outil Excel « Hydraulique 80 lignes » : débit = P / (cp × ΔT), puis plus petit DN dont la perte de charge reste sous le seuil, frottement de Blasius).

## Installer sur iPhone / iPad

L'application est une PWA : une fois hébergée en HTTPS, elle s'installe comme une app et fonctionne hors ligne.

1. Ouvrir l'adresse du site dans **Safari**.
2. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Lancer Frigobilan depuis l'icône : plein écran, sans barre Safari, utilisable sans réseau.

Bon à savoir :
- Les projets sont enregistrés sur l'appareil. L'app installée a son **propre stockage**, distinct de Safari : pour récupérer des projets créés dans Safari, faire *Exporter tous les projets* dans Safari puis *Importer un fichier* dans l'app.
- Dans l'app installée, *Exporter* ouvre la feuille de partage (Enregistrer dans Fichiers, AirDrop, Mail…).
- Les mises à jour du site sont téléchargées en arrière-plan et s'affichent au lancement suivant.

## Développement

L'application se modifie dans `src/` puis se construit en un seul fichier :

```
npm install
npm run build      # → dist/frigobilan.html et frigobilan.html
npm test           # tests unitaires
npm run test:e2e   # test de bout en bout (Chromium)
```

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `src/frigobilan.html` | Source de l'application |
| `src/stations/` | Stations de vannes : données, nomenclature, implantation, schéma 2D, modèle et visionneuse 3D |
| `src/fonts/` | Police Mona Sans (licence SIL OFL) intégrée au fichier |
| `tools/build.mjs` | Construction du fichier unique |
| `dist/frigobilan.html` | Application construite, à télécharger |
| `frigobilan.html` | Même fichier, servi par GitHub Pages (ne pas modifier à la main) |
| `index.html` | Redirige la racine du site vers l'application |
| `manifest.webmanifest` | Nom, icônes et affichage de l'app installée |
| `sw.js` | Service worker : cache hors ligne (incrémenter `VERSION` pour forcer un rafraîchissement complet) |
| `icons/` | Icônes de l'app (`icon.svg` est la source des PNG) |
| `tests/`, `tools/smoke.mjs` | Tests |
