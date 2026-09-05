/**
 * AgriSentry Farmer Advisory Dispatcher & SMS Engine (Production-Grade)
 * 
 * Implements SIH PS 26180 requirements:
 * 1. PS Exact Standard Alert Templates:
 *    - "Irrigate now" / "Delay irrigation"
 *    - "Possible disease detected"
 *    - "Pest activity increasing"
 *    - "Heat-stress warning"
 *    - "Flood-risk alert"
 * 2. Multi-Channel Dispatch Formatter:
 *    - Mobile SMS (GSM SIM800L / Twilio compatible for basic feature phones) in Hindi & English.
 *    - Interactive Audio TTS Voice Synthesis script.
 * 3. GSM AT Command simulation log generator (AT+CMGS).
 */

/**
 * Standardized PS 26180 Alert Catalog
 */
const PS_ALERT_TEMPLATES = {
    IRRIGATE_NOW: {
        code: "IRRIGATE_NOW",
        en: "Irrigate now: Soil moisture is below 25%. Turn on drip valves for recommended cycle.",
        hi: "तुरंत सिंचाई करें: मिट्टी की नमी 25% से कम है। अनुशंसित समय हेतु ड्रिप वाल्व चालू करें।"
    },
    DELAY_IRRIGATION: {
        code: "DELAY_IRRIGATION",
        en: "Delay irrigation: Weather radar predicts rain within 24-48h. Conserve water.",
        hi: "सिंचाई रोकें: अगले 24-48 घंटों में बारिश का अनुमान है। पानी व बिजली की बचत करें।"
    },
    POSSIBLE_DISEASE_DETECTED: {
        code: "POSSIBLE_DISEASE_DETECTED",
        en: "Possible disease detected: Leaf pathology analysis shows early foliar lesions.",
        hi: "संभावित फसल रोग की पहचान: पत्ती स्कैन में रोग के प्रारंभिक लक्षण पाए गए हैं।"
    },
    PEST_ACTIVITY_INCREASING: {
        code: "PEST_ACTIVITY_INCREASING",
        en: "Pest activity increasing: Trap counts rising rapidly. Day 2 early warning alert.",
        hi: "कीट प्रकोप में वृद्धि: ट्रैप में कीटों की संख्या तेजी से बढ़ रही है। प्रारंभिक चेतावनी।"
    },
    HEAT_STRESS_WARNING: {
        code: "HEAT_STRESS_WARNING",
        en: "Heat-stress warning: Ambient temperature exceeding 38°C sustained. Apply canopy misting.",
        hi: "ताप तनाव (लू) चेतावनी: तापमान 38°C से अधिक है। दोपहर में हल्की फव्वारा सिंचाई करें।"
    },
    FLOOD_RISK_ALERT: {
        code: "FLOOD_RISK_ALERT",
        en: "Flood-risk alert: Heavy rainfall recorded. Open perimeter drainage channels immediately.",
        hi: "जलभराव / बाढ़ चेतावनी: भारी वर्षा दर्ज की गई है। खेत से जल निकासी नालियां तुरंत खोलें।"
    }
};

/**
 * Formats a comprehensive farmer advisory and generates SMS payloads.
 * 
 * @param {Object} diagnosticContext - Results from vision, pests, irrigation & environmental engines.
 * @returns {Object} Standardized PS alerts, SMS payloads (EN/HI), GSM AT commands, and Voice TTS scripts.
 */
function generateFarmerAdvisories(diagnosticContext = {}) {
    const {
        diseaseSeverityPercent = 0,
        diseaseLabel = "healthy",
        pestEarlyWarning = null,
        smartIrrigation = null,
        environmentalRisk = null
    } = diagnosticContext;

    const triggeredAlerts = [];

    // 1. Check Irrigation Alerts
    if (smartIrrigation) {
        if (smartIrrigation.farmRecommendation === 'irrigate_now') {
            triggeredAlerts.push(PS_ALERT_TEMPLATES.IRRIGATE_NOW);
        } else if (smartIrrigation.farmRecommendation === 'delay') {
            triggeredAlerts.push(PS_ALERT_TEMPLATES.DELAY_IRRIGATION);
        }
    }

    // 2. Check Disease Pathology Alerts
    const isDiseased = !diseaseLabel.toLowerCase().includes("healthy") && diseaseSeverityPercent > 15;
    if (isDiseased) {
        const cleanedDisease = diseaseLabel.replace(/___/g, ' ').replace(/_/g, ' ');
        triggeredAlerts.push({
            code: "POSSIBLE_DISEASE_DETECTED",
            en: `Possible disease detected: ${cleanedDisease} (${diseaseSeverityPercent}% severity). Inspect Zone 02.`,
            hi: `संभावित फसल रोग की पहचान: ${cleanedDisease} (${diseaseSeverityPercent}% संक्रमण)। प्रभावित पौधों की जांच करें।`
        });
    }

    // 3. Check Pest Early Warning Alerts
    if (pestEarlyWarning && (pestEarlyWarning.trend === 'rising' || pestEarlyWarning.outbreakRisk === 'high' || pestEarlyWarning.outbreakRisk === 'critical')) {
        triggeredAlerts.push({
            code: "PEST_ACTIVITY_INCREASING",
            en: `Pest activity increasing: +${pestEarlyWarning.rateOfChangePct}% surge (${pestEarlyWarning.pestProfile.name}). Deploy ${pestEarlyWarning.pestProfile.trapColor} traps.`,
            hi: `कीट प्रकोप में वृद्धि: +${pestEarlyWarning.rateOfChangePct}% वृद्धि दर (${pestEarlyWarning.pestProfile.name})। तुरंत ट्रैप लगाएं।`
        });
    }

    // 4. Check Environmental Hazards
    if (environmentalRisk && environmentalRisk.risks) {
        environmentalRisk.risks.forEach(risk => {
            if (risk.hazardType === 'heat_stress' && risk.severity === 'warning') {
                triggeredAlerts.push(PS_ALERT_TEMPLATES.HEAT_STRESS_WARNING);
            } else if (risk.hazardType === 'flood' && risk.severity === 'warning') {
                triggeredAlerts.push(PS_ALERT_TEMPLATES.FLOOD_RISK_ALERT);
            }
        });
    }

    // Fallback if no critical triggers
    if (triggeredAlerts.length === 0) {
        triggeredAlerts.push({
            code: "NORMAL_STATUS",
            en: "Farm conditions optimal: Crop health, soil moisture, and weather are normal.",
            hi: "खेत की स्थिति अनुकूल: फसल स्वास्थ्य, मिट्टी की नमी और मौसम सभी सामान्य हैं।"
        });
    }

    // Generate Standard Mobile SMS Messages (English & Hindi)
    const primaryAlert = triggeredAlerts[0];
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const smsEnglish = `[AGRISENTRY] ${timestampStr} Alert:\n${triggeredAlerts.map(a => `• ${a.en}`).join('\n')}\nHelpline: 1800-180-1551`;
    const smsHindi = `[एग्रीसेंट्री अलर्ट] ${timestampStr}:\n${triggeredAlerts.map(a => `• ${a.hi}`).join('\n')}\nकिसान हेल्पलाइन: 1800-180-1551`;

    // Voice TTS Scripts (Natural conversational Hindi & English speech)
    const voiceTextEn = `AgriSentry Advisory Update. ${triggeredAlerts.map(a => a.en).join(' ')}`;
    const voiceTextHi = `नमस्ते किसान भाई। एग्रीसेंट्री सलाह: ${triggeredAlerts.map(a => a.hi).join(' ')}`;

    // GSM SIM800L / SIM900 AT Command Payload Simulator
    const gsmAtCommands = [
        'AT+CMGF=1',
        'AT+CSCS="GSM"',
        'AT+CMGS="+919876543210"',
        `> ${smsEnglish.substring(0, 140)}...`,
        '<CTRL+Z> (0x1A) -> +CMGS: 42 OK'
    ];

    return {
        triggeredAlerts,
        primaryAlertCode: primaryAlert.code,
        sms: {
            english: smsEnglish,
            hindi: smsHindi,
            senderId: "AGRISENTRY-HQ",
            recipient: "+91-98765-43210 (Demo Farmer)",
            timestamp: new Date().toISOString()
        },
        voice: {
            textEn: voiceTextEn,
            textHi: voiceTextHi
        },
        gsmSimulator: {
            module: "SIM800L Quad-Band GSM/GPRS Modem",
            baudRate: 9600,
            atCommands: gsmAtCommands
        }
    };
}

module.exports = {
    PS_ALERT_TEMPLATES,
    generateFarmerAdvisories
};
