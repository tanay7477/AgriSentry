/**
 * AgriSentry Decision & Advisory Engine
 * 
 * Generates farmer advisory recommendations and early warning risk levels based on
 * plant disease severity percentage and pest trap count (aligned with SIH PS 26180).
 */

/**
 * Categorizes the pest count into Low, Medium, or High levels.
 * - Low: 0 - 10 pests
 * - Medium: 11 - 25 pests
 * - High: 25+ pests
 * 
 * @param {number} pestCount - The count of pests detected on the sticky trap.
 * @returns {string} The pest level category ("Low", "Medium", "High").
 */
function categorizePestCount(pestCount) {
    if (pestCount > 25) {
        return "High";
    } else if (pestCount > 10) {
        return "Medium";
    } else {
        return "Low";
    }
}

/**
 * Generates advisory recommendations and field health status based on disease severity and pest count.
 * 
 * @param {number} diseaseSeverityPercent - The percentage of infected leaf area (0 - 100).
 * @param {number} pestCount - The count of pests on the trap.
 * @param {string} pestTrend - Trend of pest density ("rising" | "stable" | "falling")
 * @returns {Object} Advisory details including severity, counts, risk level, status, and alert recommendation.
 */
function getAdvisoryDecision(diseaseSeverityPercent, pestCount, pestTrend = "stable") {
    // Ensure inputs are valid numbers
    const severity = Math.max(0, Math.min(100, Number(diseaseSeverityPercent) || 0));
    const pests = Math.max(0, Number(pestCount) || 0);
    const pestLevel = categorizePestCount(pests);

    let status = "Healthy / Normal";
    let advisoryAlert = "No immediate threat detected. Continue standard crop monitoring.";
    let advisoryAlertHi = "कोई तत्काल खतरा नहीं। सामान्य फसल निगरानी जारी रखें।";
    let riskLevel = "low"; // "low" | "medium" | "high"
    let actionRecommendation = "Safe - Normal Monitoring";
    let actionRecommendationHi = "फसल सुरक्षित - सामान्य निगरानी";

    const hasDisease = severity > 10;
    const hasHighDisease = severity >= 30;
    const hasPests = pestLevel !== "Low";
    const isPestHigh = pestLevel === "High";

    if (hasHighDisease || isPestHigh) {
        riskLevel = "high";
        status = "High Risk - Immediate Attention Required";
        actionRecommendation = "Critical Intervention Recommended";
        actionRecommendationHi = "गंभीर जोखिम - तत्काल ध्यान आवश्यक";

        if (hasHighDisease && isPestHigh) {
            advisoryAlert = "Severe crop disease and high pest infestation detected. Inspect and treat affected zones immediately.";
            advisoryAlertHi = "गंभीर फसल रोग और उच्च कीट प्रकोप पाया गया। तुरंत प्रभावित क्षेत्र का निरीक्षण करें।";
        } else if (hasHighDisease) {
            advisoryAlert = "Possible severe disease detected with high leaf damage. Isolate infected plants to prevent spread.";
            advisoryAlertHi = "पत्तियों पर गंभीर रोग के लक्षण पाए गए हैं। संक्रमण रोकने के लिए प्रभावित पौधों की जांच करें।";
        } else {
            advisoryAlert = "Critical pest surge detected across field traps. Implement early pest barrier controls.";
            advisoryAlertHi = "खेत में कीटों की संख्या खतरनाक स्तर पर है। शीघ्र जैविक या अनुशंसित कीट नियंत्रण करें।";
        }
    } else if (hasDisease || hasPests) {
        riskLevel = "medium";
        status = "Moderate Risk - Early Warning Alert";
        actionRecommendation = "Targeted Inspection Advised";
        actionRecommendationHi = "मध्यम जोखिम - प्रारंभिक चेतावनी";

        if (hasDisease && hasPests) {
            advisoryAlert = "Possible disease detected with rising pest activity. Conduct targeted field scout.";
            advisoryAlertHi = "प्रारंभिक रोग व कीट सक्रियता देखी गई है। संबंधित जोन का फील्ड मुआयना करें।";
        } else if (hasDisease) {
            advisoryAlert = "Possible disease detected in early stages. Monitor leaf spots closely.";
            advisoryAlertHi = "प्रारंभिक अवस्था में रोग के लक्षण दिखे हैं। धब्बों पर नजर रखें।";
        } else {
            advisoryAlert = "Pest activity increasing in sticky traps. Prepare preventive measures.";
            advisoryAlertHi = "कीट ट्रैप में कीटों की संख्या बढ़ रही है। पूर्व-सावधानी बरतें।";
        }
    }

    return {
        diseaseSeverityPercent: severity,
        pestCount: pests,
        pestLevel,
        pestTrend,
        riskLevel,
        status,
        actionRecommendation,
        actionRecommendationHi,
        advisoryAlert,
        advisoryAlertHi
    };
}

module.exports = {
    categorizePestCount,
    getAdvisoryDecision,
    getDecision: getAdvisoryDecision
};


