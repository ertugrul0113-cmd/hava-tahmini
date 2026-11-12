// WMO hava kodları -> simge ve Türkçe açıklama

const KODLAR = {
  0: ['☀️', '🌙', 'Açık'],
  1: ['🌤️', '🌙', 'Az bulutlu'],
  2: ['⛅', '☁️', 'Parçalı bulutlu'],
  3: ['☁️', '☁️', 'Kapalı'],
  45: ['🌫️', '🌫️', 'Sis'],
  48: ['🌫️', '🌫️', 'Kırağılı sis'],
  51: ['🌦️', '🌧️', 'Hafif çisenti'],
  53: ['🌦️', '🌧️', 'Çisenti'],
  55: ['🌧️', '🌧️', 'Yoğun çisenti'],
  56: ['🌧️', '🌧️', 'Donan çisenti'],
  57: ['🌧️', '🌧️', 'Yoğun donan çisenti'],
  61: ['🌦️', '🌧️', 'Hafif yağmur'],
  63: ['🌧️', '🌧️', 'Yağmur'],
  65: ['🌧️', '🌧️', 'Kuvvetli yağmur'],
  66: ['🌧️', '🌧️', 'Donan yağmur'],
  67: ['🌧️', '🌧️', 'Kuvvetli donan yağmur'],
  71: ['🌨️', '🌨️', 'Hafif kar'],
  73: ['🌨️', '🌨️', 'Kar'],
  75: ['❄️', '❄️', 'Yoğun kar'],
  77: ['🌨️', '🌨️', 'Kar taneleri'],
  80: ['🌦️', '🌧️', 'Hafif sağanak'],
  81: ['🌧️', '🌧️', 'Sağanak'],
  82: ['⛈️', '⛈️', 'Şiddetli sağanak'],
  85: ['🌨️', '🌨️', 'Kar sağanağı'],
  86: ['❄️', '❄️', 'Yoğun kar sağanağı'],
  95: ['⛈️', '⛈️', 'Gök gürültülü fırtına'],
  96: ['⛈️', '⛈️', 'Dolu ile fırtına'],
  99: ['⛈️', '⛈️', 'Kuvvetli dolu ile fırtına']
};

export function havaKodu(kod, gunduz = true) {
  const k = KODLAR[kod] || ['·', '·', '–'];
  return { simge: gunduz ? k[0] : k[1], ad: k[2] };
}
