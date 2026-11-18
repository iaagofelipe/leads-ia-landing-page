const PLACES_SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.primaryTypeDisplayName',
  'places.regularOpeningHours.weekdayDescriptions',
].join(',');

/**
 * Busca estabelecimentos na Google Places API (New).
 */
export async function searchGooglePlaces({ apiKey, query, maxResults = 10 }) {
  if (!apiKey) {
    throw new Error(
      'GOOGLE_PLACES_API_KEY não configurada. Preencha o arquivo .env ou rode em modo --demo.'
    );
  }

  const pageSize = Math.min(Math.max(Number(maxResults) || 10, 1), 20);

  const response = await fetch(PLACES_SEARCH_TEXT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: 'pt-BR',
      regionCode: 'BR',
      pageSize,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Erro na Google Places API (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const places = data.places || [];

  return places.map((place) => ({
    id: place.id,
    name: place.displayName?.text || 'Estabelecimento sem nome',
    category: place.primaryTypeDisplayName?.text || 'Clínica Odontológica & Estética',
    address: place.formattedAddress || '',
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
    internationalPhone: place.internationalPhoneNumber || '',
    websiteUri: place.websiteUri || null,
    rating: typeof place.rating === 'number' ? place.rating : null,
    reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : 0,
    googleMapsUri: place.googleMapsUri || '',
    openingHours: place.regularOpeningHours?.weekdayDescriptions || [],
  }));
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_LOOKUP_URL = 'https://nominatim.openstreetmap.org/lookup';
const PHOTON_URL = 'https://photon.komoot.io/api/';
const OSM_USER_AGENT = 'lead-preview-poc/0.1 (local-dev-poc)';

function parseQueryForOsm(rawQuery) {
  const text = String(rawQuery || '').trim();
  const emMatch = text.match(/^(.*?)\s+em\s+(.+)$/i);
  if (emMatch) {
    return { nicheText: emMatch[1].trim(), cityText: emMatch[2].trim() };
  }
  return { nicheText: text, cityText: text };
}

function buildPhotonQueries(nicheText) {
  const lower = String(nicheText || '').toLowerCase();
  if (/est[eé]tica|beleza|harmoniza/i.test(lower)) {
    return [
      { q: 'estetica', osmTag: 'shop:beauty' },
      { q: 'estetica', osmTag: 'healthcare:clinic' },
      { q: 'clinica', osmTag: 'amenity:dentist' },
    ];
  }
  return [
    { q: 'clinica', osmTag: 'amenity:dentist' },
    { q: 'odonto', osmTag: null },
    { q: 'dentista', osmTag: null },
    { q: 'sorriso', osmTag: 'amenity:dentist' },
  ];
}

function isAllowedBusinessFeature(props) {
  const key = props?.osm_key;
  const val = props?.osm_value;
  if (!props?.name) return false;
  if (['highway', 'boundary', 'place', 'railway', 'natural', 'waterway'].includes(key)) {
    return false;
  }
  if (key === 'amenity' && ['dentist', 'clinic', 'doctors'].includes(val)) return true;
  if (key === 'healthcare') return true;
  if (key === 'shop' && ['beauty', 'yes'].includes(val)) return true;
  return /odonto|dent|sorriso|est[eé]tica|cl[ií]nica/i.test(props.name);
}

function normalizeWebsite(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function formatOsmAddress({ address = {}, props = {}, fallbackCity }) {
  const street = address.road || props.street;
  const number = address.house_number || props.housenumber;
  const suburb = address.suburb || address.neighbourhood || props.district;
  const city = address.city || address.town || props.city || fallbackCity;
  const state = address.state || props.state;

  const parts = [];
  if (street) parts.push(number ? `${street}, ${number}` : street);
  if (suburb) parts.push(suburb);
  if (city) parts.push(state ? `${city} - ${state}` : city);
  return parts.join(' • ') || fallbackCity;
}

async function fetchNominatimCityBounds(cityText) {
  const url = new URL(NOMINATIM_SEARCH_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('q', cityText);

  const response = await fetch(url, {
    headers: {
      'User-Agent': OSM_USER_AGENT,
      'Accept-Language': 'pt-BR',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Erro no Nominatim (${response.status})`);
  }

  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error(`Cidade/região não encontrada no OpenStreetMap: "${cityText}"`);
  }

  const hit = results[0];
  // Nominatim boundingbox: [south, north, west, east]
  const [south, north, west, east] = hit.boundingbox.map(Number);
  return {
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    // Photon bbox espera: minLon,minLat,maxLon,maxLat
    photonBbox: `${west},${south},${east},${north}`,
  };
}

async function fetchPhotonFeatures({ q, osmTag, lat, lon, photonBbox, limit }) {
  const url = new URL(PHOTON_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('bbox', photonBbox);
  url.searchParams.set('limit', String(limit));
  if (osmTag) {
    url.searchParams.set('osm_tag', osmTag);
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': OSM_USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data.features) ? data.features : [];
}

async function lookupNominatimDetails(osmIds) {
  if (osmIds.length === 0) return new Map();

  const url = new URL(NOMINATIM_LOOKUP_URL);
  url.searchParams.set('format', 'json');
  url.searchParams.set('extratags', '1');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('osm_ids', osmIds.join(','));

  const response = await fetch(url, {
    headers: {
      'User-Agent': OSM_USER_AGENT,
      'Accept-Language': 'pt-BR',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return new Map();
  const items = await response.json();
  const map = new Map();
  if (Array.isArray(items)) {
    for (const item of items) {
      const prefix = item.osm_type?.[0]?.toUpperCase();
      if (prefix && item.osm_id) {
        map.set(`${prefix}${item.osm_id}`, item);
      }
    }
  }
  return map;
}

/**
 * Busca estabelecimentos reais gratuitamente via OpenStreetMap (Nominatim + Photon).
 */
export async function searchOpenStreetMap({ query, maxResults = 10 }) {
  const { nicheText, cityText } = parseQueryForOsm(query);
  const bounds = await fetchNominatimCityBounds(cityText);
  const queries = buildPhotonQueries(nicheText);
  const limit = Math.min(Math.max(Number(maxResults) || 10, 1), 30);

  const batches = await Promise.all(
    queries.map((item) =>
      fetchPhotonFeatures({
        ...item,
        ...bounds,
        limit: Math.max(limit, 15),
      }).catch(() => [])
    )
  );

  const seenIds = new Set();
  const seenNames = new Set();
  const candidates = [];

  for (const features of batches) {
    for (const feature of features) {
      const props = feature.properties || {};
      if (!isAllowedBusinessFeature(props)) continue;

      const osmKey = `${props.osm_type}${props.osm_id}`;
      const nameKey = props.name.trim().toLowerCase();
      if (seenIds.has(osmKey) || seenNames.has(nameKey)) continue;

      seenIds.add(osmKey);
      seenNames.add(nameKey);
      candidates.push(feature);

      if (candidates.length >= limit) break;
    }
    if (candidates.length >= limit) break;
  }

  const osmIds = candidates.map((f) => `${f.properties.osm_type}${f.properties.osm_id}`);
  const detailsById = await lookupNominatimDetails(osmIds);

  return candidates.map((feature) => {
    const props = feature.properties || {};
    const osmKey = `${props.osm_type}${props.osm_id}`;
    const detail = detailsById.get(osmKey) || {};
    const tags = detail.extratags || {};
    const coords = feature.geometry?.coordinates || [];
    const lon = coords[0];
    const lat = coords[1];

    const rawWebsite =
      tags.website || tags['contact:website'] || tags['contact:instagram'] || null;
    const phone = tags['contact:whatsapp'] || tags['contact:phone'] || tags.phone || '';

    return {
      id: `osm-${osmKey}`,
      name: props.name.trim(),
      category:
        props.osm_value === 'dentist' || tags.healthcare === 'dentist'
          ? 'Clínica Odontológica'
          : 'Clínica & Estética',
      address: formatOsmAddress({
        address: detail.address,
        props,
        fallbackCity: cityText,
      }),
      phone,
      internationalPhone: phone,
      websiteUri: normalizeWebsite(rawWebsite),
      rating: null,
      reviewCount: 0,
      googleMapsUri:
        lat && lon
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`
          : `https://www.openstreetmap.org/${props.osm_type === 'W' ? 'way' : 'node'}/${props.osm_id}`,
      openingHours: tags.opening_hours ? [tags.opening_hours] : [],
    };
  });
}

/**
 * Retorna estabelecimentos fictícios para testar o fluxo completo sem consumir cota da API.
 */
export function getDemoPlaces() {
  return [
    {
      id: 'demo-1',
      name: 'Clínica OdontoVida Bem-Estar',
      category: 'Clínica odontológica',
      address: 'Av. Barão de Itapura, 1420 - Guanabara, Campinas - SP',
      phone: '(19) 99123-4567',
      internationalPhone: '+55 19 99123-4567',
      websiteUri: null,
      rating: 4.9,
      reviewCount: 142,
      googleMapsUri: 'https://maps.google.com/?q=Clinica+OdontoVida+Campinas',
      openingHours: [
        'segunda-feira: 08:30 – 18:30',
        'terça-feira: 08:30 – 18:30',
        'quarta-feira: 08:30 – 18:30',
        'quinta-feira: 08:30 – 18:30',
        'sexta-feira: 08:30 – 18:00',
        'sábado: 08:30 – 12:30',
      ],
    },
    {
      id: 'demo-2',
      name: 'Instituto Sorriso & Harmonização',
      category: 'Clínica de estética facial e odontologia',
      address: 'Rua Coronel Quirino, 880 - Cambuí, Campinas - SP',
      phone: '(19) 99876-5432',
      internationalPhone: '+55 19 99876-5432',
      websiteUri: 'https://www.instagram.com/institutosorrisocampinas',
      rating: 4.7,
      reviewCount: 89,
      googleMapsUri: 'https://maps.google.com/?q=Instituto+Sorriso+Cambui',
      openingHours: [
        'segunda-feira: 09:00 – 19:00',
        'terça-feira: 09:00 – 19:00',
        'quarta-feira: 09:00 – 19:00',
        'quinta-feira: 09:00 – 19:00',
        'sexta-feira: 09:00 – 18:00',
      ],
    },
    {
      id: 'demo-3',
      name: 'Oral Prime Implantes',
      category: 'Clínica odontológica',
      address: 'Av. Norte-Sul, 510 - Cambuí, Campinas - SP',
      phone: '(19) 99333-2211',
      internationalPhone: '+55 19 99333-2211',
      websiteUri: 'http://site-inexistente-exemplo-poc.invalid',
      rating: 4.5,
      reviewCount: 54,
      googleMapsUri: 'https://maps.google.com/?q=Oral+Prime+Campinas',
      openingHours: [
        'segunda-feira: 08:00 – 18:00',
        'terça-feira: 08:00 – 18:00',
        'quarta-feira: 08:00 – 18:00',
        'quinta-feira: 08:00 – 18:00',
        'sexta-feira: 08:00 – 17:00',
      ],
    },
    {
      id: 'demo-4',
      name: 'Exemplo Clínica Já Estruturada',
      category: 'Clínica odontológica',
      address: 'Av. Brasil, 200 - Jardim Chapadão, Campinas - SP',
      phone: '(19) 99444-5566',
      internationalPhone: '+55 19 99444-5566',
      websiteUri: 'https://example.com',
      rating: 4.6,
      reviewCount: 65,
      googleMapsUri: 'https://maps.google.com/?q=Clinica+Exemplo',
      openingHours: [],
    },
  ];
}
