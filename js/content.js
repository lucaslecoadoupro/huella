// Textes de l'application. Tout le contenu éditable est réuni ici.
// Sources principales : chronologie du Mémorial du camp de Rivesaltes,
// notice Mérimée du Mémorial (ACR0002037), plan de l'îlot F (1939).

export const ERAS = {
  '1939': {
    label: '1939', date: 'Décembre 1939', title: 'Un camp militaire',
    text: 'Le camp Joffre est construit à l’aube de la Seconde Guerre mondiale, sur une plaine sèche balayée par le vent. Dans l’îlot F, les baraques s’alignent en rangées autour d’allées et d’un grand espace central.',
    question: 'Comment les alignements organisent-ils l’espace ?',
    look: { mood: 'clear' }
  },
  '1941': {
    label: '1941', date: '1941–1942', title: 'Centre d’hébergement et d’internement',
    text: 'Les premiers convois d’internés arrivent le 14 janvier 1941. Des républicains espagnols, des Juifs étrangers et des familles tsiganes sont internés. Les hommes sont séparés des femmes et des enfants.',
    question: 'Que change la clôture pour celles et ceux qui vivent ici ?',
    look: { mood: 'internment' }
  },
  '1942': {
    label: '1942', date: 'Août–novembre 1942', title: 'Rassemblement et déportation',
    text: 'À partir d’août 1942, le camp devient un centre interrégional de rassemblement des Juifs. 2 289 hommes, femmes et enfants partent en 9 convois vers Drancy, puis Auschwitz. Le 22 novembre 1942, les troupes allemandes vident le camp.',
    question: 'Pourquoi faut-il distinguer internement, rassemblement et déportation ?',
    look: { mood: 'deportation' }
  },
  '1945': {
    label: '1944–48', date: '1944–1948', title: 'Après la Libération',
    text: 'Le camp devient un centre de séjour surveillé pour des personnes suspectées de collaboration, puis un dépôt de prisonniers de guerre de l’Axe. Les mêmes bâtiments changent encore de fonction.',
    question: 'Qu’est-ce qui change quand les mêmes bâtiments changent d’usage ?',
    look: { mood: 'postwar' }
  },
  '1962': {
    label: '1962–64', date: '1962–1964', title: 'Harkis et leurs familles',
    text: 'À partir de septembre 1962, des harkis et leurs familles arrivent au camp. Les premières semaines, beaucoup vivent sous des tentes, les baraques étant très dégradées. Près de 21 000 personnes passent par le camp avant sa fermeture en décembre 1964.',
    question: 'Que dit l’installation sous tente des conditions d’accueil ?',
    look: { mood: 'families' }
  },
  'today': {
    label: 'Aujourd’hui', date: 'Aujourd’hui', title: 'Des vestiges et un Mémorial',
    text: 'Les baraques de l’îlot F, protégées au titre des monuments historiques, sont restées à l’état de ruines. Le Mémorial, inauguré en 2015, est un long bâtiment de béton ocre à demi enterré dans l’ancienne place d’armes.',
    question: 'Pourquoi conserver les ruines plutôt que reconstruire les baraques ?',
    look: { mood: 'today' }
  }
};
export const ERA_ORDER = ['1939', '1941', '1942', '1945', '1962', 'today'];

// Étapes du parcours. `at` et `look` sont des positions sur la maquette (mètres).
// `barrack` + `local` : position relative à une baraque (x le long, z en travers).
export const STOPS = [
  {
    id: 'entree', title: 'Franchir l’entrée',
    text: 'L’îlot F couvre environ 42 hectares. Depuis l’entrée, regarde la distance qui te sépare des premières baraques et la clôture qui part de chaque côté.',
    question: 'Qu’est-ce qui marque le passage entre l’extérieur et l’intérieur ?',
    at: [-428, -10], look: [-200, -10]
  },
  {
    id: 'allee', title: 'Marcher dans une allée',
    text: 'Les baraques sont alignées en rangées parallèles. Dans l’allée, les façades se répètent à perte de vue : tout est visible, tout se ressemble.',
    question: 'Combien de baraques peux-tu compter dans cette rangée ?',
    at: [-196, -10], look: [-60, -10]
  },
  {
    id: 'baraque', title: 'Approcher une baraque',
    text: 'Une baraque mesure ici environ 30 mètres sur 6. Observe les ouvertures, la toiture légère et le sol nu tout autour. Les textures évoquent les matériaux ; les détails de façade sont une restitution.',
    question: 'Quels détails te paraissent vérifiables sur place ? Lesquels sont imaginés ?',
    barrack: 13, local: [-23, -10], lookBarrack: 13
  },
  {
    id: 'interieur', title: 'Entrer dans une baraque',
    text: 'Cet intérieur est une évocation : on ne connaît pas l’aménagement exact de cette baraque. Les témoignages décrivent le froid, le vent, la faim et la promiscuité.',
    question: 'Combien de personnes pourraient dormir ici ? Qu’est-ce qui manque ?',
    barrack: 32, local: [-11, 0], lookLocal: [10, 0], interior: true
  },
  {
    id: 'place', title: 'La place d’armes',
    text: 'Au centre de l’îlot, un grand espace vide sépare les rangées. C’est l’ancienne place d’armes : un lieu de rassemblement, aujourd’hui occupé par le Mémorial.',
    question: 'Depuis la place, que peux-tu voir ? Qu’est-ce qui peut te voir ?',
    at: [25, -128], look: [25, 40]
  },
  {
    id: 'limite', title: 'Longer la clôture',
    text: 'Une clôture de barbelés entoure l’îlot. Au-delà, la plaine continue jusqu’aux montagnes. La limite est simple, mais elle change tout.',
    question: 'Où la clôture interrompt-elle le chemin que tu suivais ?',
    at: [434, -70], look: [440, 30]
  },
  {
    id: 'memorial', title: 'Le site aujourd’hui',
    text: 'Les toits ont disparu, les murs restent. Le Mémorial de Rudy Ricciotti affleure à peine du sol, à demi enterré. Le lieu est conservé comme une trace, pas reconstruit.',
    question: 'Pourquoi le bâtiment du Mémorial reste-t-il si bas ?',
    at: [-6, -122], look: [25, -40], era: 'today'
  }
];

export const SOURCES = [
  { label: 'Histoire du camp — Mémorial du camp de Rivesaltes', url: 'https://www.memorialcamprivesaltes.eu/lhistoire-du-camp-de-rivesaltes' },
  { label: 'Ressources pédagogiques — Mémorial', url: 'https://www.memorialcamprivesaltes.eu/ressources/camp-de-rivesaltes' },
  { label: 'Îlot F — notice Mérimée (monument historique)', url: 'https://pop.culture.gouv.fr/notice/merimee/PA66000009' },
  { label: 'Le bâtiment du Mémorial — notice Mérimée', url: 'https://pop.culture.gouv.fr/notice/merimee/ACR0002037' }
];
