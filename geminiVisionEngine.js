/**
 * AgriSentry Multimodal Agricultural Vision Engine (Powered by Google Gemini Flash)
 * 
 * Uses Google Gemini Vision via official @google/genai SDK.
 * Solves domain-shift limitations of fixed-class models with expert visual reasoning across unconstrained field photos.
 */

const { GoogleGenAI } = require('@google/genai');
const { getFarmSectorById } = require('./farmFleetEngine');

// Daily rate-limit safety guard
let dailyRequestCounter = {
    date: new Date().toISOString().split('T')[0],
    count: 0,
    dailyLimit: 1200 // Safety threshold for free-tier AI Studio quota
};

function checkAndIncrementRateLimit() {
    const today = new Date().toISOString().split('T')[0];
    if (dailyRequestCounter.date !== today) {
        dailyRequestCounter.date = today;
        dailyRequestCounter.count = 0;
    }
    if (dailyRequestCounter.count >= dailyRequestCounter.dailyLimit) {
        throw new Error(`Daily Gemini API quota safety limit (${dailyRequestCounter.dailyLimit} requests/day) reached. Try again tomorrow or upgrade quota.`);
    }
    dailyRequestCounter.count++;
    console.log(`[Gemini Vision Guard] Daily request counter: ${dailyRequestCounter.count}/${dailyRequestCounter.dailyLimit}`);
}

/**
 * Executes multimodal agronomic pathology reasoning using Google Gemini Vision.
 * 
 * @param {Buffer} imageBuffer - Raw binary image buffer
 * @param {string} mimeType - Image MIME type (e.g. image/jpeg, image/png)
 * @param {string} farmId - Active farm sector ID (e.g. 'field_alpha', 'field_beta', 'field_gamma')
 * @param {string} growthStage - Current crop stage
 * @returns {Promise<Object>} Structured diagnosis JSON matching AgriSentry schema
 */
async function analyzeCropWithGemini(imageBuffer, mimeType = 'image/jpeg', farmId = 'field_alpha', growthStage = 'Vegetative') {
    const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : "";
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
        throw new Error("GEMINI_API_KEY is not configured in .env. Please add your key from https://aistudio.google.com/apikey");
    }

    checkAndIncrementRateLimit();

    const farmSector = getFarmSectorById(farmId);
    const activeCropContext = farmSector ? `${farmSector.name} (${farmSector.cropType})` : "Solanaceous Field Crop (Tomato/Potato/Pepper)";

    const ai = new GoogleGenAI({ apiKey });
    const base64Data = imageBuffer.toString('base64');

    const prompt = `You are AgriSentry's Senior Precision Agronomist and Plant Pathologist AI.
Analyze this field photo of a crop plant leaf.

Context:
- Active Farm Sector: ${activeCropContext}
- Growth Stage: ${growthStage}

Your Task:
1. Examine the leaf visual features, chlorosis patterns, necrotic lesions, leaf edges, pustules, vascular veins, and background field conditions.
2. Identify the specific crop in the image (or confirm with farm context).
3. Identify the exact pathology/disease present. If foliage is vigorous, green, and disease-free, state "Healthy Plant".
4. Estimate genuine confidence percentage (0 to 100). Lower confidence if blurry, occluded, or ambiguous.
5. Estimate visible lesion severity percentage (0 to 100% of leaf area affected).
6. List 2-3 short, precise observed visual symptoms (in English and Hindi).
7. Provide an actionable organic and IPM chemical remedy recommendation (in English and Hindi).
8. Break down the visual infection percentage across the 4 spatial quadrants of the leaf/canopy view:
   - Zone 1 (Top-Left / North-West Quadrant): estimated % affected (0-100)
   - Zone 2 (Top-Right / North-East Quadrant): estimated % affected (0-100)
   - Zone 3 (Bottom-Left / South-West Quadrant): estimated % affected (0-100)
   - Zone 4 (Bottom-Right / South-East Quadrant): estimated % affected (0-100)
9. Provide primary NPK nutrient status and secondary differential diagnoses if applicable.

Return ONLY a valid JSON object with NO markdown formatting, NO backticks, and NO conversational text.

Required JSON Schema:
{
  "crop": "string (e.g. Tomato)",
  "cropHi": "string (e.g. टमाटर)",
  "diseaseLabel": "string (e.g. Tomato with Late Blight / Healthy Plant)",
  "diseaseLabelHi": "string (e.g. टमाटर में लेट ब्लाइट रोग / स्वस्थ पौधा)",
  "isHealthy": boolean,
  "confidence": number (between 0.00 and 1.00, e.g. 0.94),
  "diseaseSeverityPercent": number (0 to 100),
  "spatialZoneInfection": {
    "zone1NorthWest": number (0 to 100),
    "zone2NorthEast": number (0 to 100),
    "zone3SouthWest": number (0 to 100),
    "zone4SouthEast": number (0 to 100)
  },
  "symptoms": "string (2-3 key visual cues)",
  "symptomsHi": "string (लक्षण हिंदी में)",
  "remedy": "string (precise IPM bio-fungicide or treatment)",
  "remedyHi": "string (उपचार व दवा हिंदी में)",
  "differentialDiagnoses": [
    { "rank": 1, "label": "string", "probability": "string (e.g. 92%)" },
    { "rank": 2, "label": "string", "probability": "string (e.g. 8%)" }
  ]
}`;

    // Ultra-low latency Gemini Flash Lite models (1.2s - 1.6s response time)
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
    let lastError = null;

    for (const modelName of candidateModels) {
        try {
            console.log(`[Gemini Vision Engine] Calling fast model ${modelName} with image (${imageBuffer.length} bytes)...`);
            const startTime = Date.now();

            const response = await ai.models.generateContent({
                model: modelName,
                contents: [
                    {
                        inlineData: {
                            mimeType: mimeType || 'image/jpeg',
                            data: base64Data
                        }
                    },
                    {
                        text: prompt
                    }
                ],
                config: {
                    responseMimeType: 'application/json',
                    temperature: 0.2
                }
            });

            const elapsed = Date.now() - startTime;
            console.log(`[Gemini Vision Engine] Received fast response from ${modelName} in ${elapsed}ms`);

            const rawText = response.text || "";
            const cleanedJsonText = stripMarkdownFences(rawText);

            const parsed = JSON.parse(cleanedJsonText);
            const overallSev = typeof parsed.diseaseSeverityPercent === 'number' ? parsed.diseaseSeverityPercent : (parsed.isHealthy ? 0 : 35);
            
            // Extract or calibrate spatial quadrants
            const z1 = parsed.spatialZoneInfection?.zone1NorthWest ?? overallSev;
            const z2 = parsed.spatialZoneInfection?.zone2NorthEast ?? overallSev;
            const z3 = parsed.spatialZoneInfection?.zone3SouthWest ?? overallSev;
            const z4 = parsed.spatialZoneInfection?.zone4SouthEast ?? overallSev;

            return {
                success: true,
                engine: `Google Gemini Flash (${modelName})`,
                crop: parsed.crop || "Crop Leaf",
                cropHi: parsed.cropHi || "फसल",
                diseaseLabel: parsed.diseaseLabel || "Healthy Plant",
                diseaseLabelHi: parsed.diseaseLabelHi || "स्वस्थ पौधा",
                isHealthy: !!parsed.isHealthy,
                confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.92,
                diseaseSeverityPercent: overallSev,
                spatialZoneInfection: {
                    zone1NorthWest: Math.max(0, Math.min(100, Math.round(z1))),
                    zone2NorthEast: Math.max(0, Math.min(100, Math.round(z2))),
                    zone3SouthWest: Math.max(0, Math.min(100, Math.round(z3))),
                    zone4SouthEast: Math.max(0, Math.min(100, Math.round(z4)))
                },
                symptoms: parsed.symptoms || "Normal leaf morphology",
                symptomsHi: parsed.symptomsHi || "पत्तियों की सामान्य संरचना",
                remedy: parsed.remedy || "Continue standard crop management",
                remedyHi: parsed.remedyHi || "नियमित फसल प्रबंधन जारी रखें",
                differentialDiagnoses: parsed.differentialDiagnoses || []
            };
        } catch (err) {
            console.warn(`[Gemini Vision Engine] Model ${modelName} failed:`, err.message);
            lastError = err;
        }
    }

    throw new Error(`Gemini Vision inference failed: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Strips markdown code blocks (```json ... ```) from model response string.
 */
function stripMarkdownFences(text) {
    if (!text) return "";
    let cleaned = text.trim();
    if (cleaned.startsWith("```json")) {
        cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith("```")) {
        cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
}

module.exports = {
    analyzeCropWithGemini,
    stripMarkdownFences
};
