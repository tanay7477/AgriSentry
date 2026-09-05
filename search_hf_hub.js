async function findServerlessModels() {
    console.log("Searching Hugging Face Hub for active serverless plant disease models...");
    try {
        const resp = await fetch('https://huggingface.co/api/models?search=plant%20disease&filter=image-classification&limit=50&full=true');
        const models = await resp.json();
        console.log(`Found ${models.length} candidate models.`);
        
        const valid = models.filter(m => m.id && !m.private && m.pipeline_tag === 'image-classification');
        console.log("Top candidate models:");
        valid.slice(0, 15).forEach(m => {
            console.log(`- ${m.id} (downloads: ${m.downloads || 0}, likes: ${m.likes || 0})`);
        });
    } catch (e) {
        console.error("Error:", e.message);
    }
}
findServerlessModels();
