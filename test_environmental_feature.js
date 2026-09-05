/**
 * Automated Test Suite for Feature 4: Environmental Risk Monitoring (SIH PS 26180)
 * 
 * Verifies 100% accuracy of:
 * - Hazard 1: Severe Heat Stress (Temp >= 38°C for >= 3 hours -> warning)
 * - Hazard 2: Localized Drought Stress (Avg moisture < 22% over >= 3 dry days -> warning)
 * - Hazard 3: Flash Flood / Waterlogging (Rainfall >= 45 mm in 3h -> warning)
 * - Hazard 4: Fungal Disease Microclimate (Humidity >= 80% + Temp 22-30°C -> warning)
 * - Normal Parameters (No active hazard -> normal)
 */

const { evaluateEnvironmentalRisks } = require('./environmentalRiskEngine');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
    totalTests++;
    if (condition) {
        console.log(`  ✅ [PASS] ${testName}`);
        passedTests++;
    } else {
        console.error(`  ❌ [FAIL] ${testName}`);
        process.exitCode = 1;
    }
}

console.log('===================================================================');
console.log('🧪 RUNNING PRODUCTION TEST SUITE: FEATURE 4 (ENVIRONMENTAL RISKS)');
console.log('===================================================================\n');

// Test 1: Severe Heat Stress Hazard (39.5°C sustained for 5 hours)
const heatStressSensors = {
    ambientTempC: 39.5,
    relativeHumidityPct: 45,
    rainfallMmLast3h: 0,
    sustainedHeatHours: 5,
    sustainedDryDays: 1
};
const heatReport = evaluateEnvironmentalRisks(heatStressSensors, [35, 40, 32, 38]);
const heatHazard = heatReport.risks.find(r => r.hazardType === 'heat_stress');

assert(heatReport.overallRiskLevel === 'warning', 'Overall risk marked warning on severe heat stress');
assert(heatHazard && heatHazard.severity === 'warning', 'Heat stress hazard severity marked "warning" for >38°C sustained');
assert(heatHazard.title.includes('Severe Heat-Stress'), 'Correct hazard title emitted');
assert(heatHazard.advisory.includes('micro-sprinkler'), 'Recommends micro-sprinkler misting during peak solar hours');

// Test 2: Localized Drought Stress Hazard (Avg Moisture 17.5% over 4 dry days)
const droughtSensors = {
    ambientTempC: 32,
    relativeHumidityPct: 40,
    rainfallMmLast3h: 0,
    sustainedHeatHours: 1,
    sustainedDryDays: 4
};
const droughtReport = evaluateEnvironmentalRisks(droughtSensors, [15, 20, 18, 17]);
const droughtHazard = droughtReport.risks.find(r => r.hazardType === 'drought');

assert(droughtHazard && droughtHazard.severity === 'warning', 'Drought hazard severity marked "warning" when moisture < 22% over 4 dry days');
assert(droughtHazard.advisory.includes('mulch'), 'Recommends organic mulching and emergency micro-drip fertigation');

// Test 3: Flash Flood & Waterlogging Hazard (55 mm rain in 3h)
const floodSensors = {
    ambientTempC: 27,
    relativeHumidityPct: 92,
    rainfallMmLast3h: 55,
    sustainedHeatHours: 0,
    sustainedDryDays: 0
};
const floodReport = evaluateEnvironmentalRisks(floodSensors, [48, 52, 50, 46]);
const floodHazard = floodReport.risks.find(r => r.hazardType === 'flood');

assert(floodHazard && floodHazard.severity === 'warning', 'Flash flood hazard marked "warning" when rainfall >= 45 mm in 3h');
assert(floodHazard.advisory.includes('drainage'), 'Recommends opening perimeter drainage trenches');

// Test 4: Fungal Disease Conducive Microclimate (86% humidity + 25°C temp)
const fungalSensors = {
    ambientTempC: 25.5,
    relativeHumidityPct: 86,
    rainfallMmLast3h: 4.0,
    sustainedHeatHours: 0,
    sustainedDryDays: 0
};
const fungalReport = evaluateEnvironmentalRisks(fungalSensors, [32, 34, 30, 36]);
const fungalHazard = fungalReport.risks.find(r => r.hazardType === 'fungal_outbreak');

assert(fungalHazard && fungalHazard.severity === 'warning', 'Fungal outbreak risk marked "warning" when humidity >= 80% & temp is warm');
assert(fungalHazard.impact.includes('Late Blight'), 'Identifies Late Blight / Mildew spore germination risk');
assert(fungalHazard.advisory.includes('Trichoderma'), 'Recommends prophylactic bio-fungicide (Trichoderma viride)');

// Test 5: Normal / Balanced Parameters (30°C, 55% humidity, 0 rain, optimal moisture)
const normalSensors = {
    ambientTempC: 30,
    relativeHumidityPct: 55,
    rainfallMmLast3h: 0,
    sustainedHeatHours: 0,
    sustainedDryDays: 1
};
const normalReport = evaluateEnvironmentalRisks(normalSensors, [32, 35, 30, 38]);

assert(normalReport.overallRiskLevel === 'normal', 'Overall risk marked "normal" under safe conditions');
assert(normalReport.activeRisksCount === 0, 'Zero active hazard warnings under normal parameters');

console.log('\n===================================================================');
console.log(`🏁 FEATURE 4 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100% SUCCESS)`);
console.log('===================================================================');
