// Philippine Geographic Locations Data (PSGC inspired dataset)

export interface RegionData {
  code: string;
  name: string;
  cities: {
    name: string;
    barangays: string[];
  }[];
}

export const PHILIPPINE_REGIONS: RegionData[] = [
  {
    code: 'NCR',
    name: 'NCR (National Capital Region)',
    cities: [
      {
        name: 'Manila',
        barangays: [
          'Ermita (Barangay 659)',
          'Ermita (Barangay 660)',
          'Ermita (Barangay 661)',
          'Ermita (Barangay 663)',
          'Malate (Barangay 688)',
          'Malate (Barangay 690)',
          'Malate (Barangay 701)',
          'Paco (Barangay 671)',
          'Paco (Barangay 675)',
          'Binondo (Barangay 287)',
          'Intramuros (Barangay 654)',
          'Quiapo (Barangay 306)',
          'Sampaloc (Barangay 400)',
          'San Miguel (Barangay 637)',
          'Santa Cruz (Barangay 310)',
          'Tondo (Barangay 1)',
          'Tondo (Barangay 100)',
        ],
      },
      {
        name: 'Quezon City',
        barangays: [
          'UP Campus',
          'Diliman / Central',
          'Batasan Hills',
          'Commonwealth',
          'Cubao (Socorro)',
          'Fairview',
          'Kamuning',
          'Loyola Heights',
          'Novaliches Proper',
          'Project 6',
          'Tandang Sora',
          'Ugong Norte',
        ],
      },
      {
        name: 'Makati',
        barangays: [
          'Bel-Air',
          'Dasmariñas',
          'Forbes Park',
          'Poblacion',
          'San Lorenzo',
          'Urdaneta',
          'Pio del Pilar',
          'Guadalupe Nuevo',
          'Guadalupe Viejo',
        ],
      },
      {
        name: 'Pasig',
        barangays: [
          'Kapitolyo',
          'Oranbo',
          'San Antonio',
          'Ugong',
          'Caniogan',
          'Maybunga',
          'Pinagbuhatan',
          'Rosario',
        ],
      },
      {
        name: 'Taguig',
        barangays: [
          'Fort Bonifacio (BGC)',
          'Pinagsama',
          'Ususan',
          'Lower Bicutan',
          'Upper Bicutan',
          'Western Bicutan',
          'Tuktukan',
        ],
      },
      {
        name: 'Mandaluyong',
        barangays: [
          'Addition Hills',
          'Highway Hills',
          'Plainview',
          'Wack-Wack Greenhills',
          'Barangka Drive',
        ],
      },
      {
        name: 'Pasay',
        barangays: [
          'Barangay 76 (MOA Area)',
          'Barangay 183 (Villamor)',
          'Barangay 1',
          'Barangay 14',
          'Barangay 41',
        ],
      },
      {
        name: 'Caloocan',
        barangays: [
          'Barangay 8 (Grace Park)',
          'Barangay 171 (Bagumbong)',
          'Barangay 178 (Camarin)',
          'Barangay 177 (Tala)',
        ],
      },
      {
        name: 'Parañaque',
        barangays: ['BF Homes', 'Don Bosco', 'Moonwalk', 'San Dionisio', 'Sun Valley', 'Tambo'],
      },
      {
        name: 'Las Piñas',
        barangays: ['Alabang-Zapote', 'BF International', 'Pamplona Uno', 'Poblacion', 'Talon Uno'],
      },
      {
        name: 'Marikina',
        barangays: ['Barangka', 'Concepcion Uno', 'Industrial Valley', 'Marikina Heights', 'San Roque'],
      },
      {
        name: 'Muntinlupa',
        barangays: ['Alabang', 'Ayala Alabang', 'Bayanan', 'Poblacion', 'Putatan', 'Tunasan'],
      },
      {
        name: 'Valenzuela',
        barangays: ['Gen. T. de Leon', 'Karuhatan', 'Karuhatan', 'Mapulang Lupa', 'Poblacion'],
      },
      {
        name: 'San Juan',
        barangays: ['Greenhills', 'Addition Hills', 'Little Baguio', 'West Crame'],
      },
      {
        name: 'Malabon',
        barangays: ['Concepcion', 'Flores', 'Longos', 'Potrero', 'Tonsuya'],
      },
      {
        name: 'Navotas',
        barangays: ['Bagumbayan North', 'North Bay Boulevard South', 'San Jose'],
      },
      {
        name: 'Pateros',
        barangays: ['Aguho', 'Martires del 96', 'Poblacion', 'Santa Ana'],
      },
    ],
  },
  {
    code: 'CAR',
    name: 'CAR (Cordillera Administrative Region)',
    cities: [
      {
        name: 'Baguio City',
        barangays: ['Camp 7', 'Irisan', 'Loakan Proper', 'Poblacion', 'Session Road Area'],
      },
      {
        name: 'La Trinidad',
        barangays: ['Balili', 'Poblacion', 'Puguis', 'Tawang'],
      },
    ],
  },
  {
    code: 'REGION_1',
    name: 'Region I (Ilocos Region)',
    cities: [
      {
        name: 'Laoag City',
        barangays: ['Barangay 1 (Poblacion)', 'Barangay 2', 'San Nicolas'],
      },
      {
        name: 'San Fernando City (La Union)',
        barangays: ['Barangay 1', 'Carlatan', 'Parocha', 'Sevilla'],
      },
      {
        name: 'Dagupan City',
        barangays: ['Bolosan', 'Caranglaan', 'Poblacion Oeste', 'Tapuac'],
      },
    ],
  },
  {
    code: 'REGION_2',
    name: 'Region II (Cagayan Valley)',
    cities: [
      {
        name: 'Tuguegarao City',
        barangays: ['Carig Sur', 'Centro 1 (Poblacion)', 'Pengue-Ruyu'],
      },
      {
        name: 'Santiago City',
        barangays: ['Calaocan', 'Dubinan East', 'Four Roads'],
      },
    ],
  },
  {
    code: 'REGION_3',
    name: 'Region III (Central Luzon)',
    cities: [
      {
        name: 'Angeles City',
        barangays: ['Balibago', 'Malabanias', 'Pampang', 'Santo Rosario'],
      },
      {
        name: 'City of San Fernando (Pampanga)',
        barangays: ['Dolores', 'Greenfields', 'San Agustin', 'Santo Niño'],
      },
      {
        name: 'Olongapo City',
        barangays: ['Asinan', 'Barretto', 'East Tapinac', 'West Bajac-Bajac'],
      },
      {
        name: 'Malolos City',
        barangays: ['Catmon', 'Guinhawa', 'San Gabriel', 'Santo Rosario'],
      },
    ],
  },
  {
    code: 'REGION_4A',
    name: 'Region IV-A (CALABARZON)',
    cities: [
      {
        name: 'Antipolo City',
        barangays: ['De La Paz', 'Mayamot', 'Mambugan', 'San Roque', 'Santa Cruz'],
      },
      {
        name: 'Bacoor City',
        barangays: ['Habay I', 'Molino I', 'Molino III', 'Niog I', 'Queens Row Central'],
      },
      {
        name: 'Calamba City',
        barangays: ['Bucal', 'Canlubang', 'Parian', 'Poblacion 1', 'Real'],
      },
      {
        name: 'Dasmariñas City',
        barangays: ['Burol', 'Paliparan I', 'Paliparan III', 'Salawag', 'Sampaloc I'],
      },
      {
        name: 'Imus City',
        barangays: ['Anabu I-A', 'Bucandala I', 'Poblacion I-A', 'Tanzang Luma I'],
      },
      {
        name: 'Santa Rosa City',
        barangays: ['Balibago', 'Don Jose', 'Macabling', 'Poblacion', 'Tagapo'],
      },
      {
        name: 'Batangas City',
        barangays: ['Alangilan', 'Bolbok', 'Kumintang Ibaba', 'Poblacion 1'],
      },
      {
        name: 'Lucena City',
        barangays: ['Barangay 1', 'Gulang-Gulang', 'Iyam', 'Market View'],
      },
    ],
  },
  {
    code: 'MIMAROPA',
    name: 'MIMAROPA Region',
    cities: [
      {
        name: 'Puerto Princesa City',
        barangays: ['Bancao-Bancao', 'San Jose', 'San Pedro', 'Santa Monica'],
      },
      {
        name: 'Calapan City',
        barangays: ['Barangay 1', 'Ilaya', 'San Vicente', 'Suqui'],
      },
    ],
  },
  {
    code: 'REGION_5',
    name: 'Region V (Bicol Region)',
    cities: [
      {
        name: 'Naga City',
        barangays: ['Concepcion Pequeña', 'Concepcion Grande', 'Dayangdang', 'San Francisco'],
      },
      {
        name: 'Legazpi City',
        barangays: ['Bitano', 'Cabangan', 'Imperial Ridge', 'Pinaric'],
      },
    ],
  },
  {
    code: 'REGION_6',
    name: 'Region VI (Western Visayas)',
    cities: [
      {
        name: 'Iloilo City',
        barangays: ['Jaro', 'Mandurriao', 'Molo', 'Poblacion', 'Villa Arevalo'],
      },
      {
        name: 'Bacolod City',
        barangays: ['Bata', 'Mandalagan', 'Singcang-Airport', 'Taculing', 'Villamonte'],
      },
    ],
  },
  {
    code: 'REGION_7',
    name: 'Region VII (Central Visayas)',
    cities: [
      {
        name: 'Cebu City',
        barangays: ['Banilad', 'Guadalupe', 'Lahug', 'Mabolo', 'Pardo', 'Tisa', 'Zapatera'],
      },
      {
        name: 'Mandaue City',
        barangays: ['Bakilid', 'Banilad', 'Centro', 'Subangdaku', 'Tipolo'],
      },
      {
        name: 'Lapu-Lapu City',
        barangays: ['Basak', 'Gun-ob', 'Mactan', 'Pajo', 'Pusok'],
      },
      {
        name: 'Dumaguete City',
        barangays: ['Bantayan', 'Daro', 'Piapi', 'Poblacion 1'],
      },
    ],
  },
  {
    code: 'REGION_8',
    name: 'Region VIII (Eastern Visayas)',
    cities: [
      {
        name: 'Tacloban City',
        barangays: ['Barangay 1', 'Abucay', 'Marasbaras', 'San Jose'],
      },
      {
        name: 'Ormoc City',
        barangays: ['Barangay 1', 'Cogon', 'Lilia Avenue', 'Pugalo'],
      },
    ],
  },
  {
    code: 'REGION_9',
    name: 'Region IX (Zamboanga Peninsula)',
    cities: [
      {
        name: 'Zamboanga City',
        barangays: ['Canelar', 'Guiwan', 'Pasonanca', 'San Jose Gusu', 'Tetuan'],
      },
      {
        name: 'Pagadian City',
        barangays: ['Balangasan', 'Gaisano Area', 'San Pedro', 'Tuburan'],
      },
    ],
  },
  {
    code: 'REGION_10',
    name: 'Region X (Northern Mindanao)',
    cities: [
      {
        name: 'Cagayan de Oro City',
        barangays: ['Carmen', 'Kauswagan', 'Lapasan', 'Nazareth', 'Puerto'],
      },
      {
        name: 'Iligan City',
        barangays: ['Pala-o', 'San Miguel', 'Tubod', 'Ubaldo Laya'],
      },
    ],
  },
  {
    code: 'REGION_11',
    name: 'Region XI (Davao Region)',
    cities: [
      {
        name: 'Davao City',
        barangays: ['Buhangin', 'Calinan', 'Matina Crossing', 'Poblacion (Central)', 'Talomo'],
      },
      {
        name: 'Tagum City',
        barangays: ['Apokon', 'Magugpo Poblacion', 'Visayan Village'],
      },
    ],
  },
  {
    code: 'REGION_12',
    name: 'Region XII (SOCCSKSARGEN)',
    cities: [
      {
        name: 'General Santos City',
        barangays: ['Calatao', 'City Heights', 'Lagao', 'San Isidro'],
      },
      {
        name: 'Koronadal City',
        barangays: ['General Paulino Santos', 'Poblacion', 'Zone I'],
      },
    ],
  },
  {
    code: 'REGION_13',
    name: 'Region XIII (Caraga)',
    cities: [
      {
        name: 'Butuan City',
        barangays: ['Bayanihan', 'Doongan', 'Holy Redeemer', 'San Ignacio'],
      },
      {
        name: 'Surigao City',
        barangays: ['Canlanipa', 'Luna', 'San Juan', 'Washington'],
      },
    ],
  },
  {
    code: 'BARMM',
    name: 'BARMM (Bangsamoro Autonomous Region in Muslim Mindanao)',
    cities: [
      {
        name: 'Cotabato City',
        barangays: ['Bagua', 'Poblacion 1', 'Rosary Heights'],
      },
      {
        name: 'Marawi City',
        barangays: ['Basak Malutlut', 'Marawi Poblacion', 'Rorogongan'],
      },
    ],
  },
];

export function getRegionNames(): string[] {
  return PHILIPPINE_REGIONS.map((r) => r.name);
}

export function getCitiesByRegion(regionName?: string): string[] {
  if (!regionName) {
    // Return all cities across all regions if no region is selected
    return Array.from(
      new Set(PHILIPPINE_REGIONS.flatMap((r) => r.cities.map((c) => c.name)))
    ).sort();
  }
  const region = PHILIPPINE_REGIONS.find(
    (r) => r.name.toLowerCase() === regionName.toLowerCase() || r.code.toLowerCase() === regionName.toLowerCase()
  );
  if (!region) {
    return Array.from(
      new Set(PHILIPPINE_REGIONS.flatMap((r) => r.cities.map((c) => c.name)))
    ).sort();
  }
  return region.cities.map((c) => c.name).sort();
}

export function getBarangaysByCity(cityName?: string, regionName?: string): string[] {
  if (!cityName) return [];
  
  // Try finding city in specified region first
  if (regionName) {
    const region = PHILIPPINE_REGIONS.find(
      (r) => r.name.toLowerCase() === regionName.toLowerCase() || r.code.toLowerCase() === regionName.toLowerCase()
    );
    if (region) {
      const city = region.cities.find((c) => c.name.toLowerCase() === cityName.toLowerCase());
      if (city && city.barangays.length > 0) {
        return city.barangays;
      }
    }
  }

  // Fallback: search across all regions
  for (const region of PHILIPPINE_REGIONS) {
    const city = region.cities.find((c) => c.name.toLowerCase() === cityName.toLowerCase());
    if (city && city.barangays.length > 0) {
      return city.barangays;
    }
  }

  // Default suggestions if city not in pre-defined list
  return ['Barangay 1', 'Barangay 2', 'Poblacion', 'Central'];
}
