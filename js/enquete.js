// Contenu de l'enquête « Huella » : pièces du dossier, missions des deux épisodes,
// fiches Bartolí, aide à la production en espagnol. Les faits reprennent la chronologie du Mémorial
// (voir SOURCES dans content.js). Points à faire vérifier : README.

export const TITLE = 'Huella — Rivesaltes, les traces du silence';

// Pièces du dossier, dans l'ordre chronologique correct.
// es : mots espagnols rangés dans le lexique quand la pièce est trouvée.
export const PIECES = [
  { id: 'retirada', date: 'Janvier–février 1939', title: 'La Retirada',
    text: 'De 1936 à 1939, l’Espagne est déchirée par la guerre civile. Quand la Catalogne tombe aux mains des troupes de Franco, près d’un demi-million de républicains, soldats et civils, fuient vers la France à pied, dans le froid. La France les regroupe dans des camps, d’abord sur les plages du Roussillon, derrière des barbelés.',
    es: [['la Retirada', 'la retraite, l’exil de 1939'], ['el refugiado / la refugiada', 'le réfugié / la réfugiée'], ['la frontera', 'la frontière'], ['huir (huyeron)', 'fuir (ils ont fui)']] },
  { id: 'camp', date: '1939–1941', title: 'Un camp militaire devient un camp d’internement',
    text: 'Le camp Joffre est construit par l’armée en 1939 sur une plaine sèche et ventée. Le 14 janvier 1941 arrivent les premiers convois d’internés : républicains espagnols, Juifs étrangers, Tsiganes. Les baraques alignées de l’îlot F deviennent leur lieu de vie.',
    es: [['el campo de internamiento', 'le camp d’internement'], ['la barraca', 'la baraque'], ['el viento', 'le vent']] },
  { id: 'baraque', date: '1941–1942', title: 'La vie dans une baraque',
    text: 'Les témoignages décrivent le froid, le vent, la faim, les maladies et la promiscuité. Les familles sont séparées : les hommes d’un côté, les femmes et les enfants de l’autre. L’intérieur de la maquette est une évocation : on ne connaît pas l’aménagement exact de cette baraque.',
    es: [['el frío', 'le froid'], ['el hambre', 'la faim'], ['la familia separada', 'la famille séparée']] },
  { id: 'deportation', date: 'Août–novembre 1942', title: 'Rassemblement et déportation',
    text: 'Le camp devient le centre de rassemblement des Juifs de la zone libre. 2 289 hommes, femmes et enfants sont déportés en 9 convois vers Drancy, puis Auschwitz. Plus de la moitié des Juifs rassemblés échappent à la déportation grâce aux œuvres d’assistance. Le 22 novembre 1942, l’armée allemande occupe le camp.',
    es: [['la deportación', 'la déportation'], ['el tren', 'le train'], ['salvar', 'sauver']] },
  { id: 'liberation', date: '1944–1948', title: 'Après la Libération',
    text: 'Le camp sert encore. Il devient un centre de séjour surveillé pour des personnes suspectées de collaboration, puis un dépôt de prisonniers de guerre de l’Axe. Les mêmes bâtiments enferment d’autres personnes, pour d’autres raisons.',
    es: [['el prisionero de guerra', 'le prisonnier de guerre'], ['la Liberación', 'la Libération']] },
  { id: 'harkis', date: '1962–1964', title: 'Les harkis et leurs familles',
    text: 'À partir de septembre 1962, après la guerre d’Algérie, près de 21 000 harkis et membres de leurs familles passent par le camp. Les baraques sont très dégradées : beaucoup vivent d’abord sous des tentes, en plein hiver.',
    es: [['la tienda de campaña', 'la tente'], ['el invierno', 'l’hiver'], ['acoger', 'accueillir']] },
  { id: 'memorial', date: 'Depuis 2015', title: 'Un lieu de mémoire',
    text: 'Le Mémorial, conçu par l’architecte Rudy Ricciotti, est inauguré en octobre 2015 sur l’ancienne place d’armes. Il est à demi enterré, au ras des ruines. Les baraques de l’îlot F, protégées comme monument historique, sont conservées à l’état de ruines : on les garde comme des traces, on ne les reconstruit pas.',
    es: [['la memoria', 'la mémoire'], ['las ruinas', 'les ruines'], ['recordar', 'se souvenir']] }
];

// Fiches dévoilées une à une dans la mission Bartolí.
export const BARTOLI = [
  { title: 'Barcelone, 1910', text: 'Josep Bartolí naît à Barcelone. Dessinateur de presse et caricaturiste, il s’engage dans le camp républicain pendant la guerre d’Espagne.' },
  { title: 'Février 1939', text: 'Il passe la frontière pendant la Retirada. En France, il est enfermé dans plusieurs camps du Sud. Il dessine ce qu’il voit et ce qu’il vit : barbelés, gardiens, sable, faim, attente.' },
  { title: 'Après les camps', text: 'Il s’évade, quitte l’Europe pour le Mexique puis s’installe aux États-Unis, où il meurt en 1995. En 1944, à Mexico, ses dessins des camps sont publiés : Campos de concentración 1939-194…' },
  { title: 'Attention aux confusions', caution: true, text: 'Ses dessins montrent les camps où lui-même a été enfermé à partir de 1939. Ce ne sont pas des images de Rivesaltes, qui n’accueille des internés qu’en janvier 1941. Mais ils racontent la même histoire : celle des réfugiés espagnols internés en France.' }
];
export const BARTOLI_ES = [['el dibujo', 'le dessin'], ['dibujar', 'dessiner'], ['la alambrada', 'les barbelés'], ['la manta', 'la couverture'], ['el campo de concentración', 'le camp de concentration'], ['el testimonio', 'le témoignage']];

// Dessins de Josep Bartolí (reproductions autorisées). Compléter credit avec la référence exacte de l'œuvre.
export const DRAWINGS = {
  barbeles: { title: 'Josep Bartolí · dessin A', src: './images/bartoli-barbeles.png', credit: 'Josep Bartolí, dessin des camps de 1939. Reproduction autorisée.',
    alt: 'Dessin à l’encre : une foule d’hommes, enveloppés dans des couvertures, se tient serrée devant une haute clôture de fils barbelés. Certains lèvent la main. Le sol est nu.' },
  abris: { title: 'Josep Bartolí · dessin B', src: './images/bartoli-abris.png', credit: 'Josep Bartolí, dessin des camps de 1939. Reproduction autorisée.',
    alt: 'Dessin à l’encre : des abris de fortune faits de toiles et de couvertures tendues sur des piquets, sur un sol de sable jonché de boîtes de conserve et de bidons. Au fond, une clôture de barbelés.' }
};

// Adresse à laquelle les élèves envoient leur carnet (bouton « Envoyer à mon professeur »).
export const TEACHER_EMAIL = 'lucas.le-coadou@ac-montpellier.fr';

// Missions. kind :
//   find    trouver un lieu dans la 3D, à la bonne époque (target : stop de content.js ou 'tents')
//   piece   lire une pièce donnée d'emblée et répondre
//   chrono  remettre les pièces en ordre        bartoli  fiches puis analyse du dessin
//   write   questions ouvertes                  mark     poser un repère dans la 3D
//   import  reprendre son PDF                   spanish  production finale en espagnol
//   export  télécharger le PDF
// fields : réponses. before : réponse de l'épisode 1 rappelée. recall : réponses rappelées en tête.
export const EPISODES = [
  {
    id: 'ep1', num: 1, moment: 'Avant la visite', title: 'Le dossier oublié', duration: '30 min',
    pdfKind: 'AVANT', pdfTitle: 'Carnet d’enquête',
    intro: 'Tu es stagiaire aux archives du Mémorial. On te confie un dossier sur l’îlot F : il est incomplet. Retrouve les pièces manquantes dans la maquette du camp, à la bonne époque, puis prépare ta visite.',
    missions: [
      { id: 'dossier', kind: 'piece', piece: 'retirada', title: 'Le dossier s’ouvre',
        brief: 'Dans le carton, une seule pièce est encore là. Elle parle d’un exil, au début de l’année 1939. Lis-la : c’est le point de départ de ton enquête.',
        fields: [
          { id: 'e1_deja', label: 'Ce que je sais déjà, ou crois savoir, sur le camp de Rivesaltes', hint: 'Si tu ne sais rien, écris-le : c’est un bon point de départ.', rows: 2 },
          { id: 'e1_retirada', label: 'À ton avis, pourquoi ces réfugiés sont-ils enfermés plutôt qu’accueillis ?', hint: 'Formule une hypothèse : « Je pense que… parce que… ».', rows: 3 }
        ] },
      { id: 'allee', kind: 'find', piece: 'camp', era: '1941', target: 'allee', radius: 14, title: 'Les rangées de baraques',
        brief: 'Une note de janvier 1941 : « Les premiers internés arrivent. On les loge dans les baraques alignées de l’îlot F. » Règle la maquette sur la bonne date, entre dans l’îlot et rejoins l’allée entre les rangées.',
        hints: ['La date se règle avec le bouton de période, en haut à gauche.', 'L’entrée est à l’ouest. Suis la route droit devant toi, entre les baraques.'],
        fields: [{ id: 'e1_allee', label: 'Décris ce que tu vois autour de toi. Comment l’espace est-il organisé ?', rows: 3 }] },
      { id: 'baraque', kind: 'find', piece: 'baraque', era: '1941', target: 'interieur', radius: 6, title: 'La baraque témoin',
        brief: 'Un rapport de l’hiver 1941 décrit l’intérieur d’une baraque. Une seule baraque de la maquette est aménagée : sur le plan, elle est d’une couleur différente. Entre à l’intérieur.',
        hints: ['Ouvre le plan (en haut à droite) : la baraque témoin est la plus claire.', 'Touche le plan près de la baraque témoin pour t’y rendre, puis passe la porte.'],
        fields: [{ id: 'e1_baraque', label: 'Combien de personnes pourraient vivre ici ? Qu’est-ce qui manque ?', rows: 3 }] },
      { id: 'place', kind: 'find', piece: 'deportation', era: '1942', target: 'place', radius: 16, title: 'La grande place',
        brief: 'Un document d’août 1942 évoque une grande place vide au centre du camp, où l’on rassemble les internés avant les départs. Trouve-la, à cette date.',
        hints: ['La place est au centre de l’îlot, au sud de la route.', 'Sur le plan, c’est le grand espace sans baraques au milieu.'],
        fields: [{ id: 'e1_place', label: 'Pourquoi un si grand espace vide au centre d’un camp ? Que peut-on y faire, y voir ?', rows: 3 }] },
      { id: 'cloture', kind: 'find', piece: 'liberation', era: '1945', target: 'limite', radius: 16, title: 'La clôture',
        brief: 'Une lettre de 1946 se plaint de la clôture « qui coupe la plaine jusqu’aux montagnes ». Le camp sert toujours. Va longer la limite est de l’îlot, à cette époque.',
        hints: ['Choisis la période qui suit la Libération.', 'Traverse tout l’îlot vers l’est, jusqu’aux barbelés.'],
        fields: [{ id: 'e1_cloture', label: 'Le même lieu enferme d’autres personnes. Qu’est-ce qui change ? Qu’est-ce qui reste ?', rows: 3 }] },
      { id: 'tentes', kind: 'find', piece: 'harkis', era: '1962', target: 'tents', radius: 14, title: 'Les tentes',
        brief: 'Une photographie de l’automne 1962 montre des tentes plantées entre les baraques. Retrouve-les dans la maquette.',
        hints: ['Les tentes n’existent que dans une seule période : règle la bonne date.', 'Ouvre le plan : à cette date, les tentes y apparaissent.'],
        fields: [{ id: 'e1_tentes', label: 'Que disent ces tentes des conditions d’accueil de ces familles ?', rows: 3 }] },
      { id: 'memorial', kind: 'find', piece: 'memorial', era: 'today', target: 'memorial', radius: 16, title: 'Le site aujourd’hui',
        brief: 'Dernière pièce : une brochure récente. Le camp n’est plus un camp. Rends-toi devant le bâtiment qui occupe aujourd’hui l’ancienne place d’armes.',
        hints: ['Règle la maquette sur « Aujourd’hui ».', 'Le Mémorial est un long bâtiment bas, au centre de l’îlot.'],
        fields: [{ id: 'e1_memorial', label: 'Pourquoi conserver les ruines plutôt que reconstruire les baraques ?', rows: 3 }] },
      { id: 'ordre', kind: 'chrono', title: 'Remettre le dossier en ordre',
        brief: 'Tu as retrouvé toutes les pièces, mais elles sont mélangées. Remets-les dans l’ordre chronologique, puis vérifie.',
        fields: [{ id: 'e1_ordre', label: 'Le même lieu a eu plusieurs fonctions. Laquelle t’étonne le plus ? Pourquoi ?', rows: 3 }] },
      { id: 'bartoli', kind: 'bartoli', drawing: 'barbeles', title: 'L’enveloppe Bartolí',
        brief: 'Au fond du carton, une enveloppe porte un nom : Josep Bartolí. Lis les fiches, puis observe le dessin qu’elle contient. On observe d’abord, on interprète ensuite.',
        fields: [
          { id: 'e1_d_vois', label: '1. Ce que je vois', hint: 'Personnages, lieu, objets, détails, texte éventuel.', rows: 3 },
          { id: 'e1_d_comment', label: '2. Comment c’est dessiné', hint: 'Traits, cadrage, ce qui est au centre, ce qui est grossi ou caché.', rows: 2 },
          { id: 'e1_d_comprends', label: '3. Ce que je comprends : que veut montrer l’artiste ?', rows: 3 },
          { id: 'e1_d_question', label: '4. La question que ce dessin me pose', rows: 2 }
        ] },
      { id: 'rapport', kind: 'write', title: 'Mon rapport avant la visite',
        brief: 'Le dossier est presque complet. Avant d’aller sur place, note ce que tu penses découvrir et ce que tu veux comprendre. Tu retrouveras ces lignes après la sortie.',
        fields: [
          { id: 'e1_hyp', label: 'Mes hypothèses sur ce que je vais voir ou comprendre au Mémorial', hint: 'Deux hypothèses, en commençant par « Je pense que… ».', rows: 3 },
          { id: 'e1_questions', label: 'Mes questions pour le guide et pour l’atelier', hint: 'Trois questions.', rows: 3 }
        ] },
      { id: 'fin', kind: 'export', title: 'Refermer le dossier',
        brief: 'Envoie ton carnet d’enquête à ton professeur. Ton travail reste enregistré sur cet appareil pour l’épisode 2.' }
    ]
  },
  {
    id: 'ep2', num: 2, moment: 'Après la visite', title: 'Ce que les traces racontent', duration: '35 min',
    pdfKind: 'APRES', pdfTitle: 'Carnet de mémoire',
    intro: 'Tu es allé·e sur place. Rouvre ton dossier, confronte tes hypothèses à ce que tu as vu, analyse à nouveau le dessin de Bartolí, puis raconte ta visite en espagnol.',
    missions: [
      { id: 'reprendre', kind: 'import', title: 'Rouvrir mon dossier',
        brief: 'Avant de commencer, vérifions que ton travail de l’épisode 1 est bien là.' },
      { id: 'retour', kind: 'write', title: 'Mes hypothèses à l’épreuve',
        brief: 'Voici ce que tu avais écrit avant la sortie. Relis-le avec ce que tu as vu et entendu au Mémorial.',
        recall: ['e1_hyp', 'e1_questions'],
        fields: [
          { id: 'e2_hyp', label: 'Lesquelles de mes hypothèses la visite a-t-elle confirmées ? Lesquelles dois-je corriger ? Explique.', rows: 4 },
          { id: 'e2_reponses', label: 'Quelles réponses ai-je obtenues à mes questions ? Laquelle reste ouverte ?', rows: 3 }
        ] },
      { id: 'repere', kind: 'mark', title: 'La maquette face au terrain',
        brief: 'Dans la maquette, rends-toi à l’endroit qui t’a le plus marqué·e pendant la visite, à l’époque de ton choix. Puis pose ton repère.',
        fields: [
          { id: 'e2_repere', label: 'Qu’as-tu vu à cet endroit, en vrai ? Pourquoi t’a-t-il marqué·e ?', rows: 3 },
          { id: 'e2_maquette', label: 'Qu’est-ce que la maquette ne montre pas, et que tu as vu ou ressenti sur place ?', hint: 'La maquette est une restitution ; les ruines sont des traces.', rows: 3 }
        ] },
      { id: 'fonctions', kind: 'write', title: 'Un lieu, plusieurs fonctions', showChrono: true,
        brief: 'Voici le dossier remis en ordre. Change d’époque dans la maquette pour revoir le lieu.',
        fields: [{ id: 'e2_fonctions', label: 'Choisis deux périodes. Explique comment le lieu a changé de fonction, et qui y a été enfermé.', rows: 4 }] },
      { id: 'dessin', kind: 'bartoli', drawing: 'barbeles', again: true, title: 'Le dessin, une seconde fois',
        brief: 'Après l’atelier, regarde à nouveau le dessin. Ta première analyse est rappelée au-dessus de chaque question : ne la recopie pas, complète-la et corrige-la.',
        fields: [
          { id: 'e2_d_vois', before: 'e1_d_vois', label: '1. Ce que je vois maintenant', rows: 3 },
          { id: 'e2_d_comment', before: 'e1_d_comment', label: '2. Comment c’est dessiné', rows: 2 },
          { id: 'e2_d_comprends', before: 'e1_d_comprends', label: '3. Ce que je comprends maintenant', rows: 3 }
        ] },
      { id: 'dessin-b', kind: 'bartoli', drawing: 'abris', again: true, title: 'Un second dessin',
        brief: 'Le Mémorial t’a confié un second dessin de Bartolí. Observe-le, puis compare-le au premier et à ce que tu as vu à Rivesaltes.',
        fields: [
          { id: 'e2_b_vois', label: 'Ce que je vois dans ce dessin', hint: 'Les abris, le sol, les objets, la clôture.', rows: 3 },
          { id: 'e2_b_rivesaltes', label: 'Ces abris sont-ils ceux de Rivesaltes ? Comment le sais-tu ? Qu’est-ce qui ressemble ou diffère de ce que tu as vu au Mémorial ?', rows: 4 },
          { id: 'e2_temoignage', label: 'À partir des deux dessins : comment le dessin peut-il devenir un témoignage historique ?', hint: 'Qui dessine ? Quand ? Où ? Qu’a-t-il vécu ? Que montre un dessin qu’une photo ne montre pas ? Quelles précautions faut-il prendre ?', rows: 5 }
        ] },
      { id: 'evolution', kind: 'write', title: 'Mon regard a changé',
        brief: 'Compare tes deux lectures du dessin.',
        recall: ['e1_d_comprends', 'e2_d_comprends'],
        fields: [
          { id: 'e2_change', label: 'Qu’est-ce qui a changé entre ma première et ma deuxième interprétation ?', rows: 3 },
          { id: 'e2_declic', label: 'Quel élément de la visite ou de l’atelier a fait évoluer ma compréhension ?', hint: 'Un lieu, une explication, un document, un dessin…', rows: 3 }
        ] },
      { id: 'bilan', kind: 'write', title: 'Mon bilan',
        brief: 'Un paragraphe argumenté : une idée, un argument qui la justifie, un exemple précis tiré de la visite, de l’atelier ou des dessins.',
        fields: [{ id: 'e2_bilan', label: 'Pourquoi est-il important de connaître et de transmettre l’histoire du camp de Rivesaltes ?', rows: 7 }] },
      { id: 'espanol', kind: 'spanish', title: 'Producción final',
        brief: 'Escribe un texto de 8 a 10 frases para contar tu visita al Memorial de Rivesaltes. Utiliza el vocabulario de tu dossier y lo que aprendiste antes y durante la visita.',
        fields: [{ id: 'e2_es', label: 'Mi visita al Memorial de Rivesaltes', rows: 10, lang: 'es' }] },
      { id: 'fin', kind: 'export', title: 'Mon carnet de mémoire',
        brief: 'Envoie ton carnet de mémoire à ton professeur.' }
    ]
  }
];

// Aide à l'écriture en espagnol (production finale).
export const ES_STARTERS = [
  'El campo de Rivesaltes es / fue…',
  'En 1939, miles de republicanos españoles…',
  'Durante la visita, vi… / descubrí…',
  'Aprendí que…',
  'El dibujo de Josep Bartolí muestra…',
  'Me impresionó… porque…',
  'Para mí, es importante recordar… porque…'
];
export const ES_GRAMMAR = 'Pour raconter : fui (je suis allé·e), vi (j’ai vu), aprendí (j’ai appris), descubrí (j’ai découvert). Pour décrire le passé : había (il y avait), era (c’était), vivían (ils vivaient).';
