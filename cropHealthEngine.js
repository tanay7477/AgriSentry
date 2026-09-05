/**
 * AgriSentry Crop Growth Stage & Composite Field Health Index Engine
 * 
 * Computes:
 * 1. Overall Field Health Score (0 - 100) combining disease severity, nutrient stress, and pest density.
 * 2. Crop Growth Stage Tracking (Vegetative / Flowering / Fruiting) and stage-specific agronomic advice.
 */

/**
 * Calculates Composite Field Health Index (0-100) and assesses Growth Stage.
 * 
 * @param {number} diseaseSeverity - Percentage of leaf infected (0 - 100).
 * @param {boolean} nutrientDeficiencyDetected - Whether a nutrient deficiency was flagged.
 * @param {number} nutrientConfidence - Confidence of nutrient deficiency (0 - 1).
 * @param {number} pestCount - Sticky trap pest count.
 * @param {string} growthStage - Growth phase ("Vegetative" | "Flowering" | "Fruiting / Maturation").
 * @returns {Object} Composite health index, health status band, growth stage data, and recommendations.
 */
function evaluateCropHealthIndex(
    diseaseSeverity = 0,
    nutrientDeficiencyDetected = false,
    nutrientConfidence = 0,
    pestCount = 0,
    growthStage = "Vegetative"
) {
    // 1. Calculate weighted penalties
    // Disease severity penalty (up to 45 points deduction)
    const diseasePenalty = Math.min(45, (Number(diseaseSeverity) || 0) * 0.45);

    // Nutrient deficiency penalty (up to 30 points deduction)
    let nutrientPenalty = 0;
    if (nutrientDeficiencyDetected) {
        nutrientPenalty = Math.min(30, (Number(nutrientConfidence) || 0.8) * 28);
    }

    // Pest load penalty (up to 25 points deduction)
    let pestPenalty = 0;
    const pests = Math.max(0, Number(pestCount) || 0);
    if (pests > 25) {
        pestPenalty = 25;
    } else if (pests > 10) {
        pestPenalty = 14;
    } else if (pests > 3) {
        pestPenalty = 5;
    }

    // Overall Field Health Score: 0 to 100
    const totalPenalty = diseasePenalty + nutrientPenalty + pestPenalty;
    const healthScore = Math.max(5, Math.min(100, Math.round(100 - totalPenalty)));

    // 2. Health Classification Band
    let healthStatus = "Optimal";
    let healthStatusHi = "उत्कृष्ट (Optimal)";
    let healthColor = "agri-primary"; // green
    let summaryText = "Field shows robust canopy vigor with minimal biological or nutritional stress.";
    let summaryTextHi = "फसल उत्कृष्ट स्थिति में है और किसी गंभीर जैविक या पोषक तनाव के लक्षण नहीं हैं।";

    if (healthScore < 40) {
        healthStatus = "Critical Damage";
        healthStatusHi = "गंभीर क्षति (Critical)";
        healthColor = "agri-danger";
        summaryText = "High composite stress detected across pathology, nutrient balance, and pest density.";
        summaryTextHi = "फसल पर रोग, पोषक तत्व की कमी व कीटों का भारी दबाव है। तुरंत उपचार की आवश्यकता है।";
    } else if (healthScore < 65) {
        healthStatus = "Moderate Risk";
        healthStatusHi = "मध्यम जोखिम (Moderate Risk)";
        healthColor = "agri-medium";
        summaryText = "Moderate stress factors observed. Preventive correction recommended to avoid yield loss.";
        summaryTextHi = "फसल में मध्यम तनाव पाया गया है। पैदावार नुकसान से बचने के लिए तुरंत सुधारात्मक उपाय करें।";
    } else if (healthScore < 85) {
        healthStatus = "Mild Stress";
        healthStatusHi = "हल्का तनाव (Mild Stress)";
        healthColor = "agri-secondary";
        summaryText = "Minor localized stress detected. Routine inspection and balanced care advised.";
        summaryTextHi = "हल्के मौसमी या पोषण असंतुलन के लक्षण। सामान्य निगरानी व संतुलित सिंचाई पर्याप्त है।";
    }

    // 3. Growth Stage Specific Metadata
    const validStages = ["Vegetative", "Flowering", "Fruiting / Maturation"];
    const currentStage = validStages.includes(growthStage) ? growthStage : "Vegetative";

    const stageDetails = {
        "Vegetative": {
            label: "Vegetative Stage (वनस्पति विकास अवस्था)",
            criticalVulnerability: "Foliar biomass growth & Nitrogen intake",
            criticalVulnerabilityHi: "पत्तियों का विकास और नाइट्रोजन की मांग",
            advice: "Prioritize nitrogenous canopy development and early pest monitoring.",
            adviceHi: "कैनोपी विकास के लिए नाइट्रोजन व शुरुआती कीट निगरानी पर ध्यान दें।"
        },
        "Flowering": {
            label: "Flowering Stage (फूल आने की अवस्था)",
            criticalVulnerability: "Pollination integrity & Phosphorus demand",
            criticalVulnerabilityHi: "परागण सुरक्षा व फास्फोरस की आवश्यकता",
            advice: "Ensure optimal moisture to prevent flower drop; avoid harsh chemical sprays.",
            adviceHi: "फूल झड़ने से रोकने हेतु पर्याप्त नमी बनाए रखें और कोमल जैविक उपचार अपनाएं।"
        },
        "Fruiting / Maturation": {
            label: "Fruiting / Maturation Stage (फल व दाना भराव अवस्था)",
            criticalVulnerability: "Potassium uptake & Fruit/Grain protection",
            criticalVulnerabilityHi: "पोटाश ग्रहण व फल/दाने की सुरक्षा",
            advice: "Boost potassium fertigation for grain/fruit filling and monitor borer pests.",
            adviceHi: "दाने व फल भराव के लिए पोटाश दें और फल छेदक कीटों पर विशेष ध्यान दें।"
        }
    };

    return {
        healthScore,
        healthStatus,
        healthStatusHi,
        healthColor,
        summaryText,
        summaryTextHi,
        breakdown: {
            diseaseDeduction: Math.round(diseasePenalty),
            nutrientDeduction: Math.round(nutrientPenalty),
            pestDeduction: Math.round(pestPenalty)
        },
        growthStage: {
            current: currentStage,
            ...stageDetails[currentStage]
        }
    };
}

module.exports = {
    evaluateCropHealthIndex
};
