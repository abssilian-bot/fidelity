import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_OWNER_EMAIL = 'demo-restaurateur@fidelity.local'
const DEMO_MEMBER_EMAIL = 'camille@fidelity.local'

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: DEMO_OWNER_EMAIL },
    update: {},
    create: { email: DEMO_OWNER_EMAIL, displayName: 'Amina B.', role: 'RESTAURANT' },
  })

  const member = await prisma.user.upsert({
    where: { email: DEMO_MEMBER_EMAIL },
    update: {},
    create: {
      email: DEMO_MEMBER_EMAIL,
      pseudo: 'camilleatable',
      displayName: 'Camille Robert',
      bio: 'Toujours partante pour une grande tablée, un bouillon réconfortant et les adresses qui prennent soin des végétariens.',
    },
  })

  const restaurants = [
    {
      slug: 'chez-amina',
      name: 'Chez Amina',
      cuisine: 'Cuisine marocaine',
      district: 'Paris 11e',
      address: '18 rue des Trois-Bornes, Paris 11e',
      description: 'Une table de quartier chaleureuse pour les tajines, couscous et légumes aux épices douces.',
      diets: ['Halal', 'Végétarien'],
      program: { type: 'STAMPS' as const, title: 'Les saveurs d’Amina', target: 10, reward: 'Un plat signature offert', rule: 'Une coche par visite, hors boissons.', style: 'BRAISE' as const },
      menu: [
        { name: 'Couscous du vendredi', description: 'Semoule fine, légumes confits et poulet aux épices douces.', priceCents: 1850 },
        { name: 'Tajine citron', description: 'Poulet fermier, citron confit et olives violettes.', priceCents: 1950 },
        { name: 'Carottes à la chermoula', description: 'Entrée fraîche aux herbes, cumin et agrumes.', priceCents: 750 },
      ],
    },
    {
      slug: 'casa-verde',
      name: 'Casa Verde',
      cuisine: 'Cuisine mexicaine',
      district: 'Paris 11e',
      address: '22 rue Oberkampf, Paris 11e',
      description: 'Tortillas pressées chaque matin, légumes rôtis, salsa verde et citron frais.',
      diets: ['Végétarien', 'Végan'],
      program: { type: 'STAMPS' as const, title: 'La mesa verde', target: 8, reward: 'Un dessert maison offert', rule: 'Une coche par passage.', style: 'BRAISE' as const },
      menu: [
        { name: 'Tacos de légumes rôtis', description: 'Salsa verde, avocat et citron vert.', priceCents: 1400 },
        { name: 'Quesadilla maison', description: 'Fromage fumé, haricots noirs et coriandre.', priceCents: 1350 },
      ],
    },
    {
      slug: 'atelier-miso',
      name: 'Atelier Miso',
      cuisine: 'Cuisine japonaise',
      district: 'Paris 10e',
      address: '7 passage du Marché, Paris 10e',
      description: 'Ramen, bols et petites assiettes japonaises cuisinés dans un atelier calme et végétal.',
      diets: ['Végétarien', 'Végan', 'Sans gluten'],
      program: { type: 'POINTS' as const, title: 'Le cercle Miso', target: 800, reward: 'Un menu midi offert', rule: 'Dix points par euro dépensé.', style: 'BRAISE' as const },
      menu: [
        { name: 'Ramen miso blanc', description: 'Bouillon végétal, nouilles, shiitakés et œuf mariné.', priceCents: 1790 },
        { name: 'Donburi aubergine', description: 'Riz vinaigré, aubergine laquée et pickles maison.', priceCents: 1650 },
        { name: 'Gyozas de saison', description: 'Légumes, ponzu et huile de sésame.', priceCents: 850 },
      ],
    },
    {
      slug: 'le-comptoir-solaire',
      name: 'Le Comptoir Solaire',
      cuisine: 'Brunch méditerranéen',
      district: 'Paris 2e',
      address: '8 rue du Nil, Paris 2e',
      description: 'Assiettes de saison, café de spécialité et grandes tablées.',
      diets: ['Végétarien'],
      program: { type: 'POINTS' as const, title: 'Les matins solaires', target: 500, reward: 'Un brunch offert', rule: 'Cinq points par euro dépensé.', style: 'CREME' as const },
      menu: [
        { name: 'Assiette solaire', description: 'Œufs, légumes rôtis et labneh.', priceCents: 1700 },
        { name: 'Granola maison', description: 'Yaourt, fruits de saison et miel.', priceCents: 950 },
      ],
    },
    {
      slug: 'riz-rouge',
      name: 'Riz Rouge',
      cuisine: 'Cuisine vietnamienne',
      district: 'Paris 10e',
      address: '14 rue du Faubourg, Paris 10e',
      description: 'Bols parfumés, herbes fraîches et assiettes à partager dans une salle lumineuse.',
      diets: ['Végétarien', 'Sans gluten'],
      program: { type: 'POINTS' as const, title: 'Le carnet rouge', target: 1000, reward: 'Un grand bol au choix offert', rule: 'Dix points par euro dépensé.', style: 'BRAISE' as const },
      menu: [
        { name: 'Riz rouge tofu tamarin', description: 'Pickles minute et beaucoup d’herbes croquantes.', priceCents: 1490 },
        { name: 'Bò bún maison', description: 'Bœuf mariné, vermicelles et cacahuètes.', priceCents: 1550 },
      ],
    },
    {
      slug: 'braise-basilic',
      name: 'Braise & Basilic',
      cuisine: 'Cuisine au feu',
      district: 'Paris 3e',
      address: '5 rue de Bretagne, Paris 3e',
      description: 'Cuissons au feu, légumes de saison et grandes assiettes méditerranéennes.',
      diets: ['Halal', 'Végétarien'],
      program: { type: 'STAMPS' as const, title: 'Les braises fidèles', target: 6, reward: 'Une assiette braisée offerte', rule: 'Une coche par passage.', style: 'ENCRE' as const },
      menu: [
        { name: 'Poulet braisé', description: 'Basilic frais, citron confit et jus réduit.', priceCents: 1900 },
        { name: 'Aubergine braisée', description: 'Yaourt citronné, herbes et noisettes.', priceCents: 1500 },
      ],
    },
  ]

  for (const data of restaurants) {
    const { program, menu, ...restaurantData } = data
    const restaurant = await prisma.restaurant.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        ...restaurantData,
        ownerId: owner.id,
        status: 'VERIFIED',
        hours: [{ day: 'vendredi', open: '11:30', close: '23:00' }],
        program: { create: program },
        menuItems: { create: menu.map((item, position) => ({ ...item, position })) },
      },
    })

    // Une adhésion de démo pour Camille sur chaque restaurant
    await prisma.membership.upsert({
      where: { userId_restaurantId: { userId: member.id, restaurantId: restaurant.id } },
      update: {},
      create: { userId: member.id, restaurantId: restaurant.id },
    })
  }

  console.log('Seed terminé :', await prisma.restaurant.count(), 'restaurants')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
