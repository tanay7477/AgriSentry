/**
 * AgriSentry Farm History Database (Persistent 7-Day Storage)
 *
 * Uses resilient pure-JS file persistence to avoid C++ binary compilation crashes on cloud Linux containers.
 * Automatically saves every scan record and prunes entries older than 7 days.
 *
 * Stored per scan:
 * - Identity: id, timestamp, farmId, growthStage
 * - Disease: diseaseLabel, diseaseSeverityPercent, confidence, isHealthy
 * - Zone-wise disease: zone1-4 (NW/NE/SW/SE) disease %
 * - Zone-wise moisture: zone1-4 soil moisture %, avgMoisture
 * - Pest: pestCount, pestTrend, pestRateOfChange
 * - Health: healthScore, healthCategory
 * - Environment: ambientTempC, humidity, rainProbabilityPct
 */

const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
        console.warn('[FarmHistoryDB] Could not create data dir:', e.message);
    }
}

const DB_FILE = path.join(DATA_DIR, 'farm_history.json');
const RETENTION_DAYS = 7;

let recordsCache = [];

/**
 * Initialize storage and load existing records.
 */
function initDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const raw = fs.readFileSync(DB_FILE, 'utf8');
            recordsCache = JSON.parse(raw);
            if (!Array.isArray(recordsCache)) recordsCache = [];
        } else {
            recordsCache = [];
            fs.writeFileSync(DB_FILE, JSON.stringify(recordsCache), 'utf8');
        }
        console.log(`[FarmHistoryDB] Persistent storage initialized: ${DB_FILE} (${recordsCache.length} records loaded)`);
        return true;
    } catch (err) {
        console.warn('[FarmHistoryDB] File load error, starting with in-memory storage:', err.message);
        recordsCache = [];
        return true;
    }
}

function saveToFile() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(recordsCache, null, 2), 'utf8');
    } catch (err) {
        console.warn('[FarmHistoryDB] Failed to persist records to file:', err.message);
    }
}

/**
 * Insert a new scan record into the database.
 * Also prunes old records automatically.
 *
 * @param {Object} scanData - Full response payload + extra fields from /api/analyze
 */
function insertScanRecord(scanData) {
    try {
        const now = Date.now();
        const id = `scan_${now}_${scanData.farmId || 'unknown'}`;

        const zoneMoistures = scanData.zoneMoistures || [];
        const zone1M = findZoneMoisture(zoneMoistures, 1);
        const zone2M = findZoneMoisture(zoneMoistures, 2);
        const zone3M = findZoneMoisture(zoneMoistures, 3);
        const zone4M = findZoneMoisture(zoneMoistures, 4);
        const avgM = (zone1M + zone2M + zone3M + zone4M) > 0
            ? Math.round((zone1M + zone2M + zone3M + zone4M) / 4)
            : (scanData.avgMoisture || 0);

        const spatial = scanData.spatialZoneInfection || {};
        const sev = scanData.diseaseSeverityPercent || 0;

        const pestWarning = scanData.pestEarlyWarning || {};
        const healthIndex = scanData.fieldHealthIndex || {};
        const envRisk = scanData.environmentalRisk || {};
        const sensorTelemetry = envRisk.sensorTelemetry || {};
        const irrigation = scanData.smartIrrigation || {};
        const weatherForecast = irrigation.weatherForecast || {};

        const record = {
            id,
            timestamp: new Date(now).toISOString(),
            farmId: scanData.farmId || 'unknown',
            growthStage: scanData.growthStage || 'Vegetative',

            diseaseLabel: scanData.diseaseLabel || 'Healthy Plant',
            diseaseSeverityPercent: sev,
            confidence: scanData.confidence || 0,
            isHealthy: scanData.isHealthy ? 1 : 0,

            zone1NW_disease: spatial.zone1NorthWest ?? sev,
            zone2NE_disease: spatial.zone2NorthEast ?? sev,
            zone3SW_disease: spatial.zone3SouthWest ?? sev,
            zone4SE_disease: spatial.zone4SouthEast ?? sev,

            zone1Moisture: zone1M,
            zone2Moisture: zone2M,
            zone3Moisture: zone3M,
            zone4Moisture: zone4M,
            avgMoisture: avgM,

            pestCount: scanData.pestCount || 0,
            pestTrend: pestWarning.trend || 'STABLE',
            pestRateOfChange: pestWarning.rateOfChange || 0,

            healthScore: healthIndex.healthScore || 0,
            healthCategory: healthIndex.healthCategory || 'UNKNOWN',

            ambientTempC: sensorTelemetry.ambientTempC || 0,
            humidity: sensorTelemetry.humidityPct || 0,
            rainProbabilityPct: weatherForecast.rainProbabilityPct || 0,

            visionEngine: scanData.visionEngineUsed || 'Gemini',
            createdAt: now
        };

        // Prepend new record
        recordsCache.unshift(record);

        console.log(`[FarmHistoryDB] Scan record saved: ${id} | Farm: ${scanData.farmId} | Disease: ${scanData.diseaseLabel} (${sev}%) | Pests: ${scanData.pestCount}`);

        pruneOldRecords();
        saveToFile();
        return id;
    } catch (err) {
        console.error('[FarmHistoryDB] Failed to insert scan record:', err.message);
        return null;
    }
}

/**
 * Get scan history for a specific farm.
 *
 * @param {string} farmId
 * @param {number} days
 * @returns {Array}
 */
function getHistory(farmId, days = 7) {
    try {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        return recordsCache
            .filter(r => r.farmId === farmId && r.createdAt >= cutoff)
            .sort((a, b) => b.createdAt - a.createdAt)
            .map(formatRow);
    } catch (err) {
        console.error('[FarmHistoryDB] getHistory error:', err.message);
        return [];
    }
}

/**
 * Get scan history for ALL farms combined, grouped by farmId.
 *
 * @param {number} days
 * @returns {Object}
 */
function getAllFarmsHistory(days = 7) {
    try {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const grouped = {};
        for (const row of recordsCache) {
            if (row.createdAt >= cutoff) {
                if (!grouped[row.farmId]) grouped[row.farmId] = [];
                grouped[row.farmId].push(formatRow(row));
            }
        }
        return grouped;
    } catch (err) {
        console.error('[FarmHistoryDB] getAllFarmsHistory error:', err.message);
        return {};
    }
}

/**
 * Delete records older than RETENTION_DAYS.
 */
function pruneOldRecords() {
    try {
        const cutoff = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const prevLen = recordsCache.length;
        recordsCache = recordsCache.filter(r => r.createdAt >= cutoff);
        if (recordsCache.length < prevLen) {
            console.log(`[FarmHistoryDB] Pruned ${prevLen - recordsCache.length} records older than ${RETENTION_DAYS} days.`);
            saveToFile();
        }
    } catch (err) {
        console.error('[FarmHistoryDB] pruneOldRecords error:', err.message);
    }
}

/**
 * Get total record count in DB.
 */
function getTotalCount() {
    return recordsCache.length;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function findZoneMoisture(zoneMoistures, zoneNum) {
    if (!Array.isArray(zoneMoistures)) return 0;
    const z = zoneMoistures.find(zm => zm.zone === zoneNum);
    return z ? (z.moisture || 0) : 0;
}

function formatRow(row) {
    return {
        id: row.id,
        timestamp: row.timestamp,
        farmId: row.farmId,
        growthStage: row.growthStage,
        diseaseLabel: row.diseaseLabel,
        diseaseSeverityPercent: row.diseaseSeverityPercent,
        confidence: row.confidence,
        isHealthy: row.isHealthy === 1,
        spatialZoneInfection: {
            zone1NorthWest: row.zone1NW_disease,
            zone2NorthEast: row.zone2NE_disease,
            zone3SouthWest: row.zone3SW_disease,
            zone4SouthEast: row.zone4SE_disease
        },
        soilMoisture: {
            zone1: row.zone1Moisture,
            zone2: row.zone2Moisture,
            zone3: row.zone3Moisture,
            zone4: row.zone4Moisture,
            avg: row.avgMoisture
        },
        pestCount: row.pestCount,
        pestTrend: row.pestTrend,
        pestRateOfChange: row.pestRateOfChange,
        healthScore: row.healthScore,
        healthCategory: row.healthCategory,
        ambientTempC: row.ambientTempC,
        humidity: row.humidity,
        rainProbabilityPct: row.rainProbabilityPct,
        visionEngine: row.visionEngine
    };
}

// Auto-initialize on import
initDB();

module.exports = {
    insertScanRecord,
    getHistory,
    getAllFarmsHistory,
    pruneOldRecords,
    getTotalCount
};
