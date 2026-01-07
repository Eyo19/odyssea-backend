// netlify/functions/api-gemini.js
export const handler = async (event) => {
  try {
    // 1. Sécurité : Vérifier que la clé est bien là
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("ERREUR : Pas de clé API trouvée dans les variables Netlify.");
      return { statusCode: 500, body: JSON.stringify({ error: "Configuration serveur incomplète (Clé manquante)." }) };
    }

    // 2. Parsing du message utilisateur
    if (!event.body) {
      return { statusCode: 400, body: JSON.stringify({ error: "Aucune donnée reçue." }) };
    }
    const body = JSON.parse(event.body);
    const userMessage = body.message || "Bonjour";
    const promptSysteme = body.systemPrompt || "Tu es un assistant utile.";

    // 3. L'URL CIBLE (La seule qui fonctionne à coup sûr aujourd'hui)
    // On vise gemini-1.5-flash
    const modelName = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    console.log(`Tentative de connexion au modèle : ${modelName}`);

    // 4. Appel à Google
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

    // 5. Gestion des erreurs Google
    if (data.error) {
      console.error("ERREUR GOOGLE :", JSON.stringify(data.error));
      return { 
        statusCode: 500, 
        body: JSON.stringify({ 
          error: `Erreur du modèle (${modelName}) : ${data.error.message}` 
        }) 
      };
    }

    // 6. Succès
    if (data.candidates && data.candidates[0].content) {
        const aiText = data.candidates[0].content.parts[0].text;
        return {
          statusCode: 200,
          body: JSON.stringify({ reply: aiText }),
        };
    } else {
        return { statusCode: 500, body: JSON.stringify({ error: "Réponse vide de l'IA." }) };
    }

  } catch (error) {
    console.error("ERREUR CODE :", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
