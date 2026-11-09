# Foyer

Foyer donne un nouveau rôle à votre iPad : un tableau de bord mural pour votre maison, lisible depuis
l'autre bout de la pièce. Dix cadrans, des tuiles en verre dépoli sur un fond satiné, une touche par appareil.

Foyer est un petit programme qui tourne sur votre Home Assistant. L'iPad lui parle par votre réseau Wi-Fi ;
rien ne sort de chez vous et l'iPad ne reçoit jamais de jeton Home Assistant.

## Installation

1. Dans **Paramètres → Applications → Installer une application → ⋮ → Dépôts** (« Modules complémentaires »
   sur les anciennes versions), ajoutez `https://github.com/vallez44/foyer-addons`.
   Vous pouvez aussi copier le dossier `foyer` dans le dossier `addons` de Home Assistant (add-on local).
2. Rechargez la boutique (**⋮ → Rechercher des mises à jour**), ouvrez **Foyer**, puis **Installer**.
   Home Assistant construit l'image sur place (quelques minutes).
3. Activez **Afficher dans la barre latérale**, puis **Démarrer**.

## Sur l'iPad

**Le plus simple : par Home Assistant.** Ouvrez Home Assistant dans Safari, connectez-vous, touchez **Foyer**
dans la barre latérale. Home Assistant vérifie qui vous êtes ; Foyer ne voit jamais votre mot de passe.

**En plein écran (recommandé pour un iPad au mur).** Dans Foyer ouvert depuis la barre latérale, tirez vers le
bas depuis le haut de l'écran (Centre de contrôle) et touchez **Plein écran sur cet iPad**, ou allez dans
**Réglages → iPad → Ouvrir Foyer en plein écran**. Safari ouvre Foyer sur son propre port. Touchez
**Partager → Sur l'écran d'accueil → Ajouter**, puis ouvrez Foyer depuis sa nouvelle icône : il s'associe tout seul.

**Anciens iPad (ou écran sans compte Home Assistant).** Dans **Réglages → iPad → Créer une fiche
d'installation**, Foyer affiche une adresse (`http://<adresse-de-home-assistant>:8110`), un QR code et un code
valable une seule fois pendant 7 jours. Le journal de l'add-on affiche aussi un code au premier démarrage.
Sur l'iPad : ouvrez l'adresse dans Safari, ajoutez-la à l'écran d'accueil, ouvrez l'icône et tapez le code.

Pour que l'iPad reste allumé : **Réglages de l'iPad → Luminosité et affichage → Verrouillage automatique → Jamais**.
Foyer demande aussi à Safari de garder l'écran allumé quand c'est possible.

## Les cadrans

Glissez vers la gauche ou la droite pour passer d'un cadran à l'autre. Les cinq premiers sont actifs au départ ;
les autres s'activent dans **Réglages → Cadrans**.

| Cadran | Ce qu'il montre |
|---|---|
| Photos | Vos photos, avec l'heure en grand (derrière les personnes quand la photo a un masque). |
| Maison Modulaire Plus | Thermostat ou horloge, météo, photo, agenda, caméra ou pièces, scènes et appareils sur un écran. |
| Analogique | Une horloge géante, lisible de loin. |
| Maison Modulaire | Lumières, serrures, thermostat et scènes en grandes tuiles. |
| Flux | Un cadran calme pour la nuit : chaque forme est une pièce et brille quand ses lumières sont allumées. |
| Modulaire | Date, mois, musique en cours, soleil, horloge et météo. |
| Météo | La température en un seul grand chiffre, avec le lever du soleil, le vent et l'humidité. |
| Calendrier | La semaine et les événements du jour. |
| Horloge | L'heure, aussi grande que l'écran le permet. |
| Caméras | Vos caméras côte à côte. |

## Gestes

- **Toucher le haut d'une tuile** (l'icône) : allume, éteint, ouvre, ferme, lance la scène.
- **Toucher le nom** (bas de la tuile) ou **appui long** : la page complète (luminosité, position, couleur…).
- **Glisser vers le haut ou le bas sur une lumière**, un volet ou un ventilateur : règle le niveau.
- **Flèches du thermostat** : changent la consigne (envoyée une seconde après le dernier appui).
- **Tirer vers le bas depuis le haut** : le Centre de contrôle (musique, luminosité de l'écran, volume,
  première lumière, première serrure, une scène, Réglages).
- Une tuile **blanche** est allumée ; une tuile **rouge** demande votre attention (porte ouverte, serrure
  déverrouillée).

## Réglages

Ouvrez Foyer depuis la barre latérale puis **Réglages** (Centre de contrôle ou roue dentée) :

- **Cadrans** : lesquels, dans quel ordre, et celui de départ (étoile).
- **Disposition** : les tuiles de Maison Modulaire et Maison Modulaire Plus. Par défaut, Foyer les choisit à
  partir de vos pièces et appareils ; **Personnaliser** permet de choisir chaque tuile et sa taille
  (petite 1×1, large 2×1, haute 1×2, moyenne 2×2, grande 3×2, très grande 4×2).
- **Photos** : ajoutées depuis un téléphone ou un ordinateur, réduites avant l'envoi, rangées dans
  `/media/foyer/photos`.
- **iPad** : plein écran, fiche d'installation, écrans associés (renommer, retirer).
- **Options** : fond d'écran, style verre ou plat, mode nuit (horaires, cadran, assombrissement), météo,
  thermostat, enceinte et agendas utilisés, sécurité.

Foyer utilise les **pièces** de Home Assistant : donnez une pièce à vos appareils (Paramètres → Pièces).
Les entités masquées, de configuration ou de diagnostic sont laissées de côté.

## Sécurité et vie privée

- L'add-on se connecte à Home Assistant avec sa propre clé (fournie par le Superviseur), qui ne le quitte jamais.
- Les iPad associés n'ont qu'un cookie d'appareil, valable 90 jours après la dernière utilisation.
- Foyer refuse tout ce qui modifierait Home Assistant lui-même : modules, utilisateurs, sauvegardes, mises à
  jour, réglages, commandes. Les scripts et boutons ne peuvent être lancés que s'ils sont placés sur un cadran.
- Le port direct ne répond qu'aux adresses du réseau local (et Tailscale), et seulement aux noms connus
  (protection contre le « DNS rebinding »). Huit codes faux en cinq minutes bloquent cet appareil un moment.
- Option **Serrures, alarmes et portes de garage depuis Home Assistant uniquement** : les écrans associés les
  affichent mais ne peuvent ni déverrouiller, ni désarmer, ni ouvrir.
- Aucune connexion vers Internet, aucune licence, aucune statistique.

Ne redirigez pas le port 8110 depuis votre box Internet.

## Options de l'add-on

| Option | Rôle |
|---|---|
| `direct_access` | Active le port direct (8110) pour le plein écran et les anciens iPad. |
| `pairing_code` | Code fixe de 8 à 12 chiffres (le changer oublie tous les écrans). Vide : codes à usage unique. |
| `allowed_hosts` | Autres noms utilisés par les iPad, séparés par des virgules. |
| `sensitive_from_ha_only` | Serrures, alarmes et portes de garage depuis Home Assistant uniquement. |

## En cas de problème

- **« Home Assistant ne répond pas »** en bas de l'écran : regardez l'onglet **Journal** de l'add-on.
- **Une lumière manque** : donnez-lui une pièce dans Home Assistant ; vérifiez qu'elle n'est pas masquée.
- **L'iPad redemande le code** : associez-le depuis l'icône de l'écran d'accueil, pas dans Safari
  (une app d'écran d'accueil garde ses propres cookies).
- **L'adresse `.local` ne s'ouvre pas** : utilisez l'adresse IP de Home Assistant
  (Paramètres → Système → Réseau).

## Home Assistant sans add-ons (Container, Core)

Le dossier `standalone` contient un `docker-compose.yml` : Foyer tourne alors dans son propre conteneur à côté
de Home Assistant, avec un jeton longue durée dans `foyer.env`. Le premier écran associé (code du journal)
devient l'écran administrateur, qui seul peut ouvrir les Réglages.
