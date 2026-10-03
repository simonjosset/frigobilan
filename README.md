# frigobilan

Bilan frigorifique de chambre froide : une application web en un seul fichier (`frigobilan.html`).

## Installer sur iPhone / iPad

L'application est une PWA : une fois hébergée en HTTPS, elle s'installe comme une app et fonctionne hors ligne.

1. Ouvrir l'adresse du site dans **Safari**.
2. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Lancer Frigobilan depuis l'icône : plein écran, sans barre Safari, utilisable sans réseau.

Bon à savoir :
- Les projets sont enregistrés sur l'appareil. L'app installée a son **propre stockage**, distinct de Safari : pour récupérer des projets créés dans Safari, faire *Exporter tous les projets* dans Safari puis *Importer un fichier* dans l'app.
- Dans l'app installée, *Exporter* ouvre la feuille de partage (Enregistrer dans Fichiers, AirDrop, Mail…).
- Les mises à jour du site sont téléchargées en arrière-plan et s'affichent au lancement suivant.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `frigobilan.html` | L'application |
| `index.html` | Redirige la racine du site vers l'application |
| `manifest.webmanifest` | Nom, icônes et affichage de l'app installée |
| `sw.js` | Service worker : cache hors ligne (incrémenter `VERSION` pour forcer un rafraîchissement complet) |
| `icons/` | Icônes de l'app (`icon.svg` est la source des PNG) |
