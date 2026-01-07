// netlify/functions/api-gemini.js
export const handler = async (event) => {
  try {
    // 1. Parsing du message (sécurité si le body est vide)
    if (!event.body) {
        return { statusCode: 400, body: JSON.stringify({ error: "Pas de données envoyées" }) };
    }
    const body = JSON.parse(event.body);
    const userMessage = body.message || "Bonjour";
    const promptSysteme = body.systemPrompt || "Tu es un assistant utile.";

    // 2. La Clé API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ error: "Clé API manquante sur le serveur" }) };
    }

    // 3. L'URL EXACTE (C'est souvent ici que ça coince)
    // On utilise la version stable 'gemini-1.5-flash' sans le suffixe 'latest' qui bug parfois
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    // 4. L'Appel à Google
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
            {
                role: "user",
                parts: [{ text: promptSysteme + "\n\n" + userMessage }] 
            }
        ]
      }),
    });

    const data = await response.json();

    // 5. Gestion des erreurs Google explicites
    if (data.error) {
        console.error("Erreur Google:", data.error); // Pour voir dans les logs Netlify
        return { statusCode: 500, body: JSON.stringify({ error: "Erreur Google: " + data.error.message }) };
    }

    // 6. Succès !
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
