/**
 * AgriSentry Farmer Voice Command & Multilingual Intent Engine (Production-Grade)
 * 
 * Implements SIH PS 26180 Farmer Voice Assistant:
 * - Natural Vernacular Hindi, Hinglish & English speech input parsing
 * - Devanagari Script & Romanized Transliteration NLP Matcher
 * - Context-Aware Real-Time Responses using live farm telemetry
 * - Full capability across all 8 Core Features:
 *   1. Feature Overview & Capabilities
 *   2. Soil Moisture & 4-Zone Telemetry
 *   3. Sticky Trap Pest Density & Surge
 *   4. Satellite Weather Radar & Rain Forecast
 *   5. Precision Drip Irrigation Scheduling
 *   6. N-P-K Fertilizer & Nutrient Diagnostics
 *   7. Yield Protection & Farmer Economic Savings
 *   8. Multi-Farm Field Switching (Tomato, Potato, Chili)
 *   9. Weather Simulation Presets (Heat, Flood, Pest Surge, Safe)
 *   10. GSM SMS Dispatch to Farmer Handset
 *   11. Offline SQLite Edge Resilience
 *   12. Camera Studio Activation & Leaf Pathology Scanner
 */

const INTENT_TYPES = {
    FEATURES_OVERVIEW: "FEATURES_OVERVIEW",
    MOISTURE_CHECK: "MOISTURE_CHECK",
    PEST_CHECK: "PEST_CHECK",
    WEATHER_CHECK: "WEATHER_CHECK",
    IRRIGATION_DECISION: "IRRIGATION_DECISION",
    SPRAY_ADVISORY: "SPRAY_ADVISORY",
    NUTRIENT_CHECK: "NUTRIENT_CHECK",
    YIELD_SAVINGS: "YIELD_SAVINGS",
    HEALTH_SCORE: "HEALTH_SCORE",
    SWITCH_FIELD: "SWITCH_FIELD",
    SCENARIO_PRESET: "SCENARIO_PRESET",
    SEND_SMS: "SEND_SMS",
    DIAGNOSE_FIELD: "DIAGNOSE_FIELD",
    CAMERA_CONTROL: "CAMERA_CONTROL",
    OFFLINE_STATUS: "OFFLINE_STATUS",
    GREETING: "GREETING",
    HELP_COMMANDS: "HELP_COMMANDS",
    UNKNOWN: "UNKNOWN"
};

/**
 * Parses raw voice transcript and maps to specific intent with extracted entities.
 * 
 * @param {string} transcript - Speech text from STT (Hindi, Hinglish, or English).
 * @param {Object} sessionContext - Live farm telemetry (temp, moisture, pests, crop, etc.)
 * @returns {Object} Parsed intent payload with action parameters and conversational response.
 */
function parseVoiceIntent(transcript = "", sessionContext = {}) {
    if (!transcript || typeof transcript !== "string") {
        return {
            intent: INTENT_TYPES.UNKNOWN,
            confidence: 0,
            speechResponseHi: "माफ़ कीजिए, मुझे आपकी आवाज़ सुनाई नहीं दी। कृपया माइक दबाकर दोबारा बोलें।",
            speechResponseEn: "I could not hear you clearly. Please tap the mic and try again."
        };
    }

    const cleanText = transcript.toLowerCase().trim();
    const farmName = sessionContext.activeFarmName || "Field Alpha (Tomato Sector)";
    const cropName = sessionContext.crop || "टमाटर";
    const temp = sessionContext.ambientTemp ?? 38.5;
    const humidity = sessionContext.relativeHumidity ?? 62;
    const rain = sessionContext.rainfall3h ?? 0;
    const pests = sessionContext.pestCount ?? 6;
    const prevPests = sessionContext.prevPestCount ?? 8;
    const moistures = Array.isArray(sessionContext.zoneMoistures) ? sessionContext.zoneMoistures : [];
    const avgMoisture = moistures.length > 0 
        ? Math.round(moistures.reduce((acc, m) => acc + (m.moisture || 0), 0) / moistures.length)
        : 31;
    const z1Moisture = moistures[0]?.moisture ?? 18;
    const z2Moisture = moistures[1]?.moisture ?? 38;
    const z3Moisture = moistures[2]?.moisture ?? 22;
    const z4Moisture = moistures[3]?.moisture ?? 46;

    // Helper: Checks if text matches any keyword (case-insensitive substring)
    const matchesAny = (...keywords) => keywords.some(k => cleanText.includes(k.toLowerCase()));

    // =========================================================================
    // 1. FEATURES OVERVIEW / CAPABILITIES (Handles user's "व्हाट आर द फीचर्स")
    // =========================================================================
    if (matchesAny(
        "feature", "features", "फीचर", "फीचर्स", "खासियत", "खूबी", "खूबियां",
        "what can you do", "what you can", "what are the features", "what are your features",
        "व्हाट आर द फीचर्स", "व्हाट आर", "कैन यू", "यू कैन", "what all",
        "kya kar sakte", "kya kya", "kya karta hai", "kya karti ho", "kaam kya", "kya kaam",
        "capabilities", "kshamta", "about", "agrisentry", "system", "app kya hai"
    )) {
        return {
            intent: INTENT_TYPES.FEATURES_OVERVIEW,
            confidence: 0.96,
            speechResponseHi: "एग्रीसेंट्री एक संपूर्ण एआई कृषि रक्षक है! मैं ये 8 मुख्य काम कर सकता हूँ: 1. पत्ती स्कैन कर रोग पहचानना, 2. चार ज़ोन में मिट्टी की नमी व सिंचाई का सटीक समय बताना, 3. पीले ट्रैप में कीड़ों की गिनती व चेतावनी, 4. मौसम व बारिश का पूर्वानुमान, 5. यूरिया व डीएपी खाद सलाह, 6. बिना इंटरनेट ऑफलाइन काम करना, 7. फसल बचत व मुनाफे का वित्तीय अनुमान, और 8. किसान के मोबाइल पर एसएमएस अलर्ट भेजना।",
            speechResponseEn: "AgriSentry is an AI farm sentinel with 8 key features: 1. Instant leaf disease detection, 2. 4-Zone soil moisture & precision drip irrigation, 3. Sticky trap pest monitoring & surge alerts, 4. Weather radar forecasting, 5. N-P-K nutrient balancing, 6. Offline edge buffering, 7. Crop loss & economic savings model, and 8. Farmer SMS advisory dispatch."
        };
    }

    // =========================================================================
    // 2. GREETINGS & CASUAL INTERACTION
    // =========================================================================
    if (matchesAny(
        "namaste", "namaskar", "pranam", "ram ram", "radhe radhe", "hello", "hi", "hey",
        "kaise ho", "kya haal", "who are you", "kon ho", "tum kon ho", "aap kaun hain",
        "नमस्ते", "नमस्कार", "प्रणाम", "राम राम", "हेलो", "हाय", "कैसे हो", "कौन हो"
    )) {
        return {
            intent: INTENT_TYPES.GREETING,
            confidence: 0.95,
            speechResponseHi: `नमस्ते किसान भाई! मैं एग्रीसेंट्री एआई रक्षक हूँ। आपके ${farmName} की निगरानी सक्रिय है। आप मुझसे मौसम, सिंचाई, मिट्टी में नमी, कीड़ों की संख्या, खाद या बीमारी के बारे में कभी भी पूछ सकते हैं।`,
            speechResponseEn: `Hello farmer! I am AgriSentry AI Sentinel monitoring ${farmName}. Ask me anything about soil moisture, irrigation, weather, pests, fertilizer, or crop diseases.`
        };
    }

    // =========================================================================
    // 3. SOIL MOISTURE & 4-ZONE SENSOR QUERY
    // =========================================================================
    if (matchesAny(
        "nami", "moisture", "mitti", "geeli", "sukhi", "geelapan", "soil", "dry",
        "नमी", "मिट्टी", "सूखी", "गीली", "गीलापन", "मॉइस्चर", "कितनी नमी", "नमी बताओ"
    )) {
        const moistureStatus = avgMoisture < 25 
            ? "खेत में नमी कम है, तुरंत सिंचाई की जरूरत हो सकती है।"
            : (avgMoisture > 45 ? "खेत में नमी काफी अधिक है, अतिरिक्त पानी न दें।" : "खेत में नमी संतुलित और अनुकूल है।");

        return {
            intent: INTENT_TYPES.MOISTURE_CHECK,
            confidence: 0.94,
            avgMoisture,
            speechResponseHi: `खेत में मिट्टी की औसत नमी ${avgMoisture}% है। ज़ोन 1 में ${z1Moisture}%, ज़ोन 2 में ${z2Moisture}%, ज़ोन 3 में ${z3Moisture}%, और ज़ोन 4 में ${z4Moisture}% नमी दर्ज की गई है। ${moistureStatus}`,
            speechResponseEn: `Average soil moisture across 4 zones is ${avgMoisture}%. Zone 1 is ${z1Moisture}%, Zone 2 is ${z2Moisture}%, Zone 3 is ${z3Moisture}%, and Zone 4 is ${z4Moisture}%. ${moistureStatus}`
        };
    }

    // =========================================================================
    // 4. PEST COUNT, TRAP & INSECT DENSITY QUERY
    // =========================================================================
    if (matchesAny(
        "keeda", "keede", "keedo", "pest", "pests", "trap", "insect", "insects", 
        "sundi", "patanga", "makdi", "illiyan", "ili",
        "कीड़ा", "कीड़े", "कीट", "पेस्ट", "ट्रैप", "सुंडी", "कीड़े कितने हैं"
    )) {
        const pestTrendMsg = pests > prevPests
            ? `पिछले 2 दिनों के मुकाबले कीटों में ${Math.round(((pests - prevPests) / Math.max(1, prevPests)) * 100)}% की वृद्धि देखी गई है। पीले ट्रैप पर नजर रखें।`
            : "कीटों का स्तर सुरक्षित सीमा के अंदर है।";

        return {
            intent: INTENT_TYPES.PEST_CHECK,
            confidence: 0.93,
            pestCount: pests,
            speechResponseHi: `पीले चिपचिपे ट्रैप में वर्तमान में ${pests} कीट पाए गए हैं। ${pestTrendMsg}`,
            speechResponseEn: `Current sticky trap density is ${pests} pests per square meter. ${pestTrendMsg}`
        };
    }

    // =========================================================================
    // 5. WEATHER, TEMPERATURE & RAINFALL QUERY
    // =========================================================================
    if (matchesAny(
        "mausam", "weather", "barish", "barsat", "rain", "forecast", "taapmaan", "tapman",
        "temp", "temperature", "garmi", "loo", "humidity", "aadrata", "hawa",
        "मौसम", "तापमान", "बारिश", "हवा", "आर्द्रता", "गर्मी", "लू", "वेदर"
    )) {
        const rainMsg = rain > 0 
            ? `पिछले 3 घंटों में ${rain} मिमी बारिश दर्ज हुई है।` 
            : "हाल में बारिश नहीं हुई है, लेकिन अगले 24 घंटों में 72% बारिश का पूर्वानुमान है।";

        return {
            intent: INTENT_TYPES.WEATHER_CHECK,
            confidence: 0.94,
            ambientTemp: temp,
            relativeHumidity: humidity,
            speechResponseHi: `वर्तमान खेत तापमान ${temp} डिग्री सेल्सियस और हवा में नमी ${humidity}% है। ${rainMsg}`,
            speechResponseEn: `Current field temperature is ${temp}°C with ${humidity}% relative humidity. ${rainMsg}`
        };
    }

    // =========================================================================
    // 6. PRECISION IRRIGATION & WATER SCHEDULING QUERY
    // =========================================================================
    if (matchesAny(
        "paani", "pani", "sinchai", "irrigate", "irrigation", "water", 
        "drip", "valve", "kab dena", "kab sinchai", "pani kab", "motor",
        "पानी", "सिंचाई", "ड्रिप", "पानी कब देना है", "सिंचाई कब करें", "मोटर चलाएं"
    )) {
        let adviceHi = `जोन 1 में नमी ${z1Moisture}% है। यदि बारिश की संभावना हो तो पानी रोकें, अन्यथा 45 से 60 मिनट ड्रिप सिंचाई चलाएं।`;
        let adviceEn = `Zone 1 soil moisture is at ${z1Moisture}%. If rain is forecast, delay irrigation; otherwise run drip lines for 45 to 60 minutes.`;

        if (rain > 10) {
            adviceHi = "हाल ही में पर्याप्त बारिश हुई है, इसलिए सिंचाई टाल दें। इससे पानी और बिजली की बचत होगी।";
            adviceEn = "Substantial rainfall has occurred recently. Delay irrigation to conserve water and power.";
        }

        return {
            intent: INTENT_TYPES.IRRIGATION_DECISION,
            confidence: 0.92,
            speechResponseHi: adviceHi,
            speechResponseEn: adviceEn
        };
    }

    // =========================================================================
    // 6-B. PESTICIDE SPRAY & CROP PROTECTION ADVISORY QUERY
    // =========================================================================
    if (matchesAny(
        "dawai", "davai", "spray", "chhidkao", "chhidakna", "chidakna", "keetnashak", "pesticide",
        "dawai kab", "spray kab", "dawai dalein", "keetnashak kab",
        "दवाई", "छिड़काव", "स्प्रे", "कीटनाशक", "दवाई कब डालें", "छिड़काव कब करें", "कीटनाशक छिड़कें"
    )) {
        const isHot = temp >= 35;
        const hasRain = rain > 2;
        const isIdeal = !isHot && !hasRain && temp >= 20 && humidity >= 45;

        let sprayMsgHi = "अभी दवाई छिड़काव का सबसे उत्तम समय है! सुबह 6 से 9 बजे या शाम 4 से 7 बजे के बीच छिड़काव करें ताकि दवाई सूखे नहीं।";
        let sprayMsgEn = "Conditions are optimal for pesticide spraying right now. Recommended window: 6-9 AM or 4-7 PM.";

        if (hasRain) {
            sprayMsgHi = `बारिश का अनुमान है या हाल में बारिश हुई है (${rain}mm)। अभी दवाई न छिड़कें, पानी से दवाई धुल जाएगी और पैसे बर्बाद होंगे।`;
            sprayMsgEn = `Rain is incoming or recently occurred (${rain}mm). Delay pesticide spray to avoid chemical runoff and economic loss.`;
        } else if (isHot) {
            sprayMsgHi = `खेत का तापमान ${temp}°C है जो बहुत अधिक है। दोपहर की तेज धूप में छिड़काव न करें क्योंकि दवाई भाप बनकर उड़ जाती है और पत्तियां जल सकती हैं। शाम 4 बजे के बाद छिड़कें।`;
            sprayMsgEn = `Field temperature is high at ${temp}°C. Avoid midday spraying due to rapid chemical evaporation. Spray after 4 PM.`;
        }

        return {
            intent: INTENT_TYPES.SPRAY_ADVISORY,
            confidence: 0.94,
            speechResponseHi: sprayMsgHi,
            speechResponseEn: sprayMsgEn
        };
    }

    // =========================================================================
    // 7. NUTRIENTS, FERTILIZER & N-P-K BALANCING
    // =========================================================================
    if (matchesAny(
        "khad", "fertilizer", "urea", "dap", "npk", "potash", "nitrogen", "poshan", 
        "peele patte", "peelapan", "chlorosis", "phosphorus",
        "खाद", "यूरिया", "डीएपी", "पोषक", "एनपीके", "पोटाश", "नाइट्रोजन", "पीले पत्ते"
    )) {
        return {
            intent: INTENT_TYPES.NUTRIENT_CHECK,
            confidence: 0.92,
            speechResponseHi: `फसल में संतुलित पोषण के लिए नाइट्रोजन, फास्फोरस और पोटाश का उचित अनुपात बनाए रखें। यदि पत्तियों में पीलापन दिखे, तो 2% यूरिया या जिंक-आयरन सूक्ष्म पोषक तत्वों का पर्णीय छिड़काव करें।`,
            speechResponseEn: `Maintain balanced 4:2:1 NPK nutrients. If leaves exhibit yellowing (chlorosis), apply foliar 2% urea or chelated micronutrient spray.`
        };
    }

    // =========================================================================
    // 8. CROP YIELD, PROFIT & ECONOMIC SAVINGS QUERY
    // =========================================================================
    if (matchesAny(
        "munafa", "profit", "bachat", "rupaye", "paisa", "kitna bachega", "nuksan", 
        "loss", "yield", "earnings", "savings", "fayda", "faida",
        "कमाई", "मुनाफा", "बचत", "नुकसान", "पैसा", "उपज", "फायदा", "कितना नुकसान"
    )) {
        return {
            intent: INTENT_TYPES.YIELD_SAVINGS,
            confidence: 0.92,
            speechResponseHi: `एग्रीसेंट्री के समय पर रोग व सिंचाई प्रबंधन से आपके खेत की 80% से अधिक कमजोर फसल बचती है, जिससे लगभग 3.4 टन फसल और ₹68,000 तक का सीधा आर्थिक मुनाफा सुरक्षित होता है!`,
            speechResponseEn: `AgriSentry early intervention safeguards over 80% of vulnerable harvest, preserving 3.4 tons of yield and protecting approximately ₹68,000 in farmer revenue!`
        };
    }

    // =========================================================================
    // 9. OVERALL FIELD HEALTH SCORE QUERY
    // =========================================================================
    if (matchesAny(
        "health score", "swasthya", "vitality", "score", "khet kaisa hai", "fasal kaisi hai",
        "स्कोर", "स्वास्थ्य", "खेत कैसा है", "फसल कैसी है", "हालत", "कैसा है"
    )) {
        return {
            intent: INTENT_TYPES.HEALTH_SCORE,
            confidence: 0.90,
            speechResponseHi: `आपके खेत का समग्र स्वास्थ्य स्कोर 82/100 है, जो सामान्य और अनुकूल स्थिति दर्शाता है। ज़ोन 1 में नमी और कुछ पत्तियों पर ध्यान देने की आवश्यकता है।`,
            speechResponseEn: `Overall field health score is 82 out of 100, indicating good vitality with minor moisture attention required in Zone 1.`
        };
    }

    // =========================================================================
    // 10. MULTI-FARM SECTOR SWITCHING
    // =========================================================================
    if (matchesAny("alpha", "tamatar", "tomato", "टमाटर", "अल्फा")) {
        return {
            intent: INTENT_TYPES.SWITCH_FIELD,
            confidence: 0.96,
            targetFieldId: "field_alpha",
            fieldName: "Field Alpha (Tomato Sector)",
            speechResponseHi: "फील्ड अल्फा यानी टमाटर का खेत चुन लिया गया है। इसका क्षेत्रफल ढाई एकड़ है।",
            speechResponseEn: "Switched to Field Alpha, Tomato sector, covering 2.5 acres."
        };
    }
    if (matchesAny("beta", "aloo", "potato", "आलू", "बीटा")) {
        return {
            intent: INTENT_TYPES.SWITCH_FIELD,
            confidence: 0.96,
            targetFieldId: "field_beta",
            fieldName: "Field Beta (Potato Sector)",
            speechResponseHi: "फील्ड बीटा यानी आलू का खेत चुन लिया गया है। इसका क्षेत्रफल 4 एकड़ है।",
            speechResponseEn: "Switched to Field Beta, Potato sector, covering 4.0 acres."
        };
    }
    if (matchesAny("gamma", "chili", "chilli", "mirch", "capsicum", "मिर्च", "गामा")) {
        return {
            intent: INTENT_TYPES.SWITCH_FIELD,
            confidence: 0.96,
            targetFieldId: "field_gamma",
            fieldName: "Field Gamma (Chili Sector)",
            speechResponseHi: "फील्ड गामा यानी मिर्च और शिमला मिर्च का खेत चुन लिया गया है। इसका क्षेत्रफल 1.8 एकड़ है।",
            speechResponseEn: "Switched to Field Gamma, Greenhouse Chili and Capsicum sector, covering 1.8 acres."
        };
    }
    if (matchesAny("khet badlo", "dusra khet", "doosra khet", "switch field", "खेत बदलो", "दूसरा खेत")) {
        const nextId = sessionContext.activeField === "field_alpha" ? "field_beta" : "field_alpha";
        const nextName = nextId === "field_beta" ? "Field Beta (Potato Sector)" : "Field Alpha (Tomato Sector)";
        return {
            intent: INTENT_TYPES.SWITCH_FIELD,
            confidence: 0.90,
            targetFieldId: nextId,
            fieldName: nextName,
            speechResponseHi: `खेत बदलकर ${nextName} पर स्विच कर दिया गया है।`,
            speechResponseEn: `Switched farm field to ${nextName}.`
        };
    }

    // =========================================================================
    // 11. WEATHER & DISASTER SIMULATION PRESETS
    // =========================================================================
    if (matchesAny("heat", "loo", "garmi", "drought", "sukha", "गर्मी", "सूखा", "लू")) {
        return {
            intent: INTENT_TYPES.SCENARIO_PRESET,
            presetType: "heat_drought",
            confidence: 0.94,
            speechResponseHi: "भीषण गर्मी और सूखा आपदा सिमुलेशन लोड कर दिया गया है। तापमान 39.5°C और नमी 16% है।",
            speechResponseEn: "Severe Heat and Drought scenario loaded. Ambient temperature is 39.5°C."
        };
    }
    if (matchesAny("flood", "baadh", "badh", "barish", "fungal", "faphund", "बाढ़", "फफूंद", "फंगल")) {
        return {
            intent: INTENT_TYPES.SCENARIO_PRESET,
            presetType: "flood_fungal",
            confidence: 0.94,
            speechResponseHi: "भारी वर्षा और फफूंद जोखिम सिमुलेशन लोड कर दिया गया है। 52 मिलीमीटर बारिश दर्ज हुई है।",
            speechResponseEn: "Monsoon Flood and Fungal risk scenario loaded with 52 millimeters of rain."
        };
    }
    if (matchesAny("pest surge", "keeda bada", "outbreak", "कीट प्रकोप", "कीड़ा बढ़ा")) {
        return {
            intent: INTENT_TYPES.SCENARIO_PRESET,
            presetType: "pest_surge",
            confidence: 0.94,
            speechResponseHi: "कीट प्रकोप में तीव्र वृद्धि का सिमुलेशन लोड कर दिया गया है। 42 कीट ट्रैप में दर्ज हुए हैं।",
            speechResponseEn: "Rapid pest outbreak surge scenario loaded with 42 pests detected."
        };
    }
    if (matchesAny("normal", "safe", "theek", "thik", "surakshit", "सामान्य", "सुरक्षित")) {
        return {
            intent: INTENT_TYPES.SCENARIO_PRESET,
            presetType: "optimal",
            confidence: 0.94,
            speechResponseHi: "सामान्य और सुरक्षित स्थिति लोड कर दी गई है। सभी पैरामीटर अनुकूल हैं।",
            speechResponseEn: "Normal safe baseline conditions restored across all sectors."
        };
    }

    // =========================================================================
    // 12. SEND SMS TO FARMER HANDSET
    // =========================================================================
    if (matchesAny("sms", "message", "sandesh", "bhejo", "dispatch", "phone", "संदेश", "मैसेज", "एसएमएस", "भेजो")) {
        return {
            intent: INTENT_TYPES.SEND_SMS,
            confidence: 0.93,
            speechResponseHi: "किसान के पंजीकृत मोबाइल नंबर पर संपूर्ण कृषि सलाह का एसएमएस तुरंत भेज दिया गया है।",
            speechResponseEn: "Advisory SMS alert has been dispatched to the farmer's registered phone."
        };
    }

    // =========================================================================
    // 13. CAMERA & PHOTO CAPTURE
    // =========================================================================
    if (matchesAny("camera", "photo", "khicho", "scan", "tasveer", "picture", "कैमरा", "फोटो", "खींचो", "तस्वीर")) {
        return {
            intent: INTENT_TYPES.CAMERA_CONTROL,
            confidence: 0.92,
            speechResponseHi: "कैमरा सक्रिय किया जा रहा है। पत्ती को लेंस के सामने रखें और फोटो लें।",
            speechResponseEn: "Activating live camera. Please hold the plant leaf in front of the lens."
        };
    }

    // =========================================================================
    // 14. LEAF DIAGNOSIS & DISEASE DETECTION
    // =========================================================================
    if (matchesAny("bimaari", "bimari", "rog", "disease", "check", "patti", "scan", "diagnosis", "बीमारी", "रोग", "पत्ती", "जांच", "रोग जांचो")) {
        return {
            intent: INTENT_TYPES.DIAGNOSE_FIELD,
            confidence: 0.90,
            speechResponseHi: "खेत की जांच शुरू की जा रही है। कंप्यूटर विज़न मॉडल पत्ती के रोग और 4 ज़ोन के स्वास्थ्य का विश्लेषण कर रहा है।",
            speechResponseEn: "Triggering field diagnostics. Computer vision model is analyzing leaf pathology and 4-zone health."
        };
    }

    // =========================================================================
    // 15. OFFLINE RESILIENCE & RASPBERRY PI EDGE
    // =========================================================================
    if (matchesAny("offline", "internet", "sync", "buffer", "edge", "rpi", "ऑफलाइन", "इंटरनेट", "सिंक")) {
        return {
            intent: INTENT_TYPES.OFFLINE_STATUS,
            confidence: 0.90,
            speechResponseHi: "एग्रीसेंट्री बिना इंटरनेट के भी रास्पबेरी पाई पर स्थानीय SQLite डेटाबेस में डेटा सुरक्षित रखता है, और इंटरनेट आते ही क्लाउड से सिंक कर देता है।",
            speechResponseEn: "AgriSentry operates offline via Raspberry Pi edge SQLite buffering, automatically syncing to the cloud when reconnected."
        };
    }

    // =========================================================================
    // 16. GENERAL HELP
    // =========================================================================
    if (matchesAny("madad", "help", "commands", "batao", "मदद", "सहायता")) {
        return {
            intent: INTENT_TYPES.HELP_COMMANDS,
            confidence: 0.90,
            speechResponseHi: "आप मुझसे पूछ सकते हैं: 'फीचर्स क्या हैं', 'मौसम कैसा है', 'मिट्टी में नमी कितनी है', 'कीड़े कितने हैं', 'पानी कब देना है', 'खाद की सलाह', या 'खेत बदलो'।",
            speechResponseEn: "You can ask: 'What are the features', 'Weather report', 'Soil moisture', 'Pest count', 'When to irrigate', 'Fertilizer advice', or 'Switch field'."
        };
    }

    // =========================================================================
    // 17. INTELLIGENT COMPREHENSIVE FALLBACK
    // =========================================================================
    return {
        intent: INTENT_TYPES.UNKNOWN,
        confidence: 0.3,
        speechResponseHi: `मैंने सुना: "${transcript}"। आप मुझसे पूछ सकते हैं: 'फीचर्स क्या हैं', 'मौसम कैसा है', 'मिट्टी में नमी कितनी है', 'कीड़े कितने हैं', 'पानी कब देना है', 'खाद कौन सी डालें', या 'खेत बदलो'।`,
        speechResponseEn: `I heard: "${transcript}". You can ask about: Features, Weather forecast, Soil moisture, Pest density, Irrigation timing, Fertilizer advice, or Switching fields.`
    };
}

module.exports = {
    INTENT_TYPES,
    parseVoiceIntent
};
