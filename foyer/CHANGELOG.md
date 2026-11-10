# Changelog

## 0.4.1

- Le menu d'une alarme ne propose que les modes qu'elle accepte (avec Alarmo : ceux activés dans ses réglages),
  « Absence » en premier.

## 0.4.0

- **Verre clair, comme le Liquid Glass d'iOS** : les tuiles éteintes laissent voir le fond d'écran (peu de flou,
  liseré lumineux, reflet). Réglages → Affichage → Style : Verre, Dépoli (l'ancien rendu) ou Plat.
- **Icônes** plus grandes et plus pleines ; une lampe de chevet dessinée pour Foyer ; une baie vitrée s'affiche
  en porte coulissante.
- **Alarme sur l'iPad** : compte à rebours d'armement (avec Annuler), clavier et compte à rebours à l'entrée,
  plein écran rouge et sirène quand elle se déclenche (Réglages → Alarme). Une alarme qui demande son code peut
  être désarmée au clavier de l'iPad.
- **Tuile Énergie** : consommation et coût de la veille (Linky, tableau de bord Énergie), total du mois,
  7 derniers jours ; puissance en direct dès qu'un compteur la donne.
- Réglages → Capteurs des HomePod liste les mesures des pièces.

## 0.3.1

- **Apple Music sur les HomePod avec Music Assistant** : Foyer réunit chaque HomePod et son double Music
  Assistant (même adresse MAC). Une seule enceinte par HomePod, dans sa pièce, qui montre ce qui joue (Siri,
  l'iPhone ou Foyer) ; Apple Music et la bibliothèque passent par Music Assistant, les boutons vont à ce qui joue.
- **Recherche dans l'app Musique** (artistes, morceaux, albums, playlists), quand l'enceinte sait chercher.
  Une ligne s'ouvre, le bouton rouge lance la lecture. Les titres de la bibliothèque sont en français.
- **Parcourir** ne montre plus les caméras, images et voix de synthèse (rien à jouer sur une enceinte).
- **Réglages → Musique** : comment relier Apple Music dans Music Assistant, et un lien pour l'ouvrir.
- Les enceintes indisponibles (Mac, Apple TV pas encore associée) ne s'affichent plus dans l'app Musique.

## 0.3.0

- **Réglages dans Foyer, comme ceux de l'iPad** : liste à gauche avec icônes de couleur, page à droite, menus
  déroulants, interrupteurs, recherche ; clairs ou sombres selon l'iPad. Ouverts depuis le Centre de contrôle ou
  l'icône Réglages, sur tous les écrans (les réglages des écrans associés et de la sécurité restent réservés).
- **Apps** : balayez vers le haut depuis le bas d'un cadran. Musique, Calendrier, Rappels, Météo, Photos,
  Minuteurs, Horloge mondiale, Home Assistant, Réglages, et sur iPad les apps d'Apple (Musique, Calendrier,
  Rappels, Podcasts, TV, Localiser, Raccourcis, Plans…). Réglages → Apps : ouvrir l'app de Foyer ou celle d'Apple.
- **Musique sur les HomePod** : choisir le HomePod, lecture, volume, et parcourir radios et médias de Home
  Assistant ; playlists Apple Music avec Music Assistant, ou par l'app Musique d'Apple (AirPlay).
- **Agenda et rappels** : nouvel événement (iCloud par CalDAV, donc aussi sur l'iPhone), listes de rappels
  (ajouter, cocher), agenda par défaut.
- **Température et humidité des HomePod** : capteurs par pièce alimentés par une automatisation de l'app Maison
  (voir la documentation).
- **Tablette Android** : manifeste d'application web (Chrome → Installer l'application), documentation Fully Kiosk.
- Tuiles : effet verre plus marqué avec reflet, icônes pleines ; déplacement des tuiles corrigé (la tuile va
  exactement où on la lâche, les autres se décalent sans sauter).
- Étiquette **Masquer dans Foyer** pour écarter une entité des écrans.

## 0.2.0

- **Disposer les tuiles directement sur l'écran** : maintenez une tuile (ou Centre de contrôle → Modifier la
  disposition), puis glissez pour déplacer, touchez pour choisir la taille (S, W, M, L) ou changer ce qu'elle montre (⇄),
  « − » pour retirer, « + » pour ajouter, Personnaliser pour le fond d'écran, OK pour enregistrer pour tous les écrans.
- Un déplacement ou un agrandissement qui ferait sortir une tuile de l'écran est refusé.
- Les écrans associés peuvent enregistrer la disposition ; les scripts et boutons restent réservés à Home Assistant.
- Les tuiles qui ne tenaient pas sur l'écran sont retirées de la disposition quand vous la modifiez.

## 0.1.1

- Correction : l'add-on s'arrêtait au démarrage (« s6-overlay-suexec: fatal: can only run as pid 1 »).
  L'image était construite sur l'image de base de Home Assistant au lieu de l'image Node.js officielle ;
  elle est désormais fixée dans le Dockerfile.

## 0.1.0

Première version.

- Add-on Home Assistant avec ingress (barre latérale) et port direct 8110 pour le plein écran.
- Passerelle sécurisée : l'iPad ne reçoit jamais de jeton Home Assistant ; seules les actions d'un tableau de
  bord passent (allumer, ouvrir, verrouiller, scènes…), avec des champs vérifiés.
- Appairage des écrans : code au démarrage dans le journal, fiches d'installation (code à usage unique 7 jours,
  QR code), « plein écran sur cet iPad », liste des écrans (renommer, retirer), expiration après 90 jours.
- 10 cadrans, disposition suggérée à partir des pièces et appareils, ou personnalisée.
- Pages : lumière, interrupteur, ventilateur, volet, serrure, alarme, thermostat, musique, caméra, pièce,
  maison, météo, agenda.
- Centre de contrôle, mode nuit, assombrissement, retour au cadran de départ.
- Photos stockées dans `/media/foyer/photos`.
- Maison de démonstration (`FOYER_DEMO=1`) et variante Docker autonome.
