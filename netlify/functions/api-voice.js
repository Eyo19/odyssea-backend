// netlify/functions/api-voice.js
export const handler = async (event) => {
  const body = JSON.parse(event.body);
  const text = body.text;
  const voiceId = body.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Une voix par défaut (Rachel)

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2", // Modèle qui gère bien le français
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      }),
    });

    if (!response.ok) {
        const err = await response.json();
        return { statusCode: 500, body: JSON.stringify(err) };
    }

    // On reçoit l'audio en binaire (ArrayBuffer) et on le convertit en Base64 pour l'envoyer au navigateur
    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    return {
      statusCode: 200,
      body: JSON.stringify({ audioContent: base64Audio }),
    };

  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};