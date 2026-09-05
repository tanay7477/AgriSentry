/**
 * AgriSentry Multi-Farm Fleet & Weather Simulation Preset Engine (Production-Grade)
 * 
 * Implements SIH PS 26180 requirements:
 * 1. Multi-Zone Farm Field Scalability:
 *    - Independent field sectors (Field Alpha, Field Beta, Field Gamma) with custom crop types & acreage.
 * 2. Weather & Microclimate Sensor Simulation Presets:
 *    - Preset 1: Optimal Spring Conditions (Safe parameters)
 *    - Preset 2: Severe Heat-Stress & Drought (High solar / low moisture)
 *    - Preset 3: Flash Flood & Fungal Disease Microclimate (Heavy rain & high humidity)
 *    - Preset 4: Rapid Pest Outbreak Surge (Exponential trap count climb)
 */

const FARM_SECTORS = [
    {
        id: "field_alpha",
        name: "Field Alpha — Solanaceous Sector",
        cropType: "Tomato (Solanum lycopersicum)",
        acreage: 2.5,
        edgeNodeId: "AGRISENTRY_RPI_NODE_01",
        gpsCoords: "28.6139° N, 77.2090° E",
        zones: [
            { zone: 1, name: "North-West (Sandy Loam)", moisture: 18 },
            { zone: 2, name: "North-East (Clay Loam)", moisture: 38 },
            { zone: 3, name: "South-West (Porous Sector)", moisture: 22 },
            { zone: 4, name: "South-East (Lowland Basin)", moisture: 46 }
        ],
        defaultPestCount: 24,
        prevPestCount: 11
    },
    {
        id: "field_beta",
        name: "Field Beta — Tuber & Root Sector",
        cropType: "Potato (Solanum tuberosum)",
        acreage: 4.0,
        edgeNodeId: "AGRISENTRY_RPI_NODE_02",
        gpsCoords: "28.6250° N, 77.2150° E",
        zones: [
            { zone: 1, name: "Zone 1 (North Furrows)", moisture: 28 },
            { zone: 2, name: "Zone 2 (Central Ridge)", moisture: 32 },
            { zone: 3, name: "Zone 3 (South Drip Belt)", moisture: 20 },
            { zone: 4, name: "Zone 4 (East Perimeter)", moisture: 42 }
        ],
        defaultPestCount: 16,
        prevPestCount: 15
    },
    {
        id: "field_gamma",
        name: "Field Gamma — Cash Crop Sector",
        cropType: "Chili & Capsicum (Capsicum annuum)",
        acreage: 1.8,
        edgeNodeId: "AGRISENTRY_RPI_NODE_03",
        gpsCoords: "28.6080° N, 77.2010° E",
        zones: [
            { zone: 1, name: "Zone 1 (Greenhouse Bay A)", moisture: 34 },
            { zone: 2, name: "Zone 2 (Greenhouse Bay B)", moisture: 36 },
            { zone: 3, name: "Zone 3 (Open Terrace)", moisture: 17 },
            { zone: 4, name: "Zone 4 (East Slope)", moisture: 31 }
        ],
        defaultPestCount: 38,
        prevPestCount: 14
    }
];

const SIMULATION_PRESETS = {
    OPTIMAL: {
        id: "optimal",
        title: "Optimal / Safe Baseline",
        titleHi: "अनुकूल व सामान्य स्थिति",
        description: "Normal ambient temperatures, balanced moisture, and zero active hazards",
        ambientTempC: 28.5,
        relativeHumidityPct: 58,
        rainfallMmLast3h: 0,
        sustainedHeatHours: 0,
        sustainedDryDays: 0,
        zoneMoistures: [34, 38, 32, 40],
        pestCount: 6,
        prevPestCount: 8
    },
    HEAT_DROUGHT: {
        id: "heat_drought",
        title: "Severe Heat & Drought Hazard",
        titleHi: "गंभीर लू व सूखा आपदा स्थिति",
        description: "Ambient temperature >38°C sustained with depleted soil moisture (<20%)",
        ambientTempC: 39.5,
        relativeHumidityPct: 40,
        rainfallMmLast3h: 0,
        sustainedHeatHours: 5,
        sustainedDryDays: 4,
        zoneMoistures: [16, 19, 18, 20],
        pestCount: 18,
        prevPestCount: 16
    },
    FLOOD_FUNGAL: {
        id: "flood_fungal",
        title: "Monsoon Flood & Fungal Microclimate",
        titleHi: "भारी वर्षा जलभराव व फफूंद जोखिम",
        description: "Heavy rainfall (52mm in 3h) with high humidity (>85%) promoting blight",
        ambientTempC: 26.0,
        relativeHumidityPct: 88,
        rainfallMmLast3h: 52,
        sustainedHeatHours: 0,
        sustainedDryDays: 0,
        zoneMoistures: [48, 52, 50, 54],
        pestCount: 14,
        prevPestCount: 12
    },
    PEST_SURGE: {
        id: "pest_surge",
        title: "Exponential Pest Outbreak Surge",
        titleHi: "कीट प्रकोप तीव्र वृद्धि (Day 2 Surge)",
        description: "Sticky trap count jumps rapidly (+140% rate-of-change slope)",
        ambientTempC: 34.0,
        relativeHumidityPct: 65,
        rainfallMmLast3h: 0,
        sustainedHeatHours: 0,
        sustainedDryDays: 1,
        zoneMoistures: [26, 34, 28, 38],
        pestCount: 42,
        prevPestCount: 11
    }
};

/**
 * Returns list of all registered scalable farm sectors.
 */
function getAllFarmSectors() {
    return FARM_SECTORS;
}

/**
 * Retrieves specific farm sector by ID.
 */
function getFarmSectorById(farmId) {
    return FARM_SECTORS.find(f => f.id === farmId) || FARM_SECTORS[0];
}

/**
 * Returns available weather & microclimate simulation presets.
 */
function getAllSimulationPresets() {
    return SIMULATION_PRESETS;
}

module.exports = {
    FARM_SECTORS,
    SIMULATION_PRESETS,
    getAllFarmSectors,
    getFarmSectorById,
    getAllSimulationPresets
};
