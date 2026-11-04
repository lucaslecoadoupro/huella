# Huella — Rivesaltes, les traces du silence

*Huella* : « la trace, l’empreinte » en espagnol.

Jeu d'enquête (PWA) dans la maquette 3D de l'îlot F, pour des élèves de 3e. Il se fait **à la maison**, avant et après la sortie au Mémorial du camp de Rivesaltes, jamais pendant la visite.

## Le jeu

L'élève joue un ou une stagiaire des archives du Mémorial. Les missions s'affichent dans un panneau au-dessus de la maquette 3D, une à la fois. L'onglet **Dossier** rassemble les pièces retrouvées, la liste des missions (on peut revenir à n'importe quelle mission déjà ouverte), le lexique espagnol et le carnet.

- **Épisode 1, avant la visite : « Le dossier oublié »** (30 min, 11 missions).
  - La pièce de départ, la Retirada.
  - Six pièces à retrouver **dans la 3D, à la bonne époque** : les rangées en 1941, la baraque témoin, la place d'armes en 1942, la clôture en 1944–48, les tentes en 1962, le Mémorial aujourd'hui. Chaque mission part d'un document daté ; l'élève doit régler la période lui-même. S'il est au bon endroit à la mauvaise époque, un message le lui dit. Deux indices, puis « M'y conduire ».
  - Une pièce ne se range dans le dossier que si l'élève a écrit sa réponse.
  - Ensuite : remettre le dossier dans l'ordre chronologique, l'enveloppe Bartolí (fiches et premier regard sur le dessin), puis les hypothèses et les questions pour la visite.
- **Épisode 2, après la visite : « Ce que les traces racontent »** (35 min, 9 missions).
  - Rouvrir son carnet PDF, mettre ses hypothèses à l'épreuve.
  - **Poser un repère dans la 3D** à l'endroit qui a le plus marqué l'élève, puis comparer la maquette (une restitution) avec le terrain (des traces).
  - Les fonctions successives du lieu, une deuxième analyse du dessin avec la première rappelée à côté, « Comment le dessin peut-il devenir un témoignage historique ? », l'évolution du regard, un bilan argumenté.
  - **La production finale en espagnol** : 8 à 10 frases. L'élève s'appuie sur son lexique (les mots ramassés avec chaque pièce), des débuts de phrases à insérer d'un clic et un rappel de conjugaison (fui, vi, aprendí, había, era).
- **Aucun fichier à manipuler.** Le travail est enregistré tout seul dans le navigateur, et l'épisode 2 le reprend automatiquement s'il est fait sur le même appareil, dans le même navigateur.
- **Envoi au professeur** (bouton « Envoyer à mon professeur », adresse `TEACHER_EMAIL` dans `js/enquete.js`) : les réponses sont copiées, puis la messagerie s'ouvre avec l'adresse et l'objet déjà remplis.
  - Sur téléphone, le texte est déjà dans le message.
  - Sur ordinateur, l'élève colle (Ctrl+V), car un lien `mailto:` long échoue souvent sous Windows.
  - Si aucune messagerie ne s'ouvre (Gmail ou Outlook ouverts dans le navigateur), deux boutons copient l'adresse puis les réponses.
  - Le professeur reçoit les réponses en texte lisible, suivies d'un « code de reprise ».
- **Changement d'appareil** : au début de l'épisode 2, « J'ai changé d'appareil ». L'élève colle le mail qu'il a envoyé (dans ses messages envoyés) et le code de reprise restaure tout. Le PDF reste disponible dans « Autres options », et il peut aussi être rouvert.
- Pas de compte, pas d'envoi : les réponses restent dans le navigateur et ne sortent que par le PDF. Le PDF est créé sur l'appareil (`js/pdf.js`, sans bibliothèque). Une sauvegarde lue dans un PDF est vérifiée champ par champ (`js/carnet.js`), et son contenu n'est jamais interprété comme du code ni comme du HTML.
- Pas de points, de vies ni de classement. La progression se voit uniquement par les pièces du dossier.

## Modifier les textes

- `js/enquete.js` : pièces du dossier, missions, indices, fiches Bartolí, mots espagnols, aide à la production en espagnol.
- `js/content.js` : périodes de la maquette (`ERAS`) et lieux (`STOPS`, en mètres). Les missions de recherche visent ces lieux par leur `id`.

## À faire avant de donner le lien aux élèves

1. **Les dessins de Bartolí** (reproductions autorisées) sont dans `images/` : le dessin A (la foule derrière les barbelés) sert de fil rouge pour les deux épisodes, le dessin B (les abris) sert à la comparaison dans l'épisode 2. Complétez la référence exacte de chaque œuvre dans `credit` (`DRAWINGS`, `js/enquete.js`).
2. **Faire vérifier ces points d'histoire**, rédigés à partir de connaissances générales et non de la chronologie du Mémorial :
   - les camps où Bartolí a été interné, sa fuite vers le Mexique puis les États-Unis ;
   - le fait qu'il n'ait pas été interné à Rivesaltes ;
   - le livre publié à Mexico en 1944 ;
   - le chiffre d'« un demi-million » de réfugiés de la Retirada.
3. Faire relire les mots espagnols et les débuts de phrases par le professeur d'espagnol.

## Vérifier après une modification

```
node outils/test_parcours.mjs
```

Ce test vérifie les identifiants des réponses, que chaque mission vise un lieu et une période qui existent, la sauvegarde cachée dans le PDF (aller-retour), le refus des fichiers invalides, les noms de fichiers et la pagination.

---

## La maquette 3D

La maquette est le terrain de jeu de l'enquête. Les 60 baraques sont placées d'après le plan de 1939. Une baraque témoin est meublée et se visite de l'intérieur. La vue aérienne et le plan aident à se repérer. **Six périodes** sont disponibles : 1939, 1941–42, 1942, 1944–48, 1962–64 et aujourd'hui. Selon la période, la lumière, l'état des baraques (intactes, dégradées, en ruine) et les éléments présents (clôture, tentes, Mémorial) changent.

## Commandes

| | Téléphone | Ordinateur |
|---|---|---|
| Marcher | glisser le pouce dans la moitié gauche (joystick) | Z Q S D ou flèches, Maj pour aller vite |
| Regarder | glisser dans la moitié droite | glisser avec la souris |
| Aller à un endroit | toucher le sol | cliquer au sol |
| Zoom | pincer | molette |

## Déploiement (Vercel, GitHub Pages ou tout hébergement statique)

Aucune compilation n'est nécessaire. Il suffit de publier le dossier tel quel en **HTTPS**.

Pour tester sur ordinateur : `python3 -m http.server 8000` dans le dossier, puis ouvrir `http://localhost:8000`.

## Mises à jour

Il n'y a pas de mode hors ligne : les élèves travaillent chez eux avec une connexion, et reçoivent toujours la dernière version publiée. `sw.js` ne sert plus qu'à effacer l'ancien cache des navigateurs qui avaient installé une version précédente.

## Déplacer un lieu de mission

Pour déplacer un lieu, modifiez ses coordonnées `at` / `look` (en mètres : x vers l'est de la maquette, z vers le haut du plan). Une étape peut aussi être placée par rapport à une baraque, avec `barrack` + `local`.

## Organisation des fichiers

```
index.html            écrans du jeu
css/app.css           mise en forme (téléphone d'abord)
js/app.js             maquette 3D, commandes, missions, dossier, PDF
js/enquete.js         textes de l'enquête (pièces, missions, espagnol)
js/carnet.js          format et validation de la sauvegarde
js/pdf.js             création des PDF sur l'appareil
images/               reproductions autorisées (à ajouter)
css/app.css           mise en forme (téléphone d'abord)
js/app.js             interface, commandes, parcours, plan, carnet
js/world.js           scène 3D (baraques, terrain, végétation, lumière par période)
js/content.js         tous les textes
data/ilot_f.json      empreintes des 60 baraques (plan de 1939)
textures/             brique, toiture, sol (WebP + cartes de relief)
vendor/three/         Three.js r170, servi localement (pas de CDN)
fonts/                Source Serif 4 et Inter (licence OFL)
outils/               ancien générateur et script d'export du plan
sw.js                 efface l'ancien cache hors ligne
```

## Sources et limites

- L'implantation des baraques est relevée sur le plan de l'îlot F de 1939 publié par le Mémorial (`outils/export_plan.py` → `data/ilot_f.json`).
- Les dates et les chiffres viennent de la chronologie du Mémorial et des notices Mérimée.
- Le reste est une **restitution**, signalée dans l'application (« À propos de la maquette ») : matériaux, ouvertures, intérieur, clôture, tentes, volume du Mémorial, paysage.
- L'orientation du plan (nord en haut ?) reste à vérifier. Les Corbières et la mer sont placées comme dans la version précédente.
