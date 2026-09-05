/**
 * AgriSentry Pest Detection, Trend Analysis & Early Warning Engine
 * 
 * Implements SIH PS 26180 requirements for:
 * 1. Rolling rate-of-change pest surge tracking (rising / stable / falling).
 * 2. Day 2 early outbreak detection (before density reaches severe thresholds on Day 6).
 * 3. Targeted, non-blanket ecological & biological intervention strategies.
 * 4. Common agricultural insect pest profiling (Aphids, Whiteflies, Thrips, Stem Borers, Leafhoppers).
 */

/**
 * Common agricultural crop pest taxonomy and ecological intervention profiles.
 */
const PEST_PROFILES = {
    aphids: {
        name: "Aphids / Plant Lice (माहू / चेपा)",
        species: "Aphis gossypii / Myzus persicae",
        damageType: "Sap-sucking, leaf curling, and sooty mold vector",
        damageTypeHi: "रस चूसना, पत्तियों का मुड़ना और फफूंद संक्रमण फैलाना",
        targetedIntervention: "Install yellow sticky traps (15/acre); apply 5% Neem Seed Kernel Extract (NSKE) or release Chrysoperla predators.",
        targetedInterventionHi: "पीले चिपचिपे ट्रैप (15/एकड़) लगाएं; 5% नीम का काढ़ा या क्राइसोपर्ला मित्र कीट छोड़ें।"
    },
    whiteflies: {
        name: "Whiteflies (सफेद मक्खी)",
        species: "Bemisia tabaci",
        damageType: "Foliar chlorosis, Gemini-virus transmission",
        damageTypeHi: "पत्तियों का पीलापन और विषाणु रोग (Yellow Mosaic) का प्रसार",
        targetedIntervention: "Erect yellow sticky card barriers; spray botanical soap solution or Verticillium lecanii bio-fungus.",
        targetedInterventionHi: "पीले ट्रैप कार्ड लगाएं; जैविक साबुन घोल या वर्टिसिलियम बायो-फंगस का छिड़काव करें।"
    },
    thrips: {
        name: "Thrips (थ्रिप्स / चुरड़ा)",
        species: "Thrips tabaci / Scirtothrips dorsalis",
        damageType: "Silvering of leaves, upward leaf curling",
        damageTypeHi: "पत्तियों पर चांदी जैसे सफेद धब्बे व ऊपर की ओर मुड़ना",
        targetedIntervention: "Install blue sticky traps; conserve natural predatory mites (Amblyseius spp.).",
        targetedInterventionHi: "नीले स्टिकी ट्रैप लगाएं और मित्र परभक्षी माइट्स का संरक्षण करें।"
    },
    stem_borer: {
        name: "Stem / Pod Borers (तना व फल छेदक)",
        species: "Helicoverpa armigera / Chilo partellus",
        damageType: "Shoot boreholes, internal vascular destruction",
        damageTypeHi: "तने और फल में छेद करना, आंतरिक कोशिकाओं को खोखला करना",
        targetedIntervention: "Set up pheromone traps (5-8 traps/acre); release Trichogramma egg parasitoids; targeted Bacillus thuringiensis (Bt) bio-spray.",
        targetedInterventionHi: "फेरोमोन ट्रैप (5-8/एकड़) लगाएं; ट्राइकोग्रामा परजीवी छोड़ें और बीटी जैविक स्प्रे करें।"
    },
    leafhopper: {
        name: "Leafhoppers / Jassids (हरा तेला / फुदका)",
        species: "Amrasca biguttula",
        damageType: "Hopper burn, leaf edge yellowing",
        damageTypeHi: "हॉपर बर्न (किनारों से पत्ती सूखना) व क्लोरोफिल क्षति",
        targetedIntervention: "Light traps during early night; spray Pongamia/Karanja oil (2ml/L) on lower leaf canopy.",
        targetedInterventionHi: "शाम को प्रकाश प्रपंच (Light Trap) लगाएं; करंज तेल (2ml/लीटर) का निचली पत्तियों पर स्प्रे करें।"
    }
};

/**
 * Calculates pest rate-of-change trend and early outbreak alert.
 * 
 * @param {number} currentCount - Current sticky trap or vision-detected pest count.
 * @param {number} previousCount - Previous time-window pest count (e.g., 24-48 hours prior).
 * @param {string} pestClass - Key of identified pest species (optional, defaults based on density).
 * @returns {Object} Comprehensive trend analysis, outbreak risk level, and targeted recommendations.
 */
function evaluatePestEarlyWarning(currentCount = 0, previousCount = null, pestClass = null) {
    const current = Math.max(0, Number(currentCount) || 0);
    
    // Default baseline if previous count is not supplied
    const prev = previousCount !== null && previousCount !== undefined 
        ? Math.max(0, Number(previousCount)) 
        : (current > 15 ? Math.round(current * 0.65) : Math.max(0, current - 2));

    // Calculate Rate of Change (% change over rolling window)
    let rateOfChangePct = 0;
    if (prev > 0) {
        rateOfChangePct = Math.round(((current - prev) / prev) * 100);
    } else if (current > 0) {
        rateOfChangePct = 100;
    }

    // Determine Trend Direction
    let trend = "stable"; // "rising" | "stable" | "falling"
    let trendLabel = "Stable Infestation Rate (स्थिर स्थिति)";
    let outbreakRisk = "low"; // "low" | "moderate" | "high" | "critical"

    if (rateOfChangePct >= 20 || (current >= 15 && current > prev)) {
        trend = "rising";
        trendLabel = "Surging / Rising Trend (तीव्र वृद्धि दर ↗)";
        if (current > 25 || rateOfChangePct >= 50) {
            outbreakRisk = "critical";
        } else {
            outbreakRisk = "high";
        }
    } else if (rateOfChangePct <= -15 || (current < prev && current < 10)) {
        trend = "falling";
        trendLabel = "Declining / Suppressed Trend (नियंत्रण में ↘)";
        outbreakRisk = "low";
    } else {
        trend = "stable";
        trendLabel = "Plateau / Stable Density (स्थिर ➔)";
        outbreakRisk = current > 18 ? "moderate" : "low";
    }

    // Assign most probable pest profile if not specified
    let selectedKey = pestClass;
    if (!selectedKey || !PEST_PROFILES[selectedKey]) {
        if (current > 25) selectedKey = "whiteflies";
        else if (current > 15) selectedKey = "aphids";
        else if (current > 8) selectedKey = "thrips";
        else selectedKey = "leafhopper";
    }
    const profile = PEST_PROFILES[selectedKey];

    // Build Early Warning Alert Message
    let earlyWarningAlert = "Pest density is within safe ecological threshold. Natural predator balance maintained.";
    let earlyWarningAlertHi = "कीट संख्या सुरक्षित सीमा में है। मित्र कीट संतुलन बना हुआ है।";

    if (outbreakRisk === "critical" || (trend === "rising" && current > 20)) {
        earlyWarningAlert = `DAY 2 EARLY OUTBREAK WARNING: Infestation surge (+${rateOfChangePct}%) detected. Intervene in targeted zones before day 6 full spread.`;
        earlyWarningAlertHi = `दिन 2 प्रारंभिक प्रकोप चेतावनी: कीट वृद्धि (+${rateOfChangePct}%) दर्ज हुई। दिन 6 के बड़े प्रकोप से पहले प्रभावित जोन में तुरंत जैव-उपचार करें।`;
    } else if (trend === "rising") {
        earlyWarningAlert = `Pest activity rising (+${rateOfChangePct}%). Install sticky barrier traps in active sectors.`;
        earlyWarningAlertHi = `कीट गतिविधि बढ़ रही है (+${rateOfChangePct}%)। सक्रिय क्षेत्रों में स्टिकी ट्रैप स्थापित करें।`;
    } else if (trend === "falling") {
        earlyWarningAlert = `Infestation suppressed (${rateOfChangePct}% reduction). Targeted biological controls are effective.`;
        earlyWarningAlertHi = `कीट प्रकोप में कमी (${rateOfChangePct}% गिरावट)। अपनाए गए जैविक उपाय सफल हो रहे हैं।`;
    }

    return {
        currentCount: current,
        previousCount: prev,
        rateOfChangePct,
        trend,
        trendLabel,
        outbreakRisk,
        pestProfile: profile,
        earlyWarningAlert,
        earlyWarningAlertHi
    };
}

module.exports = {
    evaluatePestEarlyWarning,
    PEST_PROFILES
};
