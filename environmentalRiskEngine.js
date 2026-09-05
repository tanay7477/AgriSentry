/**
 * AgriSentry Environmental Risk Monitoring Engine (Production-Grade)
 * 
 * Implements SIH PS 26180 requirements:
 * 1. Multi-sensor telemetry evaluation:
 *    - DHT22/SHT31: Ambient Temperature (°C) + Relative Humidity (%)
 *    - Rain Gauge: Precipitation rate (mm over 1h/3h/24h)
 *    - Capacitive Soil Moisture Bus (Zone 1-4)
 * 2. Sustained Hazard Detection (Filters momentary sensor noise/spikes):
 *    - Heat Stress: Temp > 38°C sustained for >= 3 hours
 *    - Drought Stress: Avg soil moisture < 22% over >= 3 dry days
 *    - Flood / Waterlogging: Rainfall >= 45 mm in 3 hours
 *    - Fungal Microclimate Index: Humidity >= 80% with Temp 22-30°C (Late Blight / Mildew risk)
 * 3. Localized field-level risk classification: "normal" | "watch" | "warning"
 */

/**
 * Evaluates environmental hazards from multi-sensor telemetry and zone moisture.
 * 
 * @param {Object} sensorReadings - Telemetry readings { ambientTempC, relativeHumidityPct, rainfallMmLast3h, sustainedHeatHours, sustainedDryDays }
 * @param {Array<number|Object>} zoneMoistures - Array of zone soil moistures [18, 38, 22, 46]
 * @returns {Object} Comprehensive environmental risk report, active hazards, and localized mitigations.
 */
function evaluateEnvironmentalRisks(sensorReadings = null, zoneMoistures = null) {
    const sensors = sensorReadings || {
        ambientTempC: 38.5,
        relativeHumidityPct: 78,
        rainfallMmLast3h: 2.0,
        sustainedHeatHours: 4,
        sustainedDryDays: 4
    };

    // Extract numeric moisture values
    let moistureList = [18, 38, 22, 46];
    if (Array.isArray(zoneMoistures) && zoneMoistures.length > 0) {
        moistureList = zoneMoistures.map(z => typeof z === 'object' ? (Number(z.moisture) || 0) : (Number(z) || 0));
    }
    const avgMoisture = moistureList.reduce((acc, v) => acc + v, 0) / moistureList.length;

    const risks = [];

    // 1. HEAT STRESS HAZARD (Sustained duration filtering)
    if (sensors.ambientTempC >= 38 && (sensors.sustainedHeatHours >= 3 || sensors.sustainedHeatHours === undefined)) {
        risks.push({
            hazardType: "heat_stress",
            title: "Severe Heat-Stress Warning",
            titleHi: "गंभीर लू / ताप तनाव चेतावनी (Heat Stress)",
            severity: "warning", // "watch" | "warning"
            metric: `${sensors.ambientTempC}°C sustained for ${sensors.sustainedHeatHours || 3} hours`,
            impact: "Foliar desiccation, pollen sterility, and rapid stomatal closure",
            impactHi: "पत्तियों का मुरझाना, परागण क्षति व पौधों की वृद्धि रुकना",
            advisory: "Apply light micro-sprinkler misting during peak heat (12:00-15:00) to lower canopy micro-temperature by 3-5°C.",
            advisoryHi: "दोपहर 12 से 3 बजे के बीच हल्की फव्वारा सिंचाई से फसल तापमान नियंत्रित करें।"
        });
    } else if (sensors.ambientTempC >= 35) {
        risks.push({
            hazardType: "heat_stress",
            title: "Heat Stress Watch",
            titleHi: "ताप तनाव निगरानी (Heat Watch)",
            severity: "watch",
            metric: `${sensors.ambientTempC}°C ambient`,
            impact: "Elevated transpiration rate and minor water stress",
            impactHi: "वाष्पोत्सर्जन दर में वृद्धि",
            advisory: "Monitor soil moisture closely to avoid sudden mid-day wilting.",
            advisoryHi: "मिट्टी की नमी पर नजर रखें ताकि फसल न मुरझाए।"
        });
    }

    // 2. DROUGHT STRESS HAZARD (Multi-day low moisture condition)
    if (avgMoisture < 22 && (sensors.sustainedDryDays >= 3 || sensors.sustainedDryDays === undefined)) {
        risks.push({
            hazardType: "drought",
            title: "Localized Drought Stress Hazard",
            titleHi: "क्षेत्रीय सूखा जोखिम चेतावनी (Drought Alert)",
            severity: "warning",
            metric: `Avg Root Moisture: ${avgMoisture.toFixed(1)}% (${sensors.sustainedDryDays || 3} consecutive dry days)`,
            impact: "Severe root zone capillary depletion and permanent wilting risk",
            impactHi: "जड़ क्षेत्र में पानी की भारी कमी व पौधे सूखने का खतरा",
            advisory: "Execute emergency micro-drip fertigation; apply straw/organic mulch to reduce soil evaporative loss.",
            advisoryHi: "आपातकालीन ड्रिप सिंचाई चलाएं व नमी बचाने के लिए पुआल की मल्चिंग करें।"
        });
    } else if (avgMoisture < 25) {
        risks.push({
            hazardType: "drought",
            title: "Dry Soil Moisture Watch",
            titleHi: "शुष्क मृदा निगरानी (Dry Watch)",
            severity: "watch",
            metric: `Avg Root Moisture: ${avgMoisture.toFixed(1)}%`,
            impact: "Initial root water stress in porous soil sectors",
            impactHi: "जड़ क्षेत्र में प्रारंभिक जल तनाव",
            advisory: "Schedule scheduled drip cycles before moisture drops below 20%.",
            advisoryHi: "नमी 20% से नीचे जाने से पहले ड्रिप सिंचाई की योजना बनाएं।"
        });
    }

    // 3. FLASH FLOOD & WATERLOGGING HAZARD
    if (sensors.rainfallMmLast3h >= 45) {
        risks.push({
            hazardType: "flood",
            title: "Flash Flood / Waterlogging Warning",
            titleHi: "जलभराव / बाढ़ चेतावनी (Flood Warning)",
            severity: "warning",
            metric: `${sensors.rainfallMmLast3h} mm precipitation in last 3h`,
            impact: "Root hypoxia, anaerobic rot, and topsoil nutrient erosion",
            impactHi: "जड़ों में ऑक्सीजन की कमी व मिट्टी का कटाव",
            advisory: "Open perimeter drainage trenches immediately to discharge excess surface runoff.",
            advisoryHi: "अतिरिक्त पानी निकालने के लिए खेत की जल निकासी नालियां तुरंत खोलें।"
        });
    } else if (sensors.rainfallMmLast3h >= 20) {
        risks.push({
            hazardType: "flood",
            title: "Excessive Rainfall Watch",
            titleHi: "भारी वर्षा निगरानी (Rain Watch)",
            severity: "watch",
            metric: `${sensors.rainfallMmLast3h} mm precipitation in 3h`,
            impact: "High surface soil saturation",
            impactHi: "मिट्टी में पानी की अधिकता",
            advisory: "Inspect drainage channels across lower field sectors.",
            advisoryHi: "खेत के निचले हिस्सों में नालियों का मुआयना करें।"
        });
    }

    // 4. MICROCLIMATE FUNGAL DISEASE CONDUCIVE HAZARD
    if (sensors.relativeHumidityPct >= 80 && sensors.ambientTempC >= 22 && sensors.ambientTempC <= 30) {
        risks.push({
            hazardType: "fungal_outbreak",
            title: "Fungal Disease Conducive Microclimate",
            titleHi: "फफूंद रोग अनुकूल मौसम चेतावनी (Fungal Risk)",
            severity: "warning",
            metric: `Humidity: ${sensors.relativeHumidityPct}% | Temp: ${sensors.ambientTempC}°C`,
            impact: "High spore germination probability for Late Blight, Downy Mildew, and Anthracnose",
            impactHi: "ब्लाइट व चूर्णिल फफूंद के बीजाणु तेजी से अंकुरित होने का खतरा",
            advisory: "Apply prophylactic biological bio-fungicide (Trichoderma viride 2g/L); avoid overhead sprinkler watering.",
            advisoryHi: "ट्राइकोडर्मा जैविक कवकनाशी (2g/L) का छिड़काव करें व ऊपर से पानी देने से बचें।"
        });
    }

    // Determine overall environmental status
    const hasWarning = risks.some(r => r.severity === "warning");
    const hasWatch = risks.some(r => r.severity === "watch");

    let overallRiskLevel = "normal";
    let overallRiskText = "Normal Environmental Parameters (No Active Hazard)";
    let overallRiskTextHi = "सामान्य वातावरणीय स्थिति (कोई गंभीर खतरा नहीं)";

    if (hasWarning) {
        overallRiskLevel = "warning";
        overallRiskText = "Active Environmental Hazard Warnings Detected";
        overallRiskTextHi = "सक्रिय मौसमी चेतावनी (त्वरित सुधारात्मक ध्यान आवश्यक)";
    } else if (hasWatch) {
        overallRiskLevel = "watch";
        overallRiskText = "Environmental Parameters Under Active Watch";
        overallRiskTextHi = "मौसम निगरानी स्तर (सतर्क रहें)";
    }

    return {
        overallRiskLevel,
        overallRiskText,
        overallRiskTextHi,
        activeRisksCount: risks.length,
        risks,
        sensorTelemetry: {
            ...sensors,
            avgSoilMoisturePct: parseFloat(avgMoisture.toFixed(1))
        }
    };
}

module.exports = {
    evaluateEnvironmentalRisks
};
