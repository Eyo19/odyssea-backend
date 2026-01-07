// netlify/functions/api-gemini.js
export const handler = async (event) => {
  // On récupère le message envoyé par le frontend
  const body = JSON.parse(event.body);
  const userMessage = body.message || "Bonjour";
  const promptSysteme = body.systemPrompt || "Tu es un assistant utile.";

  // On appelle l'API Google Gemini
  const apiKey = process.env.GEMINI_API_KEY; // La clé sera stockée chez Netlify
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  try {
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
    
    // Si Google renvoie une erreur
    if (data.error) {
        return { statusCode: 500, body: JSON.stringify({ error: data.error.message }) };
    }

    // On renvoie juste le texte de l'IA au frontend
    const aiText = data.candidates[0].content.parts[0].text;
    return {
      statusCode: 200,
      body: JSON.stringify({ reply: aiText }),
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};