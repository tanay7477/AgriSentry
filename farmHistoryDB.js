/**
 * AgriSentry Farm History Database (Persistent 7-Day Storage)
 *
 * Uses better-sqlite3 for zero-config local SQLite storage.
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

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'farm_history.sqlite');
const RETENTION_DAYS = 7;

let db;

/**
 * Initialize SQLite database and create table if not exists.
 */
function initDB() {
    try {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');

        db.exec(`
            CREATE TABLE IF NOT EXISTS farm_scan_history (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                farmId TEXT NOT NULL,
                growthStage TEXT,

                diseaseLabel TEXT,
                diseaseSeverityPercent REAL DEFAULT 0,
                confidence REAL DEFAULT 0,
                isHealthy INTEGER DEFAULT 1,

                zone1NW_disease REAL DEFAULT 0,
                zone2NE_disease REAL DEFAULT 0,
                zone3SW_disease REAL DEFAULT 0,
                zone4SE_disease REAL DEFAULT 0,

                zone1Moisture REAL DEFAULT 0,
                zone2Moisture REAL DEFAULT 0,
                zone3Moisture REAL DEFAULT 0,
                zone4Moisture REAL DEFAULT 0,
                avgMoisture REAL DEFAULT 0,

                pestCount INTEGER DEFAULT 0,
                pestTrend TEXT DEFAULT 'STABLE',
                pestRateOfChange REAL DEFAULT 0,

                healthScore INTEGER DEFAULT 0,
                healthCategory TEXT DEFAULT 'UNKNOWN',

                ambientTempC REAL DEFAULT 0,
                humidity REAL DEFAULT 0,
                rainProbabilityPct REAL DEFAULT 0,

                visionEngine TEXT DEFAULT 'Gemini',
                createdAt INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_farmId ON farm_scan_history(farmId);
            CREATE INDEX IF NOT EXISTS idx_createdAt ON farm_scan_history(createdAt);
        `);

        console.log(`[FarmHistoryDB] SQLite database initialized: ${DB_PATH}`);
        return true;
    } catch (err) {
        console.error('[FarmHistoryDB] Failed to initialize database:', err.message);
        return false;
    }
}

/**
 * Insert a new scan record into the database.
 * Also prunes old records automatically.
 *
 * @param {Object} scanData - Full response payload + extra fields from /api/analyze
 */
function insertScanRecord(scanData) {
    if (!db) {
        console.warn('[FarmHistoryDB] DB not initialized. Skipping record insert.');
        return null;
    }

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

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO farm_scan_history (
                id, timestamp, farmId, growthStage,
                diseaseLabel, diseaseSeverityPercent, confidence, isHealthy,
                zone1NW_disease, zone2NE_disease, zone3SW_disease, zone4SE_disease,
                zone1Moisture, zone2Moisture, zone3Moisture, zone4Moisture, avgMoisture,
                pestCount, pestTrend, pestRateOfChange,
                healthScore, healthCategory,
                ambientTempC, humidity, rainProbabilityPct,
                visionEngine, createdAt
            ) VALUES (
                @id, @timestamp, @farmId, @growthStage,
                @diseaseLabel, @diseaseSeverityPercent, @confidence, @isHealthy,
                @zone1NW_disease, @zone2NE_disease, @zone3SW_disease, @zone4SE_disease,
                @zone1Moisture, @zone2Moisture, @zone3Moisture, @zone4Moisture, @avgMoisture,
                @pestCount, @pestTrend, @pestRateOfChange,
                @healthScore, @healthCategory,
                @ambientTempC, @humidity, @rainProbabilityPct,
                @visionEngine, @createdAt
            )
        `);

        stmt.run({
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
        });

        console.log(`[FarmHistoryDB] Scan record saved: ${id} | Farm: ${scanData.farmId} | Disease: ${scanData.diseaseLabel} (${sev}%) | Pests: ${scanData.pestCount}`);

        pruneOldRecords();
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
    if (!db) return [];
    try {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const rows = db.prepare(`
            SELECT * FROM farm_scan_history
            WHERE farmId = ? AND createdAt >= ?
            ORDER BY createdAt DESC
        `).all(farmId, cutoff);
        return rows.map(formatRow);
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
    if (!db) return {};
    try {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const rows = db.prepare(`
            SELECT * FROM farm_scan_history
            WHERE createdAt >= ?
            ORDER BY farmId ASC, createdAt DESC
        `).all(cutoff);

        const grouped = {};
        for (const row of rows) {
            if (!grouped[row.farmId]) grouped[row.farmId] = [];
            grouped[row.farmId].push(formatRow(row));
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
    if (!db) return;
    try {
        const cutoff = Date.now() - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const result = db.prepare('DELETE FROM farm_scan_history WHERE createdAt < ?').run(cutoff);
        if (result.changes > 0) {
            console.log(`[FarmHistoryDB] Pruned ${result.changes} records older than ${RETENTION_DAYS} days.`);
        }
    } catch (err) {
        console.error('[FarmHistoryDB] pruneOldRecords error:', err.message);
    }
}

/**
 * Get total record count in DB.
 */
function getTotalCount() {
    if (!db) return 0;
    try {
        return db.prepare('SELECT COUNT(*) as cnt FROM farm_scan_history').get()?.cnt || 0;
    } catch {
        return 0;
    }
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
