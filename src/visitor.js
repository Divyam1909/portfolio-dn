// Rough visitor location from the browser's time zone — no network request, no permission prompt.
const ZONES = {
  'America/Los_Angeles': [37.77, -122.42, 'San Francisco'], 'America/Vancouver': [49.28, -123.12, 'Vancouver'],
  'America/Denver': [39.74, -104.99, 'Denver'], 'America/Phoenix': [33.45, -112.07, 'Phoenix'],
  'America/Chicago': [41.88, -87.63, 'Chicago'], 'America/Mexico_City': [19.43, -99.13, 'Mexico City'],
  'America/New_York': [40.71, -74.0, 'New York'], 'America/Toronto': [43.65, -79.38, 'Toronto'],
  'America/Sao_Paulo': [-23.55, -46.63, 'São Paulo'], 'America/Argentina/Buenos_Aires': [-34.6, -58.38, 'Buenos Aires'],
  'America/Bogota': [4.71, -74.07, 'Bogotá'], 'America/Lima': [-12.05, -77.04, 'Lima'],
  'Europe/London': [51.5, -0.12, 'London'], 'Europe/Dublin': [53.35, -6.26, 'Dublin'], 'Europe/Lisbon': [38.72, -9.14, 'Lisbon'],
  'Europe/Paris': [48.86, 2.35, 'Paris'], 'Europe/Madrid': [40.42, -3.7, 'Madrid'], 'Europe/Amsterdam': [52.37, 4.9, 'Amsterdam'],
  'Europe/Berlin': [52.52, 13.4, 'Berlin'], 'Europe/Zurich': [47.37, 8.54, 'Zurich'], 'Europe/Rome': [41.9, 12.5, 'Rome'],
  'Europe/Stockholm': [59.33, 18.07, 'Stockholm'], 'Europe/Warsaw': [52.23, 21.01, 'Warsaw'], 'Europe/Istanbul': [41.01, 28.98, 'Istanbul'],
  'Europe/Moscow': [55.76, 37.62, 'Moscow'], 'Africa/Cairo': [30.04, 31.24, 'Cairo'], 'Africa/Lagos': [6.52, 3.38, 'Lagos'],
  'Africa/Nairobi': [-1.29, 36.82, 'Nairobi'], 'Africa/Johannesburg': [-26.2, 28.05, 'Johannesburg'],
  'Asia/Dubai': [25.2, 55.27, 'Dubai'], 'Asia/Riyadh': [24.71, 46.68, 'Riyadh'], 'Asia/Karachi': [24.86, 67.0, 'Karachi'],
  'Asia/Kolkata': [28.61, 77.21, 'New Delhi'], 'Asia/Calcutta': [28.61, 77.21, 'New Delhi'], 'Asia/Kathmandu': [27.72, 85.32, 'Kathmandu'],
  'Asia/Dhaka': [23.81, 90.41, 'Dhaka'], 'Asia/Colombo': [6.93, 79.86, 'Colombo'], 'Asia/Bangkok': [13.76, 100.5, 'Bangkok'],
  'Asia/Jakarta': [-6.2, 106.85, 'Jakarta'], 'Asia/Singapore': [1.35, 103.82, 'Singapore'], 'Asia/Kuala_Lumpur': [3.14, 101.69, 'Kuala Lumpur'],
  'Asia/Manila': [14.6, 120.98, 'Manila'], 'Asia/Hong_Kong': [22.32, 114.17, 'Hong Kong'], 'Asia/Shanghai': [31.23, 121.47, 'Shanghai'],
  'Asia/Taipei': [25.03, 121.57, 'Taipei'], 'Asia/Seoul': [37.57, 126.98, 'Seoul'], 'Asia/Tokyo': [35.68, 139.69, 'Tokyo'],
  'Australia/Perth': [-31.95, 115.86, 'Perth'], 'Australia/Sydney': [-33.87, 151.21, 'Sydney'], 'Australia/Melbourne': [-37.81, 144.96, 'Melbourne'],
  'Pacific/Auckland': [-36.85, 174.76, 'Auckland'],
}

export function guessVisitor() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const z = ZONES[tz]
    if (!z) return null
    return { lat: z[0], lon: z[1], city: z[2] }
  } catch {
    return null
  }
}
