require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const testModels = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-flash-image'
];

async function checkModels() {
    for (const m of testModels) {
        console.log(`Testing model: ${m}...`);
        try {
            const resp = await ai.models.generateContent({
                model: m,
                contents: 'Hello, reply with OK if alive.'
            });
            console.log(`>>> [SUCCESS] Model "${m}" responded:`, resp.text?.trim());
            return m;
        } catch (e) {
            console.log(`[FAILED] ${m}:`, e.message);
        }
    }
}

checkModels();
