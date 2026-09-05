import type { Restaurant } from './data'

// Établissements fictifs, uniquement pour explorer l'application en mode démo.
type DemoTable = Pick<Restaurant, 'id' | 'name' | 'cuisine' | 'foodTags' | 'services' | 'district' | 'distance' | 'address' | 'description' | 'diets' | 'avgPrice' | 'maxGuests' | 'menu'> & {
  schedule: [string, string]
  image?: string
}

function demoRestaurant({ schedule: [open, close], ...table }: DemoTable): Restaurant {
  return {
    ...table,
    image: table.image ?? '/images/table.webp',
    rating: '4,7',
    open: true,
    hours: [`Tous les jours · ${open}–${close}`],
    openingHours: Array.from({ length: 7 }, (_, day) => ({ day, intervals: [{ open, close }] })),
    loyalty: {
      type: 'stamps', title: `Les habitués · ${table.name}`, current: 0,
      target: 8, reward: 'Un repas offert', rule: 'Une coche par visite, hors boissons.',
      eurosPerStamp: 0, style: 'creme',
      tiers: [{ at: 4, reward: 'Une boisson offerte' }, { at: 8, reward: 'Un repas offert' }],
    },
    reviews: [],
    offers: [],
  }
}

const demoTables: DemoTable[] = [
  {
    id: 'demo-smash-garden', name: 'Smash Garden', cuisine: 'Burgers maison',
    foodTags: ['burger'], services: ['terrasse', 'emporter', 'livraison'],
    district: 'Paris 11e', distance: '500 m', address: '24 rue Saint-Maur, 75011 Paris',
    description: 'Des smash burgers, des frites maison et une alternative végétale à savourer en terrasse.',
    diets: ['Végétarien', 'Halal'], avgPrice: 15, maxGuests: 6, schedule: ['11:30', '23:30'],
    menu: [
      { name: 'Smash classique', description: 'Bœuf halal, cheddar, pickles et sauce maison.', price: '13,00 €' },
      { name: 'Burger jardin', description: 'Galette de pois chiches, cheddar et oignons confits.', price: '12,00 €' },
      { name: 'Frites maison', description: 'Pommes de terre fraîches, paprika doux.', price: '4,00 €' },
    ],
  },
  {
    id: 'demo-napoli-pop', name: 'Napoli Pop', cuisine: 'Pizzeria italienne',
    foodTags: ['pizza', 'italien'], services: ['terrasse', 'emporter', 'livraison'],
    district: 'Paris 11e', distance: '900 m', address: '41 rue de la Folie-Méricourt, 75011 Paris',
    description: 'Pâte au levain, tomates italiennes et pizzas cuites à haute température.',
    diets: ['Végétarien', 'Végan'], avgPrice: 16, maxGuests: 8, schedule: ['12:00', '23:00'],
    menu: [
      { name: 'Margherita', description: 'Tomate, mozzarella et basilic frais.', price: '13,00 €' },
      { name: 'Pizza ortolana végane', description: 'Tomate, aubergine, courgette et crème de cajou.', price: '15,00 €' },
      { name: 'Pasta al pomodoro', description: 'Pâtes, sauce tomate et basilic.', price: '14,00 €' },
    ],
  },
  {
    id: 'demo-maki-club', name: 'Maki Club', cuisine: 'Sushi japonais',
    foodTags: ['sushi', 'japonais', 'asiatique'], services: ['emporter', 'livraison'],
    district: 'Paris 3e', distance: '1,6 km', address: '32 rue de Bretagne, 75003 Paris',
    description: 'Sushis préparés à la commande, makis végétaux et plateaux à partager.',
    diets: ['Végétarien', 'Végan', 'Sans gluten'], avgPrice: 24, maxGuests: 4, schedule: ['12:00', '22:30'],
    image: '/images/ramen.webp',
    menu: [
      { name: 'Plateau sushi saumon', description: 'Nigiris et makis saumon, gingembre et tamari sans gluten.', price: '22,00 €' },
      { name: 'Makis du potager', description: 'Avocat, concombre, radis et sésame, sans poisson.', price: '16,00 €' },
      { name: 'Edamame', description: 'Fèves de soja et fleur de sel.', price: '5,00 €' },
    ],
  },
  {
    id: 'demo-koji-ramen', name: 'Koji Ramen', cuisine: 'Ramen japonais',
    foodTags: ['ramen', 'japonais', 'asiatique'], services: ['emporter'],
    district: 'Paris 9e', distance: '3,2 km', address: '17 rue de la Victoire, 75009 Paris',
    description: 'Un petit comptoir de nouilles fraîches et de bouillons mijotés toute la journée.',
    diets: ['Végétarien', 'Végan'], avgPrice: 18, maxGuests: 2, schedule: ['11:30', '22:00'],
    image: '/images/ramen.webp',
    menu: [
      { name: 'Ramen shoyu', description: 'Bouillon de poulet, nouilles, œuf mariné et cébette.', price: '17,00 €' },
      { name: 'Ramen miso végétal', description: 'Bouillon de champignons, tofu et nouilles sans œuf.', price: '16,00 €' },
    ],
  },
  {
    id: 'demo-minuit-kebab', name: 'Minuit Kebab', cuisine: 'Kebab et grillades',
    foodTags: ['kebab', 'grillades'], services: ['emporter', 'livraison'],
    district: 'Paris 10e', distance: '1,2 km', address: '58 rue du Faubourg-Saint-Denis, 75010 Paris',
    description: 'Pain chaud, viande grillée et falafels croustillants, jusque tard dans la nuit.',
    diets: ['Halal', 'Végétarien'], avgPrice: 12, maxGuests: 4, schedule: ['11:00', '04:00'],
    menu: [
      { name: 'Kebab maison', description: 'Viande halal grillée, crudités et sauce au choix.', price: '10,00 €' },
      { name: 'Sandwich falafel', description: 'Falafels, salade, tomates et sauce au yaourt.', price: '9,00 €' },
      { name: 'Assiette grillades', description: 'Brochettes de poulet, riz et légumes.', price: '14,00 €' },
    ],
  },
  {
    id: 'demo-curry-comptoir', name: 'Curry Comptoir', cuisine: 'Cuisine indienne',
    foodTags: ['indien'], services: ['emporter', 'livraison'],
    district: 'Paris 10e', distance: '2,3 km', address: '9 rue du Château-d’Eau, 75010 Paris',
    description: 'Currys parfumés, lentilles mijotées et pains cuits au tandoor.',
    diets: ['Halal', 'Végétarien', 'Végan', 'Sans gluten'], avgPrice: 17, maxGuests: 8, schedule: ['12:00', '23:00'],
    menu: [
      { name: 'Poulet tandoori', description: 'Poulet halal mariné aux épices, riz basmati.', price: '17,00 €' },
      { name: 'Dal de lentilles', description: 'Lentilles corail, lait de coco et riz, végan et sans gluten.', price: '13,00 €' },
      { name: 'Naan au fromage', description: 'Pain chaud fourré au fromage.', price: '4,00 €' },
    ],
  },
  {
    id: 'demo-cedre-mezze', name: 'Cèdre & Mezzés', cuisine: 'Cuisine libanaise',
    foodTags: ['libanais', 'mediterraneen', 'grillades'], services: ['terrasse', 'emporter'],
    district: 'Paris 12e', distance: '3,6 km', address: '21 rue de Cotte, 75012 Paris',
    description: 'Une grande table de mezzés, de légumes et de brochettes à partager.',
    diets: ['Halal', 'Végétarien', 'Végan'], avgPrice: 20, maxGuests: 12, schedule: ['12:00', '23:00'],
    menu: [
      { name: 'Mezzé végétal', description: 'Houmous, falafels, taboulé et caviar d’aubergine.', price: '18,00 €' },
      { name: 'Chich taouk', description: 'Brochettes de poulet halal, citron et ail.', price: '19,00 €' },
    ],
  },
  {
    id: 'demo-bistrot-lucette', name: 'Bistrot Lucette', cuisine: 'Bistrot français',
    foodTags: ['francais'], services: ['terrasse'],
    district: 'Paris 6e', distance: '5,1 km', address: '12 rue du Cherche-Midi, 75006 Paris',
    description: 'Cuisine de saison, plats mijotés et longue pause déjeuner en terrasse.',
    diets: ['Végétarien'], avgPrice: 32, maxGuests: 10, schedule: ['12:00', '22:00'],
    menu: [
      { name: 'Bœuf bourguignon', description: 'Bœuf mijoté, carottes et pommes de terre.', price: '26,00 €' },
      { name: 'Tarte aux légumes', description: 'Légumes du marché, chèvre frais et mesclun.', price: '19,00 €' },
      { name: 'Crème brûlée', description: 'Vanille et fine croûte caramélisée.', price: '8,00 €' },
    ],
  },
  {
    id: 'demo-bowl-saison', name: 'Bowl de Saison', cuisine: 'Salades et bowls végétaux',
    foodTags: ['salades'], services: ['terrasse', 'emporter', 'livraison'],
    district: 'Paris 11e', distance: '650 m', address: '35 rue Oberkampf, 75011 Paris',
    description: 'Des bols colorés, des céréales et des légumes de saison, entièrement végétaux.',
    diets: ['Végétarien', 'Végan', 'Sans gluten'], avgPrice: 14, maxGuests: 4, schedule: ['11:00', '21:00'],
    menu: [
      { name: 'Bowl quinoa et patate douce', description: 'Quinoa, pois chiches, roquette et tahini.', price: '13,00 €' },
      { name: 'Salade croquante', description: 'Riz complet, chou rouge, avocat et citron.', price: '12,00 €' },
    ],
  },
  {
    id: 'demo-cafe-aurore', name: 'Café Aurore', cuisine: 'Café et brunch',
    foodTags: ['cafe', 'brunch'], services: ['terrasse', 'emporter'],
    district: 'Paris 20e', distance: '2,4 km', address: '8 rue de Ménilmontant, 75020 Paris',
    description: 'Café de spécialité, tartines et brunch dès le matin, avec boissons végétales.',
    diets: ['Végétarien', 'Végan'], avgPrice: 9, maxGuests: 6, schedule: ['07:00', '18:00'],
    menu: [
      { name: 'Tartine avocat', description: 'Pain au levain, avocat, citron et graines.', price: '9,00 €' },
      { name: 'Brunch Aurore', description: 'Tartine, granola végétal, jus pressé et café.', price: '22,00 €' },
      { name: 'Latte avoine', description: 'Double espresso et boisson d’avoine.', price: '4,50 €' },
    ],
  },
  {
    id: 'demo-douce-heure', name: 'Douce Heure', cuisine: 'Pâtisseries et desserts',
    foodTags: ['desserts', 'cafe'], services: ['emporter'],
    district: 'Paris 4e', distance: '2,9 km', address: '16 rue Saint-Paul, 75004 Paris',
    description: 'Une pause sucrée autour de pâtisseries maison et de cafés fraîchement moulus.',
    diets: ['Végétarien', 'Végan', 'Sans gluten'], avgPrice: 8, maxGuests: 2, schedule: ['09:00', '19:30'],
    menu: [
      { name: 'Brownie chocolat', description: 'Chocolat noir, amande et farine de riz, végan et sans gluten.', price: '5,00 €' },
      { name: 'Tarte citron', description: 'Pâte sablée, crème citron et meringue.', price: '6,00 €' },
      { name: 'Espresso', description: 'Assemblage du moment.', price: '2,50 €' },
    ],
  },
  {
    id: 'demo-patio-athenes', name: 'Le Patio d’Athènes', cuisine: 'Cuisine méditerranéenne',
    foodTags: ['mediterraneen', 'salades', 'grillades'], services: ['terrasse'],
    district: 'Paris 15e', distance: '8,4 km', address: '28 rue du Commerce, 75015 Paris',
    description: 'Une cour arborée, des assiettes grecques et des grillades à partager en groupe.',
    diets: ['Végétarien', 'Sans gluten'], avgPrice: 27, maxGuests: 12, schedule: ['12:00', '23:00'],
    menu: [
      { name: 'Salade grecque', description: 'Tomates, concombre, feta, olives et huile d’olive.', price: '16,00 €' },
      { name: 'Dorade grillée', description: 'Poisson entier, pommes de terre et citron.', price: '28,00 €' },
    ],
  },
  {
    id: 'demo-taco-loco', name: 'Taco Loco', cuisine: 'Cuisine mexicaine',
    foodTags: ['tacos', 'mexicain'], services: ['emporter', 'livraison'],
    district: 'Paris 18e', distance: '4,8 km', address: '31 rue Ramey, 75018 Paris',
    description: 'Tacos de maïs, salsas fraîches et burritos généreux jusque tard le soir.',
    diets: ['Végétarien', 'Végan', 'Sans gluten'], avgPrice: 13, maxGuests: 6, schedule: ['12:00', '01:00'],
    image: '/images/tacos.webp',
    menu: [
      { name: 'Trio de tacos végétaux', description: 'Tortillas de maïs, haricots noirs et légumes rôtis.', price: '12,00 €' },
      { name: 'Burrito poulet', description: 'Tortilla de blé, poulet, riz et salsa verde.', price: '13,00 €' },
      { name: 'Guacamole et chips', description: 'Avocat, citron vert et chips de maïs.', price: '6,00 €' },
    ],
  },
  {
    id: 'demo-maison-safran', name: 'Maison Safran', cuisine: 'Cuisine marocaine',
    foodTags: ['marocain', 'couscous'], services: ['terrasse', 'emporter', 'livraison'],
    district: 'Paris 19e', distance: '3,9 km', address: '42 avenue Secrétan, 75019 Paris',
    description: 'Couscous, tajines et grandes tablées, autour de recettes familiales.',
    diets: ['Halal', 'Végétarien', 'Végan'], avgPrice: 22, maxGuests: 12, schedule: ['12:00', '23:30'],
    menu: [
      { name: 'Couscous sept légumes', description: 'Semoule, pois chiches et légumes, bouillon végétal.', price: '17,00 €' },
      { name: 'Tajine poulet citron', description: 'Poulet halal, olives et citron confit.', price: '21,00 €' },
      { name: 'Thé à la menthe', description: 'Thé vert, menthe fraîche et sucre au choix.', price: '3,50 €' },
    ],
  },
]

export const extraDemoRestaurants: Restaurant[] = demoTables.map(demoRestaurant)
