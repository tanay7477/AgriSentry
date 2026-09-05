const fs = require('fs');
const path = require('path');

async function testComprehensiveDiagnostics() {
    console.log("=== AgriSentry Vision & Diagnostic Validation ===");

    const img1Path = path.join(__dirname, 'test-leaf.png');
    const buffer = fs.readFileSync(img1Path);
    const blob = new Blob([buffer], { type: 'image/png' });

    const formData = new FormData();
    formData.append('image', blob, 'test-leaf.png');
    formData.append('farmId', 'field_alpha');
    formData.append('growthStage', 'Flowering');
    formData.append('pestCount', '14');

    try {
        const resp = await fetch('http://localhost:5000/api/analyze', {
            method: 'POST',
            body: formData
        });

        const data = await resp.json();
        console.log("HTTP Status:", resp.status);
        console.log("Vision Engine:", data.visionEngineUsed);
        console.log("Active Crop Context:", data.appliedCropContext);
        console.log("Disease Label:", data.diseaseLabel);
        console.log("Confidence:", (data.confidence * 100).toFixed(1) + "%");
        console.log("Disease Severity:", data.diseaseSeverityPercent + "%");
        console.log("NPK Primary Deficiency:", data.nutrientAnalysis?.primaryDeficiency);
        console.log("Field Health Score:", data.fieldHealthIndex?.healthScore + " / 100");
        console.log("Differential Diagnoses:", data.differentialDiagnoses);
        console.log("Decision Action:", data.decision?.actionRecommendation);
        console.log("Advisory (Hindi):", data.farmerAdvisory?.voice?.textHi?.substring(0, 100) + "...");
    } catch (e) {
        console.error("Test Error:", e.message);
    }
}

testComprehensiveDiagnostics();
