/**
 * Servicio de categorización basado en reglas de palabras clave (Keywords).
 * Optimizado para comercios y servicios en Chile.
 */

export interface Category {
  id: string;
  name: string;
}

const KEYWORD_RULES: Record<string, string[]> = {
  'Alimentación básica': [
    'jumbo', 'lider', 'unimarc', 'santa isabel', 'tottus', 'smu', 'walmart', 'supermercado', 
    'mayorista 10', 'alvi', 'monserrat', 'erbi', 'ok market', 'oxxo'
  ],
  'Comida y antojos': [
    'pedidosya', 'uber eats', 'rappi', 'mcdonalds', 'burger king', 'pizza', 'kentucky', 'kfc',
    'starbucks', 'dunkin', 'papa johns', 'melt', 'grido', 'juan maestro', 'doggi', 'tarragona',
    'wendy', 'restaurant', 'cafeteria', 'casino', 'bar', 'pub'
  ],
  'Transporte': [
    'uber', 'cabify', 'didi', 'bip', 'metro', 'transantiago', 'copec', 'shell', 'petrobras',
    'enex', 'terpel', 'peaje', 'costanera norte', 'vespucio', 'autopista', 'parking', 
    'estacionamiento', 'rent a car', 'turbus', 'pullman'
  ],
  'Salud': [
    'farmacia', 'cruz verde', 'salcobrand', 'ahumada', 'dr simi', 'clinica', 'hospital',
    'integramedica', 'redsalud', 'isapre', 'fonasa', 'laboratorio', 'dental', 'optica'
  ],
  'Ocio y entretenimiento': [
    'netflix', 'spotify', 'disney', 'hbo', 'amazon prime', 'steam', 'playstation', 'xbox',
    'cinehoyts', 'cinemark', 'cineplanet', 'teatro', 'concierto', 'ticketmaster', 'puntoticket',
    'feria ticket', 'gimnasio', 'smartfit', 'pacific'
  ],
  'Ropa y cuidado personal': [
    'falabella', 'ripley', 'paris', 'h&m', 'zara', 'decathlon', 'tricot', 'corona', 'la polar',
    'forus', 'adidas', 'nike', 'lippi', 'peluqueria', 'barberia', 'beauty'
  ],
  'Servicios del hogar': [
    'enel', 'cge', 'aguas andinas', 'esval', 'essbio', 'metrogas', 'abastible', 'lipigas',
    'gasco', 'vtr', 'movistar', 'entel', 'claro', 'wom', 'gtd', 'telsur', 'directv'
  ],
  'Vivienda': [
    'arriendo', 'gastos comunes', 'edificio', 'condominio', 'sodimac', 'easy', 'ikea', 'concha y toro'
  ],
  'Deudas y productos financieros': [
    'banco', 'santander', 'bci', 'itau', 'scotiabank', 'bice', 'bancoestado', 'credito', 'prestamo', 'cuota'
  ],
  'Seguros': [
    'seguro', 'soap', 'isapre', 'afp'
  ]
};

/**
 * Intenta categorizar una descripción de transacción usando palabras clave.
 * @param description Descripción de la transacción (glosa/comercio)
 * @param categories Lista de categorías disponibles en la base de datos
 * @returns ID de la categoría encontrada o null
 */
export function categorizeByKeywords(description: string, categories: Category[]): string | null {
  if (!description) return null;
  
  const descLower = description.toLowerCase();
  
  for (const [catName, keywords] of Object.entries(KEYWORD_RULES)) {
    if (keywords.some(kw => descLower.includes(kw))) {
      // Buscar la categoría correspondiente en la lista de la BD por nombre
      const match = categories.find(c => 
        c.name.toLowerCase() === catName.toLowerCase() ||
        catName.toLowerCase().includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(catName.toLowerCase())
      );
      
      if (match) return match.id;
    }
  }
  
  return null;
}
