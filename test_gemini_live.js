require('dotenv').config();
const fs = require('fs');
const { analyzeCropWithGemini } = require('./geminiVisionEngine');

async function testGeminiLive() {
    console.log("=== Testing Gemini 2.5 Flash Live Multimodal Inference ===");
    console.log("GEMINI_API_KEY configured:", process.env.GEMINI_API_KEY ? "YES (masked: " + process.env.GEMINI_API_KEY.substring(0, 6) + "...)" : "NO");

    const imgBuf = fs.readFileSync('test-leaf.png');
    
    try {
        console.log("\nCalling analyzeCropWithGemini for test-leaf.png...");
        const result = await analyzeCropWithGemini(imgBuf, 'image/png', 'field_alpha', 'Vegetative');
        console.log("\n[SUCCESS] Gemini Vision Response:");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("\n[ERROR] Gemini Vision failed:", err.message);
    }
}

testGeminiLive();
