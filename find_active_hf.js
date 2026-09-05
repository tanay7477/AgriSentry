require('dotenv').config();
const fs = require('fs');
const { InferenceClient } = require('@huggingface/inference');

const token = process.env.HF_TOKEN ? process.env.HF_TOKEN.trim() : "";
const hf = new InferenceClient(token);

async function findWorkingModels() {
    const resp = await fetch('https://huggingface.co/api/models?search=disease&filter=image-classification&limit=100');
    const list = await resp.json();
    console.log(`Checking ${list.length} models for active inference providers...`);

    const imgBuf = fs.readFileSync('test-leaf.png');
    const blob = new Blob([imgBuf], { type: 'image/png' });

    for (const m of list) {
        try {
            const res = await hf.imageClassification({
                data: blob,
                model: m.id
            });
            console.log(`>>> FOUND ACTIVE MODEL: ${m.id}`);
            if (Array.isArray(res) && res.length > 0) {
                console.log(`    Top prediction: "${res[0].label}" (Score: ${(res[0].score * 100).toFixed(2)}%)`);
            }
        } catch (e) {
            // Not active
        }
    }
    console.log("Check complete.");
}

findWorkingModels();
