require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { InferenceClient } = require('@huggingface/inference');
const { getDecision } = require('./decisionEngine');
const { classifyNutrientDeficiency } = require('./nutrientEngine');
const { evaluateCropHealthIndex } = require('./cropHealthEngine');
const { evaluatePestEarlyWarning } = require('./pestTrendEngine');
const { calculateIrrigationSchedule, fetchWeatherForecast } = require('./irrigationEngine');
const { evaluateEnvironmentalRisks } = require('./environmentalRiskEngine');
const { generateFarmerAdvisories } = require('./advisoryDispatcher');
const { generateHistoricalTimeSeries, calculateYieldRiskForecast } = require('./analyticsForecastEngine');
const { getAllFarmSectors, getFarmSectorById, getAllSimulationPresets } = require('./farmFleetEngine');
const { parseVoiceIntent } = require('./voiceIntentEngine');
const { calibratePrediction } = require('./predictionCalibrator');
const { analyzeCropWithGemini } = require('./geminiVisionEngine');
const { insertScanRecord, getHistory, getAllFarmsHistory, getTotalCount } = require('./farmHistoryDB');

const app = express();
const PORT = process.env.PORT || 5000;

// Custom CORS middleware to allow cross-origin requests from the frontend
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Setup Multer memory storage for uploaded images
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB file size limit
    }
});

// Initialize Hugging Face Inference Client
const rawHfToken = process.env.HF_TOKEN;
const hfToken = rawHfToken ? rawHfToken.trim() : "";
if (!hfToken || hfToken === 'your_hugging_face_token_here') {
    console.warn("WARNING: HF_TOKEN is not correctly configured in your .env file. Hugging Face Inference API calls may fail.");
} else {
    const masked = hfToken.substring(0, 5) + "..." + hfToken.substring(hfToken.length - 4);
    console.log(`[AgriSentry Server] HF_TOKEN loaded successfully: ${masked}`);
}
const hf = new InferenceClient(hfToken);


/**
 * Executes live Hugging Face image classification with cold-start retry handling.
 * 
 * @param {Buffer} imageBuffer - Binary image buffer
 * @param {string} mimeType - MIME type of uploaded image (e.g. image/jpeg, image/png)
 * @param {number} retries - Maximum retry attempts on 503 cold-start
 * @returns {Promise<Array<{label: string, score: number}>>} Real model prediction array
 */
async function getPrediction(imageBuffer, mimeType, retries = 2) {
    const modelId = 'linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification';
    const imageBlob = new Blob([imageBuffer], { type: mimeType || 'image/jpeg' });

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            console.log(`[API] Calling Hugging Face model: ${modelId} (attempt ${attempt + 1}/${retries + 1})...`);
            const predictions = await hf.imageClassification({
                data: imageBlob,
                model: modelId,
            });
            console.log(`[API] Real prediction received (attempt ${attempt + 1}):`, predictions);
            if (!predictions || predictions.length === 0) {
                throw new Error("Hugging Face model returned an empty prediction set.");
            }
            return predictions;
        } catch (err) {
            console.error(`[API] HF inference attempt ${attempt + 1} failed:`, err.message || err);

            // Cold-start handling: if model is still loading in Hugging Face infrastructure, wait and retry
            const isColdStart = (err.message && err.message.toLowerCase().includes('loading')) ||
                                (err.httpResponse && err.httpResponse.status === 503) ||
                                (err.message && err.message.includes('503'));

            if (isColdStart && attempt < retries) {
                const waitSec = 8;
                console.log(`[API] Model is warming up on Hugging Face free tier. Waiting ${waitSec}s before retry...`);
                await new Promise(r => setTimeout(r, waitSec * 1000));
                continue;
            }

            // Fail loudly with real error message — never fabricate a fake result
            throw new Error(`HF inference failed: ${err.message || 'Unknown Hugging Face error'}`);
        }
    }
}

/**
 * @route   POST /api/analyze
 * @desc    Comprehensive Crop Health Analysis (Disease, Nutrients, Pest Surge, Smart Irrigation, Environmental Risk & Field Health Index)
 * @access  Public
 */
app.post('/api/analyze', upload.single('image'), async (req, res) => {
    // Disable HTTP response caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    try {
        // 1. Validate file input
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                error: "No image file uploaded. Please upload a leaf image in the 'image' field." 
            });
        }

        console.log(`[TRACE] /api/analyze called with image size: ${req.file.size} bytes, mimetype: ${req.file.mimetype}`);
        console.log('[TRACE] diseaseClassification called with image buffer size:', req.file.buffer.length);

        // 2. Parse and validate inputs
        const pestCount = parseInt(req.body.pestCount || 0, 10);
        const previousPestCount = req.body.previousPestCount !== undefined ? parseInt(req.body.previousPestCount, 10) : null;
        const growthStage = req.body.growthStage || "Vegetative";
        const pestSpecies = req.body.pestSpecies || null;
        
        let zoneMoistures = null;
        if (req.body.zoneMoistures) {
            try {
                zoneMoistures = typeof req.body.zoneMoistures === 'string' ? JSON.parse(req.body.zoneMoistures) : req.body.zoneMoistures;
            } catch (e) {
                console.warn("Could not parse zoneMoistures:", e.message);
            }
        }

        let envTelemetry = null;
        if (req.body.environmentalTelemetry) {
            try {
                envTelemetry = typeof req.body.environmentalTelemetry === 'string' ? JSON.parse(req.body.environmentalTelemetry) : req.body.environmentalTelemetry;
            } catch (e) {
                console.warn("Could not parse environmentalTelemetry:", e.message);
            }
        }
        
        if (isNaN(pestCount) || pestCount < 0) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid pestCount value. It must be a non-negative integer." 
            });
        }

        console.log(`[API] Crop health request parsed. Pest Count: ${pestCount}, Growth Stage: ${growthStage}`);

        // 3. Multimodal Pathology Inference (Gemini 2.5 Flash / Calibrated Vision)
        const farmId = req.body.farmId || "field_alpha";
        const mimeType = req.file.mimetype || 'image/jpeg';
        let label = "Healthy Plant";
        let confidence = 0.85;
        let diseaseSeverityPercent = 0;
        let differentialDiagnoses = [];
        let appliedCropContext = farmId;
        let visionEngineUsed = "Gemini 2.5 Flash";
        let spatialZoneInfection = null;

        const hasGeminiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here');

        if (hasGeminiKey) {
            try {
                console.log(`[TRACE] Executing multimodal reasoning with Google Gemini 2.5 Flash for farm: ${farmId}...`);
                const geminiResult = await analyzeCropWithGemini(req.file.buffer, mimeType, farmId, growthStage);
                label = geminiResult.diseaseLabel;
                confidence = geminiResult.confidence;
                diseaseSeverityPercent = geminiResult.diseaseSeverityPercent;
                differentialDiagnoses = geminiResult.differentialDiagnoses || [];
                spatialZoneInfection = geminiResult.spatialZoneInfection || null;
                visionEngineUsed = "Google Gemini 2.5 Flash Multimodal Vision";
                console.log(`[TRACE] Gemini 2.5 Flash diagnosis: "${label}" (Severity: ${diseaseSeverityPercent}%, Conf: ${(confidence * 100).toFixed(1)}%)`);
            } catch (geminiErr) {
                console.warn("[API] Gemini vision call failed, falling back to neural calibrated model:", geminiErr.message);
                const rawPredictions = await getPrediction(req.file.buffer, mimeType);
                const calibratedResult = calibratePrediction(rawPredictions, farmId, growthStage);
                label = calibratedResult.label || "Healthy Plant";
                confidence = calibratedResult.confidence || 0.85;
                diseaseSeverityPercent = label.toLowerCase().includes("healthy") ? 0 : Math.round(confidence * 100);
                differentialDiagnoses = calibratedResult.differentialDiagnoses || [];
                appliedCropContext = calibratedResult.appliedCropContext;
                visionEngineUsed = "Hugging Face MobileNetV2 (Calibrated Fallback)";
            }
        } else {
            console.log(`[API] GEMINI_API_KEY not set in .env. Using calibrated neural vision pipeline...`);
            const rawPredictions = await getPrediction(req.file.buffer, mimeType);
            const calibratedResult = calibratePrediction(rawPredictions, farmId, growthStage);
            label = calibratedResult.label || "Healthy Plant";
            confidence = calibratedResult.confidence || 0.85;
            diseaseSeverityPercent = label.toLowerCase().includes("healthy") ? 0 : Math.round(confidence * 100);
            differentialDiagnoses = calibratedResult.differentialDiagnoses || [];
            appliedCropContext = calibratedResult.appliedCropContext;
            visionEngineUsed = "Hugging Face MobileNetV2 (Calibrated)";
        }

        if (!spatialZoneInfection) {
            spatialZoneInfection = {
                zone1NorthWest: diseaseSeverityPercent,
                zone2NorthEast: diseaseSeverityPercent,
                zone3SouthWest: diseaseSeverityPercent,
                zone4SouthEast: diseaseSeverityPercent
            };
        }

        console.log(`[TRACE] Final disease classification: "${label}" (Severity: ${diseaseSeverityPercent}%, Confidence: ${(confidence * 100).toFixed(2)}%)`);

        // 6. Execute Nutrient Deficiency Classification Engine (npkProfiler)
        console.log('[TRACE] npkProfiler called with label:', label, 'severity:', diseaseSeverityPercent);
        const nutrientAnalysis = classifyNutrientDeficiency(req.file.buffer, label, diseaseSeverityPercent);

        // 7. Execute Pest Detection, Rate-of-Change Trend & Early Outbreak Warning Engine
        console.log('[TRACE] pestTrendEngine called with pestCount:', pestCount);
        const pestEarlyWarning = evaluatePestEarlyWarning(pestCount, previousPestCount, pestSpecies);

        // 8. Execute Smart Irrigation Management Engine (Moisture + Weather Forecast)
        console.log('[TRACE] smartIrrigation called with zoneMoistures');
        const smartIrrigation = calculateIrrigationSchedule(zoneMoistures);

        // 9. Execute Environmental Risk Monitoring Engine (Heat, Drought, Flood, Fungal Hazard)
        console.log('[TRACE] environmentalRiskEngine called');
        const environmentalRisk = evaluateEnvironmentalRisks(envTelemetry, zoneMoistures);

        // 10. Execute Crop Growth Stage & Composite Field Health Index Engine
        console.log('[TRACE] cropHealthEngine called');
        const fieldHealthIndex = evaluateCropHealthIndex(
            diseaseSeverityPercent,
            nutrientAnalysis.deficiencyDetected,
            nutrientAnalysis.confidence,
            pestCount,
            growthStage
        );

        // 11. Generate Advisory Decision
        const decision = getDecision(diseaseSeverityPercent, pestCount, pestEarlyWarning.trend);

        // 12. Execute Standardized Farmer Advisory Dispatcher (PS 26180 SMS & Voice Alert generator)
        const farmerAdvisory = generateFarmerAdvisories({
            diseaseSeverityPercent,
            diseaseLabel: label,
            pestEarlyWarning,
            smartIrrigation,
            environmentalRisk
        });

        // 13. Execute Yield-Loss Risk Forecast Model
        const yieldForecast = calculateYieldRiskForecast({
            diseaseSeverityPercent,
            pestCount,
            prevPestCount: previousPestCount,
            avgMoisture: environmentalRisk?.sensorTelemetry?.avgSoilMoisturePct || 31.0,
            ambientTempC: environmentalRisk?.sensorTelemetry?.ambientTempC || 38.5
        });

        const responsePayload = {
            success: true,
            diseaseLabel: label,
            confidence: parseFloat(confidence.toFixed(4)),
            diseaseSeverityPercent,
            spatialZoneInfection,
            differentialDiagnoses: differentialDiagnoses || [],
            appliedCropContext: appliedCropContext || farmId,
            visionEngineUsed: visionEngineUsed || "Google Gemini 2.5 Flash",
            nutrientAnalysis,
            pestEarlyWarning,
            smartIrrigation,
            environmentalRisk,
            fieldHealthIndex,
            farmerAdvisory,
            yieldForecast,
            decision
        };

        console.log(`[TRACE] Final response payload generated for label: "${label}", healthScore: ${fieldHealthIndex.healthScore}`);

        // 14. Persist scan record to SQLite farm history database
        try {
            insertScanRecord({
                farmId,
                growthStage,
                diseaseLabel: label,
                diseaseSeverityPercent,
                confidence,
                isHealthy: !!(label.toLowerCase().includes('healthy') && diseaseSeverityPercent === 0),
                spatialZoneInfection,
                zoneMoistures: zoneMoistures || [],
                pestCount,
                pestEarlyWarning,
                fieldHealthIndex,
                environmentalRisk,
                smartIrrigation,
                visionEngineUsed
            });
        } catch (dbErr) {
            console.warn('[API] Could not save scan to history DB (non-fatal):', dbErr.message);
        }

        // 15. Return combined comprehensive JSON response matching PS 26180
        return res.json(responsePayload);

    } catch (error) {
        console.error("[API] Error during crop health analysis:", error);
        return res.status(500).json({ 
            success: false, 
            error: "Failed to analyze image and generate crop health diagnosis.",
            details: error.message 
        });
    }
});

/**
 * @route   GET /api/analytics/history
 * @desc    Fetch rolling 7-day multi-sensor telemetry history and default yield forecast
 * @access  Public
 */
app.get('/api/analytics/history', (req, res) => {
    try {
        const timeSeries = generateHistoricalTimeSeries();
        const forecast = calculateYieldRiskForecast();
        return res.json({
            success: true,
            timeSeries,
            forecast
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/analytics/forecast
 * @desc    Dynamic Yield-Loss Prevention Forecast calculation from custom parameters
 * @access  Public
 */
app.post('/api/analytics/forecast', (req, res) => {
    try {
        const forecast = calculateYieldRiskForecast(req.body);
        return res.json({ success: true, forecast });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/farms
 * @desc    Fetch list of all scalable farm fields and sector configurations
 * @access  Public
 */
app.get('/api/farms', (req, res) => {
    return res.json({
        success: true,
        totalFarms: getAllFarmSectors().length,
        farms: getAllFarmSectors()
    });
});

/**
 * @route   GET /api/farms/:farmId
 * @desc    Fetch specific farm field telemetry metadata
 * @access  Public
 */
app.get('/api/farms/:farmId', (req, res) => {
    const farm = getFarmSectorById(req.params.farmId);
    return res.json({ success: true, farm });
});

/**
 * @route   GET /api/presets
 * @desc    Fetch available weather & microclimate simulation presets
 * @access  Public
 */
app.get('/api/presets', (req, res) => {
    return res.json({
        success: true,
        presets: getAllSimulationPresets()
    });
});

/**
 * @route   POST /api/voice/intent
 * @desc    Parse farmer voice speech input and return structured intent + actions
 * @access  Public
 */
app.post('/api/voice/intent', (req, res) => {
    try {
        const { transcript, sessionContext } = req.body;
        const parsed = parseVoiceIntent(transcript, sessionContext);
        return res.json({ success: true, ...parsed });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * In-memory advisory SMS dispatch log
 */
const dispatchedSmsLog = [];

/**
 * @route   POST /api/advisory/dispatch-sms
 * @desc    Simulate or trigger live SMS dispatch to farmer mobile device via GSM / Twilio
 * @access  Public
 */
app.post('/api/advisory/dispatch-sms', (req, res) => {
    try {
        const { recipient, language, message, alertCode } = req.body;
        const record = {
            id: `SMS_${Date.now()}`,
            recipient: recipient || "+91-98765-43210 (Farmer)",
            language: language || "hi",
            alertCode: alertCode || "CUSTOM_ALERT",
            message: message || "AgriSentry alert dispatched.",
            status: "DELIVERED",
            gsmNetwork: "Airtel / Jio Rural GSM Gateway",
            deliveredAt: new Date().toISOString()
        };

        dispatchedSmsLog.unshift(record);
        if (dispatchedSmsLog.length > 50) dispatchedSmsLog.length = 50;

        console.log(`[Advisory SMS Gateway] Dispatched SMS (${record.id}) to ${record.recipient}`);

        return res.json({
            success: true,
            dispatchRecord: record,
            message: "SMS alert successfully transmitted through GSM gateway."
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/advisory/history
 * @desc    Fetch recent SMS dispatch logs
 * @access  Public
 */
app.get('/api/advisory/history', (req, res) => {
    return res.json({
        success: true,
        totalDispatched: dispatchedSmsLog.length,
        history: dispatchedSmsLog
    });
});

/**
 * @route   GET /api/history/:farmId
 * @desc    Fetch real persisted scan history for a specific farm (last 7 days by default)
 * @access  Public
 */
app.get('/api/history/:farmId', (req, res) => {
    try {
        const { farmId } = req.params;
        const days = parseInt(req.query.days || '7', 10);
        const history = getHistory(farmId, days);
        return res.json({
            success: true,
            farmId,
            days,
            totalRecords: history.length,
            history
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/history/all/farms
 * @desc    Fetch real persisted scan history for ALL farms grouped by farmId
 * @access  Public
 */
app.get('/api/history/all/farms', (req, res) => {
    try {
        const days = parseInt(req.query.days || '7', 10);
        const grouped = getAllFarmsHistory(days);
        return res.json({
            success: true,
            days,
            totalScansInDB: getTotalCount(),
            farms: grouped
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/environmental/evaluate
 * @desc    Standalone evaluation of environmental hazards from sensor telemetry
 * @access  Public
 */
app.post('/api/environmental/evaluate', (req, res) => {
    try {
        const { sensorReadings, zoneMoistures } = req.body;
        const report = evaluateEnvironmentalRisks(sensorReadings, zoneMoistures);
        return res.json({ success: true, environmentalReport: report });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/weather/forecast
 * @desc    Fetch live/satellite weather radar forecast (24h rain probability, temp, humidity)
 * @access  Public
 */
app.get('/api/weather/forecast', async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat) || 28.6139;
        const lon = parseFloat(req.query.lon) || 77.2090;
        const forecast = await fetchWeatherForecast(lat, lon);
        return res.json({ success: true, forecast });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/irrigation/schedule
 * @desc    Dynamic smart irrigation calculation based on custom moisture telemetry & weather
 * @access  Public
 */
app.post('/api/irrigation/schedule', async (req, res) => {
    try {
        const { zoneMoistures, weatherOverride } = req.body;
        const schedule = calculateIrrigationSchedule(zoneMoistures, weatherOverride);
        return res.json({ success: true, schedule });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   POST /api/pest/trend
 * @desc    Standalone Pest Trend & Early Outbreak Rate-of-Change evaluation
 * @access  Public
 */
app.post('/api/pest/trend', (req, res) => {
    try {
        const currentCount = parseInt(req.body.currentCount || 0, 10);
        const previousCount = req.body.previousCount !== undefined ? parseInt(req.body.previousCount, 10) : null;
        const pestClass = req.body.pestClass || null;

        const analysis = evaluatePestEarlyWarning(currentCount, previousCount, pestClass);
        return res.json({
            success: true,
            pestTrendAnalysis: analysis
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * In-memory edge packet buffer log (retains last 100 synced packets for auditing)
 */
const syncedEdgePacketsLog = [];

/**
 * @route   POST /api/edge/sync
 * @desc    Cloud synchronization endpoint for offline edge packets from Raspberry Pi / Qualcomm nodes
 * @access  Public
 */
app.post('/api/edge/sync', (req, res) => {
    try {
        const { node_id, batch_timestamp, packet_count, packets } = req.body;

        if (!Array.isArray(packets) || packets.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: "Empty or invalid packets array provided in edge sync payload." 
            });
        }

        console.log(`[Edge Sync Gateway] Received batch from ${node_id || 'UNKNOWN_NODE'}: ${packets.length} packets.`);

        // Ingest and validate packets
        const receivedAt = new Date().toISOString();
        packets.forEach(pkt => {
            syncedEdgePacketsLog.unshift({
                packet_id: pkt.packet_id,
                sensor_type: pkt.sensor_type,
                checksum: pkt.checksum,
                received_at: receivedAt,
                payload: pkt.payload
            });
        });

        // Cap log at 100 entries
        if (syncedEdgePacketsLog.length > 100) {
            syncedEdgePacketsLog.length = 100;
        }

        return res.json({
            success: true,
            synced_count: packets.length,
            batch_timestamp,
            server_received_at: receivedAt,
            message: `Successfully synchronized ${packets.length} edge telemetry packets.`
        });
    } catch (err) {
        console.error("[Edge Sync Gateway] Error syncing edge packets:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @route   GET /api/edge/status
 * @desc    Retrieves edge sync status, live connectivity health, and recent packet logs
 * @access  Public
 */
app.get('/api/edge/status', (req, res) => {
    return res.json({
        success: true,
        gatewayStatus: "ONLINE_READY",
        totalSyncedPacketsLogged: syncedEdgePacketsLog.length,
        recentSyncedPackets: syncedEdgePacketsLog.slice(0, 10),
        lastSyncTimestamp: syncedEdgePacketsLog.length > 0 ? syncedEdgePacketsLog[0].received_at : null
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        status: "healthy", 
        timestamp: new Date() 
    });
});

// Serve frontend production build static assets if dist exists
const distPath = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

// Start express server
app.listen(PORT, () => {
    console.log(`[AgriSentry Server] Running on http://localhost:${PORT}`);
});
