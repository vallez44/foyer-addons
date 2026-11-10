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
**Réglages → Écran d'accueil et autres iPad**. Safari ouvre Foyer sur son propre port. Touchez
**Partager → Sur l'écran d'accueil → Ajouter**, puis ouvrez Foyer depuis sa nouvelle icône : il s'associe tout seul.

**Anciens iPad, tablette Android, écran sans compte Home Assistant.** Dans **Réglages → Écran d'accueil et autres
iPad → Créer une fiche d'installation**, Foyer affiche une adresse (`http://<adresse-de-home-assistant>:8110`), un QR code et un code
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
- **Toucher le nom** (bas de la tuile) : la page complète (luminosité, position, couleur…).
- **Glisser vers le haut ou le bas sur une lumière**, un volet ou un ventilateur : règle le niveau.
- **Flèches du thermostat** : changent la consigne (envoyée une seconde après le dernier appui).
- **Tirer vers le bas depuis le haut** : le Centre de contrôle (musique, luminosité de l'écran, volume,
  première lumière, première serrure, une scène, Apps, Réglages).
- **Balayer vers le haut depuis le bas d'un cadran** : les Apps (voir plus bas).
- Une tuile **blanche** est allumée ; une tuile **rouge** demande votre attention (porte ouverte, serrure
  déverrouillée).

## Disposer les tuiles directement sur l'écran

Sur Maison Modulaire et Maison Modulaire Plus, **maintenez une tuile environ une seconde** (ou Centre de contrôle →
**Modifier la disposition**). Les tuiles se mettent à trembler :

- **glissez** une tuile pour la déplacer (sans lever le doigt après l'appui long, ou ensuite) ;
- **touchez** une tuile pour choisir sa taille : **S** (1×1), **W** (2×1), **M** (2×2), **L** (3×2), ou **⇄** pour changer
  ce qu'elle montre ;
- **−** retire la tuile, **+** en ajoute une (widgets, pièces, appareils de chaque pièce) ;
- **Personnaliser** change le fond d'écran ou revient à la suggestion automatique ;
- **OK** enregistre la disposition, pour tous les écrans (et l'onglet Disposition des Réglages).

Foyer refuse un déplacement ou un agrandissement qui ferait sortir une tuile de l'écran. Les scripts et boutons ne
peuvent être ajoutés que depuis Home Assistant (barre latérale), car ils peuvent tout exécuter.

## Réglages

Les Réglages s'ouvrent dans Foyer, comme l'app Réglages de l'iPad (clairs ou sombres selon l'iPad) :
Centre de contrôle → **Réglages**, ou l'icône **Réglages** des Apps. À gauche la liste, à droite la page choisie
(en portrait sur un petit iPad, une page à la fois). Touchez une valeur suivie de ⌃⌄ pour choisir dans un menu.

- **Home Assistant** : l'état de la connexion, et un lien pour ouvrir Home Assistant.
- **Écran d'accueil et autres iPad** *(Home Assistant ou premier écran)* : Foyer en plein écran sur cet iPad,
  fiche d'installation (adresse, QR code, code à usage unique) pour un autre iPad ou une tablette Android.
- **Écrans associés** *(idem)* : renommer, retirer.
- **Cadrans** : lesquels, dans quel ordre, et celui de départ.
- **Photos** : ajoutées depuis l'iPad, un téléphone ou un ordinateur, réduites avant l'envoi, rangées dans
  `/media/foyer/photos`.
- **Affichage et nuit** : fond d'écran, verre ou plat, luminosité de cet écran, mode nuit (horaires, cadran,
  assombrissement), retour au cadran de départ, langue.
- **Apps**, **Musique**, **Agenda et rappels**, **Capteurs des HomePod** : voir les parties suivantes.
- **Sécurité** *(Home Assistant ou premier écran)*, **À propos**, **Confidentialité**.

La disposition des tuiles se règle directement sur l'écran (partie précédente). Foyer utilise les **pièces** de
Home Assistant : donnez une pièce à vos appareils (Paramètres → Pièces). Les entités masquées, de configuration ou
de diagnostic sont laissées de côté, comme celles qui portent l'étiquette **Masquer dans Foyer**.

## Apps

Balayez vers le haut depuis le bas d'un cadran (ou Centre de contrôle → **Apps**) : un écran d'accueil s'ouvre.

- **Les apps de Foyer** : Maison, Musique, Calendrier, Rappels, Météo, Photos, Minuteurs (ils sonnent sur cet
  écran), Horloge mondiale, Home Assistant, Réglages.
- **Les apps d'Apple**, sur iPad : Maison, Musique, Calendrier, Rappels, Météo, Photos, Minuteurs, Alarmes,
  Horloge mondiale, Podcasts, News, Livres, TV, Safari, Localiser, Raccourcis, Plans.

**Réglages → Apps** choisit, pour chaque app qui existe des deux côtés, si l'icône ouvre celle de Foyer ou
**celle d'Apple** (Musique ouvre celle d'Apple par défaut), et les icônes à montrer. L'app d'Apple prend tout
l'écran ; balayez vers le haut pour revenir à Foyer. Avec l'Accès guidé, les apps d'Apple ne s'ouvrent pas.

## Musique et HomePod

Les HomePod et l'Apple TV arrivent dans Home Assistant par l'intégration **Apple TV** (une entité « lecteur
multimédia » par HomePod). Foyer les montre dans le Centre de contrôle, sur les tuiles Musique et dans l'app
**Musique** : choisir le HomePod, lecture/pause, morceau précédent/suivant, volume, et **Parcourir** ce que
Home Assistant sait lui envoyer (radios de Radio Browser, médias locaux…).

**Apple Music sur les HomePod, depuis Foyer : Music Assistant.** Apple ne permet pas à Home Assistant de
lancer Apple Music sur un HomePod. **Music Assistant** (application de Home Assistant) le fait : il lit
Apple Music et l'envoie aux HomePod par AirPlay.

1. **Paramètres → Applications → Magasin d'applications → Music Assistant → Installer**, puis **Démarrer** (cochez aussi
   *Chien de garde* et *Afficher dans la barre latérale*). Home Assistant propose ensuite l'intégration
   **Music Assistant** : **Configurer**. Vos HomePod y apparaissent tout seuls (fournisseur AirPlay).
2. **Apple Music** (abonnement nécessaire) : ouvrez Music Assistant **à son adresse directe**
   `http://<adresse-de-home-assistant>:8095` (Réglages → Musique → *Ouvrir Music Assistant* dans Foyer),
   **Se connecter avec Home Assistant**, puis **Paramètres → Music sources → + → Apple Music →
   Authenticate with Apple Music**, et connectez-vous avec votre identifiant Apple. La connexion dure 6 mois.
   (Depuis la barre latérale de Home Assistant, Apple ne sait pas revenir à Music Assistant : passez bien
   par le port 8095.)
3. **Dans l'app Maison** : *Réglages de la maison → Haut-parleurs et TV* → autorisez l'accès à **tout le
   monde sur ce réseau** (pas seulement aux membres de la maison), sinon Music Assistant ne peut pas jouer
   sur les HomePod.

Foyer **réunit chaque HomePod et son double Music Assistant** (ils ont la même adresse MAC) : une seule
enceinte dans sa pièce, qui affiche ce qui joue (Siri, l'iPhone ou Apple Music lancé depuis Foyer). L'app
**Musique** de Foyer gagne une **recherche** (artistes, morceaux, albums, playlists d'Apple Music et de votre
bibliothèque) ; touchez une ligne pour l'ouvrir, le bouton rouge pour la lancer. Limites de Music Assistant :
qualité AAC 256 kbit/s (pas de Lossless ni de Dolby Atmos) et lecture non officielle pour Apple.

Sans Music Assistant, l'**app Musique d'Apple** sur l'iPad (Apps → Musique) reste possible : choisissez la
sortie AirPlay (le HomePod) dans l'app ; Foyer affiche ensuite le morceau en cours et le pilote.

**Réglages → Musique** choisit l'enceinte par défaut et indique ce qui est disponible.

## Agenda et rappels (avec l'iPhone)

Foyer lit les agendas de Home Assistant. Pour vos agendas **iCloud**, ajoutez l'intégration **CalDAV**
(`https://caldav.icloud.com`, identifiant Apple et **mot de passe pour app** créé sur account.apple.com) :
un événement ajouté dans Foyer (bouton **+** de la page Agenda, ou Réglages → Agenda et rappels → Nouvel
événement) est écrit dans iCloud et apparaît sur l'iPhone, et inversement.

L'app **Rappels** de Foyer montre les listes de Home Assistant (dont la liste de courses) : ajouter, cocher.
**Réglages → Agenda et rappels** choisit les agendas affichés et celui des nouveaux événements.

## Température et humidité des HomePod

Les HomePod (et HomePod mini) mesurent la température et l'humidité, mais Apple ne les partage qu'avec l'app
Maison. On les fait passer par une automatisation de l'app Maison, exécutée par le HomePod lui-même :

1. **Dans Home Assistant**, il faut :
   - pour chaque pièce, deux valeurs texte masquées (*Foyer HomePod Chambre température*, …) et deux capteurs
     **Température Chambre** / **Humidité Chambre** (modèles, rangés dans la pièce) ;
   - un interrupteur **Foyer relevé HomePod** (modèle, sans état), visible dans l'app Maison grâce au pont
     HomeKit (domaine `switch`), et une automatisation qui l'allume toutes les 15 minutes ;
   - une automatisation **Foyer – mesures des HomePod** déclenchée par un **webhook local** (voir le YAML
     ci-dessous ; remplacez l'identifiant par une longue suite de caractères au hasard).
2. **Dans l'app Maison d'Apple, sur l'iPhone ou l'iPad.** L'adresse du webhook ne se tape pas dans l'app
   Maison elle-même : elle va dans le **raccourci** de l'automatisation, qui n'apparaît qu'après **Convertir en
   raccourci**. L'interrupteur *Foyer relevé HomePod* n'est visible dans l'app Maison qu'une fois le pont
   HomeKit rechargé (Paramètres → Appareils et services → HomeKit Bridge → ⋮ → Recharger).
   **Automatisation → + → Un accessoire est contrôlé → Foyer relevé HomePod → S'allume → Suivant**, puis tout
   en bas **Convertir en raccourci** :
   - ajoutez l'action **Obtenir l'état de** (Maison) pour chaque mesure : capteur de température du HomePod de
     la chambre → *Température actuelle*, capteur d'humidité → *Humidité relative actuelle*, et ainsi de suite ;
   - ajoutez **Obtenir le contenu de l'URL** : l'adresse du webhook
     (`http://<adresse-de-home-assistant>:8123/api/webhook/<identifiant>`), **Méthode POST**, **Corps de la
     requête JSON**, un champ **Nombre** par mesure : `chambre_t`, `chambre_h`, `sdb_t`, `sdb_h`, `salon_t`,
     `salon_h` ;
   - **OK**. Les mesures arrivent au plus tard 15 minutes après, et s'affichent dans les pièces de Foyer.

Le webhook n'accepte que le réseau local. Un champ absent ou illisible est ignoré.

```yaml
alias: Foyer – mesures des HomePod
mode: queued
triggers:
  - trigger: webhook
    webhook_id: foyer_homepods_REMPLACEZ_PAR_UNE_LONGUE_SUITE_AU_HASARD
    allowed_methods: [POST, PUT]
    local_only: true
actions:
  - variables:
      payload: "{{ trigger.json if trigger.json is defined and trigger.json is mapping else {} }}"
      targets:
        - { key: chambre_t, entity: input_text.foyer_homepod_chambre_temperature }
        - { key: chambre_h, entity: input_text.foyer_homepod_chambre_humidite }
        - { key: sdb_t, entity: input_text.foyer_homepod_salle_de_bain_temperature }
        - { key: sdb_h, entity: input_text.foyer_homepod_salle_de_bain_humidite }
        - { key: salon_t, entity: input_text.foyer_homepod_salon_temperature }
        - { key: salon_h, entity: input_text.foyer_homepod_salon_humidite }
  - repeat:
      for_each: "{{ targets }}"
      sequence:
        - variables:
            found: >-
              {% set raw = payload.get(repeat.item.key) %}{% set m = ((raw if raw is not none else '')
              | string | replace(',', '.')) | regex_findall('-?[0-9]+(?:[.][0-9]+)?') %}{{ (m[0] | float
              | round(1)) if m | count > 0 else '' }}
        - if:
            - condition: template
              value_template: "{{ found | string | length > 0 }}"
          then:
            - action: input_text.set_value
              target: { entity_id: "{{ repeat.item.entity }}" }
              data: { value: "{{ found }}" }
              continue_on_error: true
```

## Tablette Android

Foyer est une page web : il fonctionne aussi sur une tablette Android, avec **Chrome** ou, pour un écran mural,
**Fully Kiosk Browser**.

1. Créez une fiche d'installation (Réglages → Écran d'accueil et autres iPad) et ouvrez l'adresse
   `http://<adresse-de-home-assistant>:8110` sur la tablette (ou scannez le QR code), puis tapez le code.
2. Dans Chrome : **⋮ → Ajouter à l'écran d'accueil** (ou **Installer l'application**) : Foyer s'ouvre ensuite en
   plein écran depuis son icône. Dans Fully Kiosk : mettez l'adresse en page de démarrage et activez
   « Garder l'écran allumé ».

Tout fonctionne de la même façon (cadrans, tuiles, musique sur les HomePod par Home Assistant, agenda, rappels,
minuteurs), sauf les raccourcis vers les apps d'Apple, qui n'existent que sur iPad et iPhone.

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
devient l'écran administrateur : lui seul voit les Réglages des écrans associés et de la sécurité.
