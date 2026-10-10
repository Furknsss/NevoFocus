import { FlightAirport } from '../types';

export const TURKEY_AIRPORTS: FlightAirport[] = [
  { code: 'IST', city: 'İstanbul', country: 'Türkiye', name: 'İstanbul Havalimanı', lat: 41.275, lng: 28.751 },
  { code: 'SAW', city: 'İstanbul', country: 'Türkiye', name: 'Sabiha Gökçen Havalimanı', lat: 40.898, lng: 29.309 },
  { code: 'ESB', city: 'Ankara', country: 'Türkiye', name: 'Ankara Esenboğa Havalimanı', lat: 40.128, lng: 32.995 },
  { code: 'ADB', city: 'İzmir', country: 'Türkiye', name: 'İzmir Adnan Menderes Havalimanı', lat: 38.292, lng: 27.157 },
  { code: 'AYT', city: 'Antalya', country: 'Türkiye', name: 'Antalya Havalimanı', lat: 36.899, lng: 30.801 },
  { code: 'TZX', city: 'Trabzon', country: 'Türkiye', name: 'Trabzon Havalimanı', lat: 40.995, lng: 39.789 },
  { code: 'COV', city: 'Adana / Mersin', country: 'Türkiye', name: 'Çukurova Uluslararası Havalimanı', lat: 36.901, lng: 35.064 },
  { code: 'GZT', city: 'Gaziantep', country: 'Türkiye', name: 'Gaziantep Havalimanı', lat: 36.947, lng: 37.478 },
  { code: 'BJV', city: 'Muğla / Bodrum', country: 'Türkiye', name: 'Milas-Bodrum Havalimanı', lat: 37.250, lng: 27.664 },
  { code: 'DLM', city: 'Muğla / Dalaman', country: 'Türkiye', name: 'Dalaman Havalimanı', lat: 36.713, lng: 28.792 },
  { code: 'ASR', city: 'Kayseri', country: 'Türkiye', name: 'Kayseri Havalimanı', lat: 38.770, lng: 35.495 },
  { code: 'DIY', city: 'Diyarbakır', country: 'Türkiye', name: 'Diyarbakır Havalimanı', lat: 37.893, lng: 40.201 },
  { code: 'ERZ', city: 'Erzurum', country: 'Türkiye', name: 'Erzurum Havalimanı', lat: 39.956, lng: 41.170 },
  { code: 'VAN', city: 'Van', country: 'Türkiye', name: 'Van Ferit Melen Havalimanı', lat: 38.468, lng: 43.332 },
  { code: 'SZF', city: 'Samsun', country: 'Türkiye', name: 'Samsun Çarşamba Havalimanı', lat: 41.258, lng: 36.548 },
  { code: 'RZV', city: 'Rize / Artvin', country: 'Türkiye', name: 'Rize-Artvin Havalimanı', lat: 41.174, lng: 40.830 },
  { code: 'KYA', city: 'Konya', country: 'Türkiye', name: 'Konya Havalimanı', lat: 37.979, lng: 32.562 },
  { code: 'GNY', city: 'Şanlıurfa', country: 'Türkiye', name: 'Şanlıurfa GAP Havalimanı', lat: 37.452, lng: 38.908 },
  { code: 'MLX', city: 'Malatya', country: 'Türkiye', name: 'Malatya Erhaç Havalimanı', lat: 38.435, lng: 38.090 },
  { code: 'AOE', city: 'Eskişehir', country: 'Türkiye', name: 'Eskişehir Hasan Polatkan Havalimanı', lat: 39.812, lng: 30.518 },
  { code: 'VAS', city: 'Sivas', country: 'Türkiye', name: 'Sivas Nuri Demirağ Havalimanı', lat: 39.814, lng: 36.903 },
  { code: 'KZR', city: 'Kütahya / Zafer', country: 'Türkiye', name: 'Zafer Havalimanı', lat: 39.112, lng: 30.130 },
  { code: 'BAL', city: 'Batman', country: 'Türkiye', name: 'Batman Havalimanı', lat: 37.929, lng: 41.117 },
  { code: 'KSY', city: 'Kars', country: 'Türkiye', name: 'Kars Harakani Havalimanı', lat: 40.562, lng: 43.115 },
  { code: 'DNZ', city: 'Denizli', country: 'Türkiye', name: 'Denizli Çardak Havalimanı', lat: 37.785, lng: 29.701 },
];

export const WORLD_AIRPORTS: FlightAirport[] = [
  { code: 'LHR', city: 'Londra', country: 'İngiltere', name: 'Heathrow Havalimanı', lat: 51.470, lng: -0.454 },
  { code: 'JFK', city: 'New York', country: 'ABD', name: 'John F. Kennedy Havalimanı', lat: 40.641, lng: -73.778 },
  { code: 'HND', city: 'Tokyo', country: 'Japonya', name: 'Haneda Havalimanı', lat: 35.549, lng: 139.779 },
  { code: 'CDG', city: 'Paris', country: 'Fransa', name: 'Charles de Gaulle Havalimanı', lat: 49.009, lng: 2.547 },
  { code: 'DXB', city: 'Dubai', country: 'BAE', name: 'Dubai Uluslararası Havalimanı', lat: 25.253, lng: 55.365 },
  { code: 'SIN', city: 'Singapur', country: 'Singapur', name: 'Changi Havalimanı', lat: 1.364, lng: 103.991 },
  { code: 'FRA', city: 'Frankfurt', country: 'Almanya', name: 'Frankfurt Havalimanı', lat: 50.037, lng: 8.562 },
  { code: 'AMS', city: 'Amsterdam', country: 'Hollanda', name: 'Schiphol Havalimanı', lat: 52.310, lng: 4.768 },
  { code: 'ICN', city: 'Seul', country: 'Güney Kore', name: 'Incheon Uluslararası Havalimanı', lat: 37.460, lng: 126.440 },
  { code: 'DOH', city: 'Doha', country: 'Katar', name: 'Hamad Uluslararası Havalimanı', lat: 25.273, lng: 51.608 },
  { code: 'LAX', city: 'Los Angeles', country: 'ABD', name: 'Los Angeles Uluslararası Havalimanı', lat: 33.942, lng: -118.408 },
  { code: 'SYD', city: 'Sidney', country: 'Avustralya', name: 'Kingsford Smith Havalimanı', lat: -33.939, lng: 151.175 },
  { code: 'GIG', city: 'Rio de Janeiro', country: 'Brezilya', name: 'Galeão Uluslararası Havalimanı', lat: -22.808, lng: -43.243 },
  { code: 'CAI', city: 'Kahire', country: 'Mısır', name: 'Kahire Uluslararası Havalimanı', lat: 30.121, lng: 31.405 },
  { code: 'YYZ', city: 'Toronto', country: 'Kanada', name: 'Pearson Uluslararası Havalimanı', lat: 43.677, lng: -79.624 },
  { code: 'BCN', city: 'Barselona', country: 'İspanya', name: 'El Prat Havalimanı', lat: 41.297, lng: 2.078 },
  { code: 'FCO', city: 'Roma', country: 'İtalya', name: 'Fiumicino Havalimanı', lat: 41.800, lng: 12.238 },
];

export const ALL_AIRPORTS: FlightAirport[] = [...TURKEY_AIRPORTS, ...WORLD_AIRPORTS];
export const POPULAR_AIRPORTS = ALL_AIRPORTS;
