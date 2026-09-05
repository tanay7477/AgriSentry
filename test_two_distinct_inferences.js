const fs = require('fs');
const path = require('path');

async function testInference() {
    console.log("=== AgriSentry Dynamic ML Inference & Trace Verification ===");

    const img1Path = path.join(__dirname, 'test-leaf.png');
    const img2Path = path.join(__dirname, 'test-leaf-2.png');

    const testCases = [
        { name: "Image 1 (test-leaf.png)", path: img1Path, mime: 'image/png' },
        { name: "Image 2 (test-leaf-2.png)", path: img2Path, mime: 'image/png' }
    ];

    for (const tc of testCases) {
        console.log(`\n--> Submitting ${tc.name} (${fs.statSync(tc.path).size} bytes)...`);
        const buffer = fs.readFileSync(tc.path);
        const blob = new Blob([buffer], { type: tc.mime });

        const formData = new FormData();
        formData.append('image', blob, path.basename(tc.path));
        formData.append('pestCount', '18');
        formData.append('growthStage', 'Flowering');

        try {
            const resp = await fetch('http://localhost:5000/api/analyze', {
                method: 'POST',
                body: formData
            });

            const data = await resp.json();
            console.log(`Status: ${resp.status} ${resp.statusText}`);
            console.log("Cache-Control header:", resp.headers.get('cache-control'));
            console.log("Returned Disease Label:", data.diseaseLabel);
            console.log("Confidence Score:", data.confidence);
            console.log("Nutrient Primary:", data.nutrientAnalysis?.primaryDeficiency);
            console.log("Field Health Score:", data.fieldHealthIndex?.healthScore);
            console.log("Action Recommendation:", data.decision?.actionRecommendation);
            console.log("Farmer Advisory (Hi):", data.farmerAdvisory?.voice?.textHi);
        } catch (err) {
            console.error("Error testing:", err.message);
        }
    }
}

testInference();
