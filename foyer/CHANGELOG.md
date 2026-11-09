# Changelog

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
