export const GLOBAL_CITIES = [
  { id: 'all', name: 'All Cities', country: 'Global' },
  { id: 'london', name: 'London', country: 'United Kingdom' },
  { id: 'new-york', name: 'New York', country: 'United States' },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan' },
  { id: 'lagos', name: 'Lagos', country: 'Nigeria' },
  { id: 'berlin', name: 'Berlin', country: 'Germany' },
  { id: 'toronto', name: 'Toronto', country: 'Canada' },
  { id: 'abuja', name: 'Abuja', country: 'Nigeria' },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenya' },
  { id: 'accra', name: 'Accra', country: 'Ghana' },
  { id: 'cape-town', name: 'Cape Town', country: 'South Africa' }
];

export const CITY_NEIGHBORHOODS = {
  'London': ['Shoreditch', 'Soho', 'Camden', 'Brixton', 'Kensington', 'Hackney', 'Notting Hill'],
  'New York': ['Brooklyn', 'Manhattan', 'Williamsburg', 'Greenwich Village', 'Astoria', 'Harlem'],
  'Tokyo': ['Shibuya', 'Shinjuku', 'Harajuku', 'Roppongi', 'Akihabara', 'Ginza'],
  'Lagos': ['Victoria Island', 'Lekki', 'Ikeja', 'Ikoyi', 'Yaba', 'Surulere'],
  'Berlin': ['Kreuzberg', 'Mitte', 'Neukölln', 'Friedrichshain', 'Prenzlauer Berg'],
  'Toronto': ['Downtown', 'West End', 'Yorkville', 'Queen West', 'Kensington Market'],
  'Abuja': ['Maitama', 'Wuse 2', 'Jabi', 'Garki', 'Wuye', 'Gwarinpa', 'Asokoro', 'Life Camp'],
  'Nairobi': ['Westlands', 'Kilimani', 'Karen', 'Lavington', 'Gigiri'],
  'Accra': ['Osu', 'East Legon', 'Cantonments', 'Airport Residential', 'Labadi'],
  'Cape Town': ['Kloof Street', 'Camps Bay', 'Sea Point', 'Waterfront', 'Woodstock']
};

export const LOCATIONS = ['Anywhere', ...GLOBAL_CITIES.filter(c => c.id !== 'all').map(c => c.name)];
