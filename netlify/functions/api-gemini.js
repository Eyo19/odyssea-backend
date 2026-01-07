// netlify/functions/api-gemini.js
export const handler = async (event) => {
  try {
    // 1. Sécurité et Parsing
    if (!event.body) {
        return { statusCode: 400, body: JSON.stringify({ error: "Pas de données envoyées" }) };
    }
    const body = JSON.parse(event.body);
    const userMessage = body.message || "Bonjour";
    const promptSysteme = body.systemPrompt || "Tu es un assistant utile.";
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: "Clé API manquante sur le serveur" }) };
    }

    // --- FONCTION D'APPEL ---
    // Cette fonction permet d'essayer plusieurs modèles différents
    async function callGemini(modelName) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: promptSysteme + "\n\n" + userMessage }] 
                }]
            }),
        });
        return await response.json();
    }

    // --- TENTATIVE 1 : Le modèle moderne (Flash) ---
    console.log("Tentative avec gemini-1.5-flash...");
    let data = await callGemini("gemini-1.5-flash");

    // Si erreur "Not Found" ou autre, on passe au plan B
    if (data.error) {
        console.log("Échec Flash, tentative avec gemini-pro (Plan B)...");
        console.log("Erreur reçue : ", data.error.message);
        
        // --- TENTATIVE 2 : Le modèle classique (Pro) ---
        data = await callGemini("gemini-pro");
    }

    // --- RÉSULTAT FINAL ---
    if (data.error) {
        // Si les deux ont échoué, on renvoie l'erreur
        return { statusCode: 500, body: JSON.stringify({ error: "Tous les modèles ont échoué. " + data.error.message }) };
    }

    const aiText = data.candidates[0].content.parts[0].text;
    return {
        statusCode: 200,
        body: JSON.stringify({ reply: aiText }),
    };

  } catch (error) {
    console.error("Erreur Serveur:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
