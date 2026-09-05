require('dotenv').config();
const fs = require('fs');
const { InferenceClient } = require('@huggingface/inference');

const token = process.env.HF_TOKEN ? process.env.HF_TOKEN.trim() : "";
const hf = new InferenceClient(token);

const candidates = [
    'gianlab/swin-tiny-patch4-window7-224-finetuned-plantdisease',
    'SanketJadhav/PlantDiseaseClassifier-Resnet50',
    'AishaKanwal/ModelsViT_PlantDisease',
    'NouRed/recognize-plant-diseases-vit',
    'A2H0H0R1/swin-tiny-patch4-window7-224-plant-diseases',
    'linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification'
];

async function runTest() {
    const imgBuf = fs.readFileSync('test-leaf.png');
    const blob = new Blob([imgBuf], { type: 'image/png' });

    console.log("Testing candidate plant disease models on Hugging Face...\n");

    for (const modelId of candidates) {
        console.log(`Checking: ${modelId}`);
        try {
            const start = Date.now();
            const res = await hf.imageClassification({
                data: blob,
                model: modelId
            });
            console.log(`[WORKING] (${Date.now() - start}ms)`);
            if (Array.isArray(res)) {
                res.slice(0, 3).forEach((p, idx) => {
                    console.log(`  ${idx + 1}. "${p.label}" : ${(p.score * 100).toFixed(2)}%`);
                });
            }
        } catch (e) {
            console.log(`[FAILED]: ${e.message}`);
        }
        console.log("-----------------------------------------");
    }
}

runTest();
