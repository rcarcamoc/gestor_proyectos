/**
 * Servicio de categorización basado en reglas de palabras clave (Keywords).
 * Optimizado para comercios y servicios en Chile.
 */

export interface Category {
  id: string;
  name: string;
}

const KEYWORD_RULES: Record<string, string[]> = {
  'Alimentación básica (hogar)': [
    'jumbo', 'lider', 'unimarc', 'santa isabel', 'tottus', 'smu', 'walmart', 'supermercado', 
    'mayorista 10', 'alvi', 'monserrat', 'erbi', 'ok market', 'oxxo', 'almacen', 'veguita'
  ],
  'Comida y antojos (placer)': [
    'pedidosya', 'uber eats', 'rappi', 'mcdonalds', 'burger king', 'pizza', 'kentucky', 'kfc',
    'starbucks', 'dunkin', 'papa johns', 'melt', 'grido', 'juan maestro', 'doggi', 'tarragona',
    'wendy', 'restaurant', 'cafeteria', 'casino', 'bar', 'pub', 'salir a comer', 'delivery', 'antojos'
  ],
  'Transporte': [
    'uber', 'cabify', 'didi', 'bip', 'metro', 'transantiago', 'copec', 'shell', 'petrobras',
    'enex', 'terpel', 'peaje', 'costanera norte', 'vespucio', 'autopista', 'parking', 
    'estacionamiento', 'rent a car', 'turbus', 'pullman', 'bencina'
  ],
  'Salud': [
    'farmacia', 'cruz verde', 'salcobrand', 'ahumada', 'dr simi', 'clinica', 'hospital',
    'integramedica', 'redsalud', 'isapre', 'fonasa', 'laboratorio', 'dental', 'optica', 'medico'
  ],
  'Ocio y entretenimiento': [
    'netflix', 'spotify', 'disney', 'hbo', 'amazon prime', 'steam', 'playstation', 'xbox',
    'cinehoyts', 'cinemark', 'cineplanet', 'teatro', 'concierto', 'ticketmaster', 'puntoticket',
    'feria ticket', 'gimnasio', 'smartfit', 'pacific', 'streaming', 'vacaciones'
  ],
  'Ropa y cuidado personal': [
    'falabella', 'ripley', 'paris', 'h&m', 'zara', 'decathlon', 'tricot', 'corona', 'la polar',
    'forus', 'adidas', 'nike', 'lippi', 'peluqueria', 'barberia', 'beauty', 'ropa'
  ],
  'Servicios del hogar': [
    'enel', 'cge', 'aguas andinas', 'esval', 'essbio', 'metrogas', 'abastible', 'lipigas',
    'gasco', 'vtr', 'movistar', 'entel', 'claro', 'wom', 'gtd', 'telsur', 'directv', 'luz', 'agua', 'gas', 'internet', 'celular'
  ],
  'Vivienda': [
    'arriendo', 'gastos comunes', 'edificio', 'condominio', 'sodimac', 'easy', 'ikea', 'concha y toro', 'casa'
  ],
  'Deudas y productos financieros': [
    'banco', 'santander', 'bci', 'itau', 'scotiabank', 'bice', 'bancoestado', 'credito', 'prestamo', 'cuota', 'tarjeta titular'
  ],
  'Seguros': [
    'seguro', 'soap'
  ],
  'Familia y mascotas': [
    'regalos', 'bubi', 'choquito', 'gatos', 'veterinaria', 'pet'
  ],
  'Imprevistos / misceláneos': [
    'imprevistos', 'otros', 'varios'
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
