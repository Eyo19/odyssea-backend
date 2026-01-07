// netlify/functions/api-gemini.js
export const handler = async (event) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: "Clé absente" }) };

    // ON DEMANDE LA LISTE, ON NE GÉNÈRE RIEN
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    if (data.error) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "Erreur Clé/Compte : " + data.error.message }) 
      };
    }

    // On formate la liste pour qu'elle soit lisible
    const models = data.models
        .filter(m => m.supportedGenerationMethods.includes("generateContent")) // On garde ceux qui savent écrire
        .map(m => m.name);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        reply: "DIAGNOSTIC RÉUSSI. Voici les modèles disponibles pour ta clé : \n" + models.join("\n") 
      }),
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
