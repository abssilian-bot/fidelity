/** Catégories compréhensibles par les clients, communes aux deux recherches et à la Façade. */
export const FOOD_CATEGORIES = [
  { id: 'burger', label: 'Burger', aliases: ['burger', 'burgers', 'hamburger', 'hamburgers'] },
  { id: 'pizza', label: 'Pizza', aliases: ['pizza', 'pizzas', 'pizzeria'] },
  { id: 'sushi', label: 'Sushi', aliases: ['sushi', 'sushis', 'maki', 'makis', 'sashimi'] },
  { id: 'ramen', label: 'Ramen', aliases: ['ramen', 'ramens'] },
  { id: 'brunch', label: 'Brunch', aliases: ['brunch', 'brunchs', 'brunches'] },
  { id: 'tacos', label: 'Tacos', aliases: ['tacos', 'taco', 'burrito', 'burritos', 'quesadilla'] },
  { id: 'kebab', label: 'Kebab', aliases: ['kebab', 'kebabs', 'doner'] },
  { id: 'grillades', label: 'Grillades', aliases: ['grillade', 'grillades', 'barbecue', 'bbq', 'braise', 'braisee', 'braises', 'braisees', 'au feu'] },
  { id: 'italien', label: 'Italien', aliases: ['italien', 'italienne', 'italiens', 'italiennes', 'italie', 'italian', 'pasta', 'pates', 'risotto'] },
  { id: 'japonais', label: 'Japonais', aliases: ['japonais', 'japonaise', 'japonaises', 'japon', 'japanese'] },
  { id: 'asiatique', label: 'Asiatique', aliases: ['asiatique', 'asiatiques', 'asian', 'chinois', 'chinoise', 'vietnamien', 'vietnamienne', 'thai', 'thailandaise', 'coreen', 'coreenne'] },
  { id: 'indien', label: 'Indien', aliases: ['indien', 'indienne', 'indiennes', 'inde', 'indian', 'tandoori'] },
  { id: 'libanais', label: 'Libanais', aliases: ['libanais', 'libanaise', 'liban', 'lebanese'] },
  { id: 'marocain', label: 'Marocain', aliases: ['marocain', 'marocaine', 'marocaines', 'maroc', 'moroccan'] },
  { id: 'couscous', label: 'Couscous & tajines', aliases: ['couscous', 'tajine', 'tajines', 'tagine'] },
  { id: 'mexicain', label: 'Mexicain', aliases: ['mexicain', 'mexicaine', 'mexicaines', 'mexique', 'mexican'] },
  { id: 'francais', label: 'Français', aliases: ['francais', 'francaise', 'francaises', 'bistrot', 'bistro', 'brasserie'] },
  { id: 'mediterraneen', label: 'Méditerranéen', aliases: ['mediterraneen', 'mediterraneenne', 'mediterraneennes', 'mediterranean'] },
  { id: 'salades', label: 'Salades & bowls', aliases: ['salade', 'salades', 'bowl', 'bowls', 'poke', 'pokebowl'] },
  { id: 'cafe', label: 'Café', aliases: ['cafe', 'coffee', 'coffee shop', 'cafe de specialite'] },
  { id: 'desserts', label: 'Desserts', aliases: ['dessert', 'desserts', 'patisserie', 'patisseries', 'crepe', 'crepes', 'glace', 'glaces'] },
] as const

export const DIET_FILTERS = [
  { id: 'vege', label: 'Végé', value: 'Végétarien', aliases: ['vege', 'vegetarien', 'vegetarienne', 'vegetariennes', 'vegetariens', 'vegetarian', 'veggie', 'sans viande'] },
  { id: 'vegan', label: 'Végan', value: 'Végan', aliases: ['vegan', 'vegane', 'vegans', 'vegetalien', 'vegetalienne'] },
  { id: 'halal', label: 'Halal', value: 'Halal', aliases: ['halal', 'hallal'] },
  { id: 'sans-gluten', label: 'Sans gluten', value: 'Sans gluten', aliases: ['sans gluten', 'gluten free'] },
] as const

export const SERVICE_FILTERS = [
  { id: 'terrasse', label: 'Terrasse', aliases: ['terrasse', 'terrasses'] },
  { id: 'emporter', label: 'À emporter', aliases: ['a emporter', 'emporter', 'takeaway', 'take away'] },
  { id: 'livraison', label: 'Livraison', aliases: ['livraison', 'delivery'] },
] as const

export const QUICK_FILTERS = ['burger', 'pizza', 'vege', 'halal', 'sushi', 'ramen', 'brunch', 'tacos', 'vegan', 'terrasse']

export const WEEK_DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
