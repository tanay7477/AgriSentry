require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
    try {
        console.log("Listing available models for this API key...");
        const response = await ai.models.list();
        for await (const m of response) {
            console.log(`- Name: ${m.name} | Display: ${m.displayName} | Supported: ${m.supportedGenerationMethods?.join(', ')}`);
        }
    } catch (e) {
        console.error("List error:", e.message);
    }
}

listModels();
