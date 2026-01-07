// netlify/functions/api-gemini.js
export const handler = async (event) => {
  try {
    // 1. Sécurité et Parsing
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: "Clé API manquante." }) };
    }

    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: "Pas de données." }) };
    }
    
    const body = JSON.parse(event.body);
    const userMessage = body.message || "Bonjour";
    const promptSysteme = body.systemPrompt || "Tu es un guide sage.";

    // 2. LE MODÈLE GAGNANT (Celui qui est dans ta liste)
    const modelName = "gemini-2.5-flash"; 
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // 3. Appel à Google
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

    const data = await response.json();

    // 4. Gestion Résultat
    if (data.error) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error.message }) };
    }

    if (data.candidates && data.candidates[0].content) {
        return {
          statusCode: 200,
          body: JSON.stringify({ reply: data.candidates[0].content.parts[0].text }),
        };
    } else {
        return { statusCode: 500, body: JSON.stringify({ error: "Pas de réponse texte." }) };
    }

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
