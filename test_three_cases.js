const fs = require('fs');
const path = require('path');

async function runThreeCaseValidation() {
    console.log("=== AgriSentry Section 6 Three-Case Test Validation ===\n");

    const imgPath = path.join(__dirname, 'test-leaf.png');
    const buffer = fs.readFileSync(imgPath);

    const testCases = [
        {
            name: "Test Case 1: Tomato Leaf Field Photo (Field Alpha)",
            farmId: "field_alpha",
            growthStage: "Flowering",
            pestCount: 14
        },
        {
            name: "Test Case 2: Potato Tuber Foliage (Field Beta)",
            farmId: "field_beta",
            growthStage: "Tuber Bulking",
            pestCount: 22
        },
        {
            name: "Test Case 3: Capsicum & Chili Greenhouse (Field Gamma)",
            farmId: "field_gamma",
            growthStage: "Vegetative",
            pestCount: 8
        }
    ];

    for (const tc of testCases) {
        console.log(`-----------------------------------------------------`);
        console.log(`Executing: ${tc.name}`);
        const blob = new Blob([buffer], { type: 'image/png' });
        const formData = new FormData();
        formData.append('image', blob, 'leaf_sample.png');
        formData.append('farmId', tc.farmId);
        formData.append('growthStage', tc.growthStage);
        formData.append('pestCount', tc.pestCount.toString());

        try {
            const resp = await fetch('http://localhost:5000/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await resp.json();
            console.log(`[HTTP ${resp.status}] Engine: ${data.visionEngineUsed}`);
            console.log(`  - Crop: ${data.appliedCropContext}`);
            console.log(`  - Disease Label: ${data.diseaseLabel}`);
            console.log(`  - Confidence: ${(data.confidence * 100).toFixed(1)}%`);
            console.log(`  - Severity: ${data.diseaseSeverityPercent}%`);
            console.log(`  - NPK Status: ${data.nutrientAnalysis?.primaryDeficiency}`);
            console.log(`  - Field Health Score: ${data.fieldHealthIndex?.healthScore} / 100`);
            console.log(`  - Decision Action: ${data.decision?.actionRecommendation}`);
        } catch (e) {
            console.error(`  - Failed: ${e.message}`);
        }
    }
    console.log(`-----------------------------------------------------\n`);
}

runThreeCaseValidation();
