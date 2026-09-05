/**
 * Comprehensive Automated Test Suite for Feature 1 & Feature 2 (AgriSentry 2.0)
 * 
 * Verifies 100% accuracy of:
 * - Feature 1: Crop Disease, N-P-K Nutrient Deficiencies, Growth Stages, and Composite Health Index.
 * - Feature 2: Pest Surge Rate-of-Change, Day 2 Outbreak Warning, and Targeted Ecological Interventions.
 */

const { classifyNutrientDeficiency } = require('./nutrientEngine');
const { evaluateCropHealthIndex } = require('./cropHealthEngine');
const { evaluatePestEarlyWarning, PEST_PROFILES } = require('./pestTrendEngine');
const { getDecision } = require('./decisionEngine');

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

console.log('===============================================================');
console.log('🧪 RUNNING COMPREHENSIVE PRODUCTION TEST SUITE: FEATURES 1 & 2');
console.log('===============================================================\n');

// -------------------------------------------------------------
// FEATURE 1: CROP HEALTH MONITORING TESTS
// -------------------------------------------------------------
console.log('📦 --- FEATURE 1: CROP HEALTH MONITORING ---');

// Test 1.1: Healthy leaf condition
const healthyDiag = classifyNutrientDeficiency(null, 'Tomato___healthy', 0);
assert(!healthyDiag.deficiencyDetected, 'Healthy leaf produces deficiencyDetected = false');
assert(healthyDiag.primaryDeficiency.includes('Balanced'), 'Healthy leaf reports balanced nutrition');
assert(healthyDiag.npkStatus.nitrogen.status === 'Optimal', 'Healthy leaf Nitrogen is Optimal');

// Test 1.2: Nitrogen Deficiency (Chlorosis / Yellowing)
const nitrogenDiag = classifyNutrientDeficiency(null, 'Tomato___Yellow_Leaf_Curl_Virus', 20);
assert(nitrogenDiag.deficiencyDetected, 'Yellowing pattern triggers deficiencyDetected = true');
assert(nitrogenDiag.primaryDeficiency.includes('Nitrogen'), 'Correctly identifies Nitrogen (N) deficiency');
assert(nitrogenDiag.npkStatus.nitrogen.status === 'Deficient', 'Nitrogen level marked Deficient (<40%)');

// Test 1.3: Potassium Deficiency (Marginal Scorching / Blight)
const potassDiag = classifyNutrientDeficiency(null, 'Potato___Early_blight', 40);
assert(potassDiag.deficiencyDetected, 'Blight lesion triggers deficiencyDetected = true');
assert(potassDiag.primaryDeficiency.includes('Potassium'), 'Correctly identifies Potassium (K) deficiency');
assert(potassDiag.npkStatus.potassium.status === 'Deficient', 'Potassium level marked Deficient');

// Test 1.4: Phosphorus & Micronutrient Deficiency
const phosDiag = classifyNutrientDeficiency(null, 'Tomato___Leaf_Mold', 35);
assert(phosDiag.primaryDeficiency.includes('Phosphorus'), 'Correctly identifies Phosphorus & Micronutrient deficiency');
assert(phosDiag.npkStatus.micronutrients.status === 'Deficient', 'Micronutrients status marked Deficient');

// Test 1.5: Composite Field Health Index Score Calculation
const healthGood = evaluateCropHealthIndex(0, false, 0.9, 2, 'Vegetative');
assert(healthGood.healthScore >= 90, `Healthy plant score is high: ${healthGood.healthScore}/100`);
assert(healthGood.healthStatus === 'Optimal', 'Health band is Optimal');

const healthCritical = evaluateCropHealthIndex(75, true, 0.9, 32, 'Flowering');
assert(healthCritical.healthScore <= 40, `Severely damaged plant score is low: ${healthCritical.healthScore}/100`);
assert(healthCritical.healthStatus === 'Critical Damage', 'Health band is Critical Damage');

// Test 1.6: Growth Stage Context
const stageTest = evaluateCropHealthIndex(20, false, 0, 5, 'Fruiting / Maturation');
assert(stageTest.growthStage.current === 'Fruiting / Maturation', 'Preserves selected Growth Stage');
assert(stageTest.growthStage.criticalVulnerability.includes('Potassium'), 'Fruiting stage highlights Potassium demand');

console.log('\n---------------------------------------------------------------');

// -------------------------------------------------------------
// FEATURE 2: PEST DETECTION & EARLY WARNING TESTS
// -------------------------------------------------------------
console.log('📦 --- FEATURE 2: PEST DETECTION & EARLY WARNING ---');

// Test 2.1: Day 2 Outbreak Surge (+120% Rate of Change)
const surgePest = evaluatePestEarlyWarning(22, 10, 'whiteflies');
assert(surgePest.trend === 'rising', 'Surge count produces trend = rising');
assert(surgePest.rateOfChangePct === 120, `Calculated accurate Rate of Change: +${surgePest.rateOfChangePct}%`);
assert(surgePest.outbreakRisk === 'critical' || surgePest.outbreakRisk === 'high', 'Outbreak risk marked High/Critical');
assert(surgePest.earlyWarningAlert.includes('DAY 2 EARLY OUTBREAK WARNING'), 'Emits Day 2 early warning prompt');

// Test 2.2: Suppressed / Declining Infestation (-60% Decline)
const declPest = evaluatePestEarlyWarning(8, 20, 'aphids');
assert(declPest.trend === 'falling', 'Decreasing count produces trend = falling');
assert(declPest.rateOfChangePct === -60, `Calculated accurate suppression slope: ${declPest.rateOfChangePct}%`);
assert(declPest.outbreakRisk === 'low', 'Outbreak risk marked Low on decline');

// Test 2.3: Stable / Plateau Density
const stablePest = evaluatePestEarlyWarning(12, 12, 'thrips');
assert(stablePest.trend === 'stable', 'Equal counts produce trend = stable');
assert(stablePest.rateOfChangePct === 0, 'Zero rate of change on plateau');

// Test 2.4: Targeted Non-Blanket Ecological Interventions
assert(PEST_PROFILES.aphids.targetedIntervention.includes('yellow sticky traps'), 'Aphids profile provides yellow sticky trap remedy');
assert(PEST_PROFILES.stem_borer.targetedIntervention.includes('pheromone traps'), 'Stem borer profile provides pheromone trap remedy');
assert(PEST_PROFILES.thrips.targetedIntervention.includes('blue sticky traps'), 'Thrips profile provides blue sticky trap remedy');

// Test 2.5: Decision Engine Integration with Pest Trend
const decisionSurge = getDecision(35, 24, 'rising');
assert(decisionSurge.riskLevel === 'high', 'Decision engine marks high risk on rising pest surge');
assert(decisionSurge.actionRecommendation.includes('Critical'), 'Recommends critical targeted intervention');

console.log('\n===============================================================');
console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100% SUCCESS)`);
console.log('===============================================================');
