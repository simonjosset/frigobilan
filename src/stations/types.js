/* Catalogue des types de stations de vannes (eau et eau glycolée). Module pur.

   Chaque type décrit une topologie, dessinée et métrée automatiquement par layout.js :
   - levels : lignes horizontales de tuyauterie, ordonnée y en mètres (+ d × écart des dérivations) ;
     `ligne` sert au repérage (sortie, entree, boucle, chaud) ;
   - runs : tronçons horizontaux d'un niveau, de la colonne `from` (0 = raccordement batterie)
     à `to` (numéro de colonne ou "end" = raccordement réseau), sens de circulation `flow`
     (+1 vers la droite, −1 vers la batterie), `branche` pour la couleur, `label` en bout de ligne ;
   - verts : liaisons verticales entre deux niveaux, dans le sens de circulation (from → to) ;
   - slots : composants, sur un niveau (`level`, `col`) ou sur une verticale (`vert`, `t` de 0 à 1).
     `opt` : présent si l'option est cochée ; `act: "reg"` : actionneur TOR ou modulant selon l'option
     regMod ; `junction` : composant placé au croisement (vanne 3 voies), `port` : sa 3ᵉ voie ;
   `attach` : tronçon raccordé au corps d'un équipement (échangeur) et non à un autre tube ;
   - limite : colonne de la vanne de régulation, limite entre secondaire (batterie) et primaire (réseau).
   Les colonnes sont logiques : celles qui restent vides (options décochées) sont supprimées. */

export const OPTION_LABELS = {
  regMod: "Vanne de régulation modulante (sinon TOR)",
  isolBat: "Vannes d'isolement côté batterie",
  isolDeparts: "Vannes d'isolement sur les départs réseaux",
  filtreTor: "Filtre à tamis avant la vanne 2 voies TOR",
  vidange: "Vanne de vidange après le filtre",
  clapet: "Clapet anti-retour sur le by-pass (secours si le circulateur s'arrête)"
};

/* Remarques de conception affichées avec chaque type */
const N = {
  regRetour: "Vanne de régulation sur le retour : moins de givre autour de la vanne et moins de pertes de charge en entrée de batterie.",
  equil: "Vanne d'équilibrage : elle sert aussi d'isolement ; ne jamais orienter sa tête vers le bas (dépôt de limaille).",
  purges: "Purge au point le plus haut, vidange au point le plus bas de la station.",
  chaud: "Fluide chaud limité à 35 °C à l'entrée de la batterie froide (risque de vaporisation).",
  debitDeg: "Maintenir un débit minimal de dégivrage (à défaut, le débit froid nominal) pour bien répartir le chaud dans la batterie.",
  melange: "Dégivrage par mélange : fluides chaud et froid identiques, à la même concentration.",
  v3vL: "Vanne 3 voies de sélection chaud / froid à boisseau en L pour éviter le mélange.",
  pompe: "Circulateur à l'arrêt en froid, en marche pendant le dégivrage ; purgeur conseillé avant le démarrage.",
  echangeur: "Échangeur à plaques placé plus haut que la station de vannes."
};

export const TYPES_SDV = {
  /* ---------- Régulation simple, débit variable dans la batterie ---------- */
  "reg-v2v": {
    nom: "Régulation par vanne 2 voies", famille: "Régulation", primaire: "variable", secondaire: "variable",
    resume: "La plus simple et la plus économique : la vanne de régulation (TOR ou modulante) fait varier le débit dans la batterie.",
    usage: "Maintien en température, déshumidification sans contrainte de température de batterie.",
    reseaux: { A: "Réseau eau glacée" },
    options: { regMod: false, isolBat: false },
    levels: [{ id: "S", y: 0.6, ligne: "sortie" }, { id: "E", y: 0, ligne: "entree" }],
    runs: [
      { id: "S1", level: "S", from: 0, to: 4, flow: 1, branche: "commun" },
      { id: "S2", level: "S", from: 4, to: "end", flow: 1, branche: "A", label: "Retour {A}" },
      { id: "E2", level: "E", from: 4, to: "end", flow: -1, branche: "A", label: "Départ {A}" },
      { id: "E1", level: "E", from: 0, to: 4, flow: -1, branche: "commun" }
    ],
    verts: [],
    slots: [
      { key: "S-ISOB", type: "iso", level: "S", col: 1, opt: "isolBat", role: "Isolement côté batterie" },
      { key: "S-ISO", type: "iso", level: "S", col: 2, role: "Isolement de la station" },
      { key: "S-PUR", type: "purge", level: "S", col: 3, orient: "up", dn: 15, role: "Purge au point haut" },
      { key: "S-REG", type: "v2v_reg", level: "S", col: 4, act: "reg", role: "Régulation du débit primaire" },
      { key: "S-EQ", type: "ta", level: "S", col: 5, role: "Équilibrage du débit primaire (et isolement)" },
      { key: "E-ISOB", type: "iso", level: "E", col: 1, opt: "isolBat", role: "Isolement côté batterie" },
      { key: "E-ISO", type: "iso", level: "E", col: 2, role: "Isolement de la station" },
      { key: "E-VID", type: "purge", level: "E", col: 3, orient: "down", dn: 15, role: "Vidange au point bas" },
      { key: "E-FIL", type: "filtre", level: "E", col: 4, role: "Protection de la batterie et des vannes" },
      { key: "E-ISOR", type: "iso", level: "E", col: 5, role: "Isolement côté réseau" }
    ],
    limite: 4,
    notes: [N.regRetour, N.equil, N.purges]
  },

  "reg-v3v": {
    nom: "Régulation par vanne 3 voies", famille: "Régulation", primaire: "constant", secondaire: "variable",
    resume: "Débit constant côté réseau : la vanne 3 voies renvoie vers le retour la part non utilisée par la batterie, par un by-pass réglé.",
    usage: "Réseau primaire qui exige un débit constant (production sans variation de débit).",
    reseaux: { A: "Réseau eau glacée" },
    options: { regMod: false, isolBat: false },
    levels: [{ id: "S", y: 0.6, ligne: "sortie" }, { id: "E", y: 0, ligne: "entree" }],
    runs: [
      { id: "S1", level: "S", from: 0, to: 4, flow: 1, branche: "commun" },
      { id: "S2", level: "S", from: 4, to: "end", flow: 1, branche: "A", label: "Retour {A}" },
      { id: "E2", level: "E", from: 4, to: "end", flow: -1, branche: "A", label: "Départ {A}" },
      { id: "E1", level: "E", from: 0, to: 4, flow: -1, branche: "commun" }
    ],
    verts: [{ id: "BP", col: 4, from: "E", to: "S", branche: "A" }],
    slots: [
      { key: "S-ISOB", type: "iso", level: "S", col: 1, opt: "isolBat", role: "Isolement côté batterie" },
      { key: "S-ISO", type: "iso", level: "S", col: 2, role: "Isolement de la station" },
      { key: "S-PUR", type: "purge", level: "S", col: 3, orient: "up", dn: 15, role: "Purge au point haut" },
      { key: "S-V3V", type: "v3v_reg", level: "S", col: 4, act: "reg", junction: true, port: "down", role: "Régulation : mélange retour batterie et by-pass" },
      { key: "S-EQ", type: "ta", level: "S", col: 6, role: "Équilibrage du débit primaire (vanne 3 voies ouverte à 100 %)" },
      { key: "BP-SOU", type: "soupape", vert: "BP", t: 0.5, role: "Réglage du débit primaire en by-pass" },
      { key: "E-ISOB", type: "iso", level: "E", col: 1, opt: "isolBat", role: "Isolement côté batterie" },
      { key: "E-ISO", type: "iso", level: "E", col: 2, role: "Isolement de la station" },
      { key: "E-VID", type: "purge", level: "E", col: 3, orient: "down", dn: 15, role: "Vidange au point bas" },
      { key: "E-FIL", type: "filtre", level: "E", col: 5, role: "Protection de la batterie et des vannes" },
      { key: "E-ISOR", type: "iso", level: "E", col: 6, role: "Isolement côté réseau" }
    ],
    limite: 4,
    notes: [N.regRetour, N.equil, "Le by-pass peut avoir le diamètre de la vanne 3 voies s'il porte un robinet de réglage ; sinon, celui du réseau primaire.", N.purges]
  },

  /* ---------- Boucle à débit constant dans la batterie (circulateur) ---------- */
  "boucle-v2v": {
    nom: "Boucle à débit constant · vanne 2 voies", famille: "Boucle à débit constant", primaire: "variable", secondaire: "constant",
    resume: "Un circulateur garde le débit constant dans la batterie ; la vanne 2 voies dose l'apport du réseau, le reste est recyclé par le by-pass.",
    usage: "Maîtrise de la déshumidification ou de la température de batterie (batterie plus chaude que le réseau).",
    reseaux: { A: "Réseau eau glacée" },
    options: { regMod: true, clapet: false },
    levels: [{ id: "S", y: 0.6, ligne: "sortie" }, { id: "E", y: 0, ligne: "entree" }],
    runs: [
      { id: "S1", level: "S", from: 0, to: 5, flow: 1, branche: "commun" },
      { id: "S2", level: "S", from: 5, to: "end", flow: 1, branche: "A", label: "Retour {A}" },
      { id: "E2", level: "E", from: 4, to: "end", flow: -1, branche: "A", label: "Départ {A}" },
      { id: "E1", level: "E", from: 0, to: 4, flow: -1, branche: "commun" }
    ],
    verts: [{ id: "BP", col: 4, from: "S", to: "E", branche: "commun" }],
    slots: [
      { key: "S-EQS", type: "ta", level: "S", col: 1, role: "Équilibrage du débit secondaire (débit nominal batterie)" },
      { key: "S-PUR", type: "purge", level: "S", col: 2, orient: "up", dn: 15, role: "Purge au point haut" },
      { key: "S-REG", type: "v2v_reg", level: "S", col: 5, act: "reg", role: "Régulation de l'apport du réseau" },
      { key: "S-EQ", type: "ta", level: "S", col: 6, role: "Équilibrage du débit primaire (et isolement)" },
      { key: "BP-CLA", type: "clapet", vert: "BP", t: 0.3, opt: "clapet", role: "Secours : alimente la batterie si le circulateur s'arrête" },
      { key: "BP-SOU", type: "soupape", vert: "BP", t: 0.68, role: "Réglage du by-pass (température d'entrée batterie)" },
      { key: "E-ISO", type: "iso", level: "E", col: 1, role: "Isolement côté batterie" },
      { key: "E-SON", type: "sonde", level: "E", col: 2, orient: "up", role: "Sonde de température de boucle (limite l'ouverture de la régulation)" },
      { key: "E-POM", type: "pompe", level: "E", col: 3, role: "Débit constant dans la batterie" },
      { key: "E-VID", type: "purge", level: "E", col: 5, orient: "down", dn: 15, role: "Vidange au point bas" },
      { key: "E-FIL", type: "filtre", level: "E", col: 6, role: "Protection de la batterie et des vannes" },
      { key: "E-ISOR", type: "iso", level: "E", col: 7, role: "Isolement côté réseau" }
    ],
    limite: 5,
    notes: ["Débit secondaire supérieur au débit primaire : la température d'entrée batterie ne peut pas égaler celle du réseau.", "Vanne de régulation sur le retour : pression suffisante à l'aspiration du circulateur.", N.equil, N.purges]
  },

  "boucle-v3v": {
    nom: "Boucle à débit constant · vanne 3 voies", famille: "Boucle à débit constant", primaire: "variable", secondaire: "constant",
    resume: "Circulateur de boucle et vanne 3 voies montée en diviseuse : débit constant dans la batterie, entrée batterie jusqu'à la température du réseau.",
    usage: "Débit constant sur la batterie avec la possibilité d'utiliser toute la puissance du réseau.",
    reseaux: { A: "Réseau eau glacée" },
    options: { regMod: true },
    levels: [{ id: "S", y: 0.6, ligne: "sortie" }, { id: "E", y: 0, ligne: "entree" }],
    runs: [
      { id: "S1", level: "S", from: 0, to: 4, flow: 1, branche: "commun" },
      { id: "S2", level: "S", from: 4, to: "end", flow: 1, branche: "A", label: "Retour {A}" },
      { id: "E2", level: "E", from: 4, to: "end", flow: -1, branche: "A", label: "Départ {A}" },
      { id: "E1", level: "E", from: 0, to: 4, flow: -1, branche: "commun" }
    ],
    verts: [{ id: "BP", col: 4, from: "S", to: "E", branche: "commun" }],
    slots: [
      { key: "S-ISO", type: "iso", level: "S", col: 1, role: "Isolement côté batterie" },
      { key: "S-PUR", type: "purge", level: "S", col: 2, orient: "up", dn: 15, role: "Purge au point haut" },
      { key: "S-V3V", type: "v3v_reg", level: "S", col: 4, act: "reg", junction: true, port: "down", role: "Régulation, montée en diviseuse (couple moteur selon la ΔP)" },
      { key: "S-EQ", type: "ta", level: "S", col: 6, role: "Équilibrage du débit primaire (et isolement)" },
      { key: "E-ISO", type: "iso", level: "E", col: 1, role: "Isolement côté batterie" },
      { key: "E-SON", type: "sonde", level: "E", col: 2, orient: "up", role: "Sonde de température de boucle" },
      { key: "E-POM", type: "pompe", level: "E", col: 3, role: "Débit constant dans la batterie" },
      { key: "E-VID", type: "purge", level: "E", col: 5, orient: "down", dn: 15, role: "Vidange au point bas" },
      { key: "E-FIL", type: "filtre", level: "E", col: 6, role: "Protection de la batterie et des vannes" },
      { key: "E-ISOR", type: "iso", level: "E", col: 7, role: "Isolement côté réseau" }
    ],
    limite: 4,
    notes: ["Permet à la fois un débit constant dans la batterie et une entrée batterie à la température du réseau.", N.equil, N.purges]
  },

  /* ---------- Dégivrage ---------- */
  "glycol-tor": {
    nom: "Dégivrage par mélange · vanne 3 voies TOR", famille: "Dégivrage", primaire: "variable", secondaire: "variable",
    resume: "Deux réseaux (froid et chaud de dégivrage) : la vanne 3 voies TOR choisit l'arrivée, chaque réseau a son retour (régulé pour le froid, TOR pour le chaud).",
    usage: "Batterie froide dégivrée par le fluide chaud du même réseau glycolé (ou batterie réversible chaud / froid).",
    reseaux: { A: "Réseau froid", B: "Réseau chaud (dégivrage)" },
    options: { isolDeparts: true, filtreTor: false, vidange: true },
    levels: [
      { id: "SB", y: 0.6, d: 1, ligne: "sortie" }, { id: "S", y: 0.6, ligne: "sortie" },
      { id: "E", y: 0, ligne: "entree" }, { id: "EB", y: 0, d: -1, ligne: "entree" }
    ],
    runs: [
      { id: "S1", level: "S", from: 0, to: 3, flow: 1, branche: "commun" },
      { id: "S2", level: "S", from: 3, to: "end", flow: 1, branche: "A", label: "Retour {A}" },
      { id: "SB", level: "SB", from: 3, to: "end", flow: 1, branche: "B", label: "Retour {B}" },
      { id: "E2", level: "E", from: 5, to: "end", flow: -1, branche: "A", label: "Départ {A}" },
      { id: "EB", level: "EB", from: 5, to: "end", flow: -1, branche: "B", label: "Départ {B}" },
      { id: "E1", level: "E", from: 0, to: 5, flow: -1, branche: "commun" }
    ],
    verts: [{ id: "SB-v", col: 3, from: "S", to: "SB", branche: "B" }, { id: "EB-v", col: 5, from: "EB", to: "E", branche: "B" }],
    slots: [
      { key: "S-ISO", type: "iso", level: "S", col: 1, role: "Isolement sortie batterie" },
      { key: "S-PUR", type: "purge", level: "S", col: 2, orient: "up", dn: 15, role: "Purge en point haut" },
      { key: "A-V2M", type: "v2v_mod", level: "S", col: 4, role: "Régulation du retour réseau A" },
      { key: "A-ISO", type: "iso", level: "S", col: 7, opt: "isolDeparts", role: "Isolement retour réseau A" },
      { key: "B-FIL", type: "filtre", level: "SB", col: 4, opt: "filtreTor", role: "Filtre avant la vanne TOR" },
      { key: "B-V2T", type: "v2v_tor", level: "SB", col: 5, role: "Ouverture / fermeture du retour réseau B" },
      { key: "B-TA", type: "ta", level: "SB", col: 6, role: "Équilibrage du réseau B" },
      { key: "E-ISO", type: "iso", level: "E", col: 1, role: "Isolement entrée batterie" },
      { key: "E-PUR", type: "purge", level: "E", col: 2, orient: "up", dn: 15, role: "Purge en point haut" },
      { key: "E-FIL", type: "filtre", level: "E", col: 3, role: "Filtre entrée batterie" },
      { key: "E-VID", type: "purge", level: "E", col: 4, orient: "down", dn: 15, opt: "vidange", role: "Vidange" },
      { key: "E-V3V", type: "v3v_tor", level: "E", col: 5, junction: true, port: "down", role: "Sélection réseau A / réseau B" },
      { key: "A-ISOE", type: "iso", level: "E", col: 7, opt: "isolDeparts", role: "Isolement départ réseau A" },
      { key: "B-ISOE", type: "iso", level: "EB", col: 7, opt: "isolDeparts", role: "Isolement départ réseau B" }
    ],
    notes: [N.melange, N.chaud, N.v3vL, N.debitDeg]
  },

  "deg-electrique": {
    nom: "Dégivrage électrique · thermoplongeur", famille: "Dégivrage", primaire: "variable", secondaire: "variable",
    resume: "En froid, régulation par vanne 2 voies ; en dégivrage, la vanne se ferme et un circulateur fait tourner le fluide de la batterie dans un thermoplongeur.",
    usage: "Pas de réseau chaud disponible : dégivrage autonome par résistances électriques.",
    reseaux: { A: "Réseau eau glacée" },
    options: { regMod: false },
    levels: [{ id: "S", y: 0.9, ligne: "sortie" }, { id: "M", y: 0.45, ligne: "boucle" }, { id: "E", y: 0, ligne: "entree" }],
    runs: [
      { id: "S1", level: "S", from: 0, to: 10, flow: 1, branche: "commun" },
      { id: "S2", level: "S", from: 10, to: "end", flow: 1, branche: "A", label: "Retour {A}" },
      { id: "M", level: "M", from: 4, to: 9, flow: 1, branche: "B" },
      { id: "E2", level: "E", from: 10, to: "end", flow: -1, branche: "A", label: "Départ {A}" },
      { id: "E1", level: "E", from: 0, to: 10, flow: -1, branche: "commun" }
    ],
    verts: [{ id: "V1", col: 4, from: "S", to: "M", branche: "B" }, { id: "V2", col: 9, from: "M", to: "E", branche: "B" }],
    slots: [
      { key: "S-ISO", type: "iso", level: "S", col: 1, role: "Isolement côté batterie" },
      { key: "S-SON", type: "sonde", level: "S", col: 2, orient: "up", role: "Sonde de régulation de la température de dégivrage" },
      { key: "S-PUR", type: "purge", level: "S", col: 3, orient: "up", dn: 15, role: "Purge au point haut" },
      { key: "S-REG", type: "v2v_reg", level: "S", col: 10, act: "reg", role: "Régulation froid, fermée en dégivrage (sur le retour)" },
      { key: "S-EQ", type: "ta", level: "S", col: 11, role: "Équilibrage du débit primaire (et isolement)" },
      { key: "M-POM", type: "pompe", level: "M", col: 5, role: "Circulation en dégivrage (à l'arrêt en froid)" },
      { key: "M-THE", type: "thermo", level: "M", col: 6, role: "Réchauffage du fluide, thermostat de sécurité" },
      { key: "M-CLA", type: "clapet", level: "M", col: 7, role: "Empêche le passage du fluide froid dans la boucle" },
      { key: "M-EQ", type: "ta", level: "M", col: 8, role: "Équilibrage du débit de dégivrage" },
      { key: "E-ISO", type: "iso", level: "E", col: 1, role: "Isolement côté batterie" },
      { key: "E-VID", type: "purge", level: "E", col: 2, orient: "down", dn: 15, role: "Vidange au point bas" },
      { key: "E-FIL", type: "filtre", level: "E", col: 11, role: "Protection de la batterie et des vannes" },
      { key: "E-ISOR", type: "iso", level: "E", col: 12, role: "Isolement côté réseau" }
    ],
    limite: 10,
    notes: [N.chaud, "Thermoplongeur hors du point haut, avec un purgeur automatique.", N.debitDeg, N.equil]
  },

  "deg-echangeur": {
    nom: "Dégivrage par échangeur · sans mélange", famille: "Dégivrage", primaire: "variable", secondaire: "variable",
    resume: "Le réseau chaud cède sa chaleur par un échangeur à plaques à une boucle de dégivrage : les fluides chaud et froid ne se mélangent jamais.",
    usage: "Réseau chaud de nature ou de concentration différente du réseau froid (eau chaude, autre glycol).",
    reseaux: { A: "Réseau froid", B: "Réseau chaud" },
    options: { regMod: false },
    levels: [
      { id: "S", y: 1.0, ligne: "sortie" }, { id: "HR", y: 0.64, ligne: "chaud" }, { id: "M", y: 0.5, ligne: "boucle" },
      { id: "HD", y: 0.36, ligne: "chaud" }, { id: "E", y: 0, ligne: "entree" }
    ],
    runs: [
      { id: "S1", level: "S", from: 0, to: 10, flow: 1, branche: "commun" },
      { id: "S2", level: "S", from: 10, to: "end", flow: 1, branche: "A", label: "Retour {A}" },
      { id: "M", level: "M", from: 3, to: 7, flow: 1, branche: "B" },
      { id: "HR", level: "HR", from: 7.42, to: "end", flow: 1, branche: "C", label: "Retour {B}", attach: "M-ECH" },
      { id: "HD", level: "HD", from: 7.42, to: "end", flow: -1, branche: "C", label: "Départ {B}", attach: "M-ECH" },
      { id: "E2", level: "E", from: 10, to: "end", flow: -1, branche: "A", label: "Départ {A}" },
      { id: "E1", level: "E", from: 0, to: 10, flow: -1, branche: "commun" }
    ],
    verts: [{ id: "V1", col: 3, from: "S", to: "M", branche: "B" }, { id: "V2", col: 7, from: "M", to: "E", branche: "B" }],
    slots: [
      { key: "S-ISO", type: "iso", level: "S", col: 1, role: "Isolement côté batterie" },
      { key: "S-PUR", type: "purge", level: "S", col: 2, orient: "up", dn: 15, role: "Purge au point haut" },
      { key: "S-REG", type: "v2v_reg", level: "S", col: 10, act: "reg", role: "Régulation froid, fermée en dégivrage (sur le retour)" },
      { key: "S-EQ", type: "ta", level: "S", col: 11, role: "Équilibrage du débit primaire froid (et isolement)" },
      { key: "M-POM", type: "pompe", level: "M", col: 4, role: "Circulation en dégivrage (à l'arrêt en froid)" },
      { key: "M-CLA", type: "clapet", level: "M", col: 5, role: "Empêche le passage du fluide froid dans la boucle" },
      { key: "M-EQ", type: "ta", level: "M", col: 6, role: "Équilibrage du débit de dégivrage côté boucle" },
      { key: "M-ECH", type: "echangeur", level: "M", col: 7, junction: true, role: "Échangeur à plaques (puissance selon temps et température de dégivrage)" },
      { key: "C-V2T", type: "v2v_tor", level: "HR", col: 8, role: "Marche dégivrage : ouverte pendant le dégivrage" },
      { key: "C-EQ", type: "ta", level: "HR", col: 9, role: "Équilibrage du débit côté chaud" },
      { key: "C-ISOR", type: "iso", level: "HR", col: 11, role: "Isolement retour chaud" },
      { key: "C-VID", type: "purge", level: "HD", col: 8, orient: "down", dn: 15, role: "Vidange du circuit chaud" },
      { key: "C-FIL", type: "filtre", level: "HD", col: 9, role: "Protection de l'échangeur" },
      { key: "C-ISOD", type: "iso", level: "HD", col: 11, role: "Isolement départ chaud" },
      { key: "E-ISO", type: "iso", level: "E", col: 1, role: "Isolement côté batterie" },
      { key: "E-VID", type: "purge", level: "E", col: 2, orient: "down", dn: 15, role: "Vidange au point bas" },
      { key: "E-FIL", type: "filtre", level: "E", col: 11, role: "Protection de la batterie et des vannes" },
      { key: "E-ISOR", type: "iso", level: "E", col: 12, role: "Isolement côté réseau" }
    ],
    limite: 10,
    notes: [N.echangeur, N.chaud, N.pompe, N.debitDeg]
  }
};

export const TYPE_DEFAUT = "glycol-tor";
export const FAMILLES = ["Régulation", "Boucle à débit constant", "Dégivrage"];

export function typeOf(station) { return TYPES_SDV[station && station.type] || TYPES_SDV[TYPE_DEFAUT]; }
