// Version robuste : ListModels + fallback v1/v1beta + erreurs propres
// Ce script choisit automatiquement le modèle le plus intelligent disponible pour ta clé.

const https = require("https");

// Ordre de préférence (Du plus intelligent/récent au plus basique)
// J'ai ajouté les modèles V3 et V2 que nous avons vus dans ta liste
const PREFERRED_MODELS = [
  "gemini-3-pro-preview",       // LE TOP DU TOP (Janvier 2026)
  "gemini-3-flash-preview",     // Ultra rapide V3
  "gemini-2.0-flash",           // Le standard très stable V2
  "gemini-2.0-flash-exp",       // Expérimental V2
  "gemini-1.5-pro",             // L'ancien "Cerveau" (très fiable)
  "gemini-1.5-flash",           // L'ancien rapide
  "gemini-pro",                 // Le fallback ultime
];

// Timeouts simples (évite les functions pendues)
const REQUEST_TIMEOUT_MS = 30_000;

function httpRequestJson({ hostname, path, method = "GET", headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, path, method, headers, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const contentType = res.headers["content-type"] || "";
          const isJson = contentType.includes("application/json");
          const parsed = (() => {
            if (!data) return null;
            if (isJson) {
              try { return JSON.parse(data); } catch { return data; }
            }
            // Gemini renvoie quasi toujours JSON, mais on sécurise
            try { return JSON.parse(data); } catch { return data; }
          })();

          // On remonte le statut + payload, sans jeter ici
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            raw: data,
            json: parsed,
          });
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Request timeout"));
    });

    req.on("error", (err) => reject(err));

    if (body) req.write(body);
    req.end();
  });
}

function normalizeGeminiError({ statusCode, json, raw }) {
  // On essaye d’extraire le message Gemini (format Google RPC)
  const message =
    (json && json.error && json.error.message) ||
    (typeof json === "string" ? json : null) ||
    raw ||
    `HTTP ${statusCode}`;

  // Retry delay éventuel
  const retryDelay =
    json?.error?.details?.find((d) => d["@type"]?.includes("RetryInfo"))?.retryDelay ||
    null;

  return { statusCode, message, retryDelay, json };
}

async function listModels(apiKey, apiVersion) {
  // v1: /v1/models
  // v1beta: /v1beta/models
  const path = `/${apiVersion}/models?key=${encodeURIComponent(apiKey)}`;
  const resp = await httpRequestJson({
    hostname: "generativelanguage.googleapis.com",
    path,
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (resp.statusCode >= 200 && resp.statusCode < 300) {
    const models = resp.json?.models || [];
    // On garde uniquement ceux qui supportent generateContent
    const supported = models
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
      .map((m) => {
        // name typique: "models/gemini-2.0-flash" => on garde seulement la fin
        const full = m.name || "";
        return full.startsWith("models/") ? full.replace("models/", "") : full;
      })
      .filter(Boolean);

    return supported;
  }

  // En cas d’échec, on remonte l’erreur (utile si clé invalide / quota / etc.)
  throw normalizeGeminiError(resp);
}

async function generateContent({ apiKey, apiVersion, model, payloadObj }) {
  const payload = JSON.stringify(payloadObj);

  const path = `/${apiVersion}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const resp = await httpRequestJson({
    hostname: "generativelanguage.googleapis.com",
    path,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
    body: payload,
  });

  if (resp.statusCode >= 200 && resp.statusCode < 300) {
    const text = resp.json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw { statusCode: 502, message: "Réponse Gemini vide (pas de texte dans candidates[0])", json: resp.json };
    }
    return text;
  }

  throw normalizeGeminiError(resp);
}

function buildGeminiPayload({ message, fullHistory, systemPrompt }) {
  // Format compatible generateContent (roles: user/model)
  const contents = [];

  if (Array.isArray(fullHistory)) {
    for (const msg of fullHistory) {
      const role = msg?.role === "user" ? "user" : "model";
      const text = msg?.parts?.[0]?.text;
      if (typeof text === "string" && text.trim()) {
        contents.push({ role, parts: [{ text }] });
      }
    }
  }

  // Gemini aime bien commencer par "user"
  while (contents.length && contents[0].role !== "user") contents.shift();

  // Ajout du message courant
  contents.push({ role: "user", parts: [{ text: String(message ?? "") }] });

  const payload = {
    contents,
    generationConfig: { temperature: 0.7 },
  };

  // Si API supporte systemInstruction, on l’utilise (meilleur que préfixer le texte)
  if (systemPrompt && String(systemPrompt).trim()) {
    payload.systemInstruction = {
      parts: [{ text: String(systemPrompt).trim() }],
    };
  }

  return payload;
}

exports.handler = async (event) => {
  try {
    console.log("--- GEMINI FUNCTION (AUTO-DETECT MODE) ---");

    // 1) API KEY
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "GEMINI_API_KEY manquante dans l’environnement (process.env)." }),
      };
    }

    // 2) Parse body
    let bodyData;
    try {
      bodyData = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, body: JSON.stringify({ error: "Bad JSON body" }) };
    }

    const { message, fullHistory, systemPrompt } = bodyData;
    if (!message || !String(message).trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: "Champ 'message' manquant" }) };
    }

    const payload = buildGeminiPayload({ message, fullHistory, systemPrompt });

    // 3) Détecter versions + modèles disponibles
    // On tente v1beta d'abord car les modèles preview (V3) sont souvent en beta
    const versionsToTry = ["v1beta", "v1"];
    let lastListError = null;

    for (const apiVersion of versionsToTry) {
      try {
        console.log(`ListModels via ${apiVersion}...`);
        const availableModels = await listModels(apiKey, apiVersion);

        // Ordre de test = préférences ∩ disponibles
        const preferred = PREFERRED_MODELS.filter((m) => availableModels.includes(m));
        
        // Si aucun modèle préféré n'est trouvé, on prend tout ce qui reste (fallback ultime)
        const remaining = availableModels.filter((m) => !preferred.includes(m));
        const modelsToTry = [...preferred, ...remaining].slice(0, 5); // On en teste max 5 pour pas que ça dure 10 plombes

        console.log(`Modèles dispo (${apiVersion}) : ${availableModels.length}. On va tenter dans l'ordre: ${modelsToTry.join(", ")}`);

        // 4) Tenter generateContent sur les modèles sélectionnés
        let lastGenError = null;

        for (const model of modelsToTry) {
          try {
            console.log(`Tentative generateContent: ${apiVersion} / ${model}`);
            const reply = await generateContent({ apiKey, apiVersion, model, payloadObj: payload });

            console.log(`>>> SUCCÈS: ${apiVersion} / ${model}`);
            return {
              statusCode: 200,
              body: JSON.stringify({ reply, modelUsed: model, apiVersion }),
            };
          } catch (err) {
            lastGenError = err;
            const code = err?.statusCode || 500;
            const msg = err?.message || String(err);
            console.warn(`>>> ÉCHEC ${apiVersion}/${model} : HTTP ${code} - ${msg}`);

            // Si c'est un quota (429), inutile d'insister sur ce modèle, on passe au suivant
            // Si c'est une 404 (modèle introuvable via cet endpoint), on passe au suivant
            // On continue la boucle
          }
        }

        // Si on arrive ici : aucun modèle n’a répondu sur cette version
        const code = lastGenError?.statusCode || 500;
        const msg = lastGenError?.message || "Aucun modèle n’a répondu.";
        console.error(`Aucun succès sur ${apiVersion}. Dernière erreur: ${code} - ${msg}`);

        // On tente la version d'API suivante
      } catch (err) {
        lastListError = err;
        console.warn(`ListModels échoué sur ${apiVersion}: ${err.message}`);
        // On tente la version suivante
      }
    }

    // Si v1 ET v1beta ont échoué
    const code = lastListError?.statusCode || 500;
    const msg = lastListError?.message || "Impossible de joindre Gemini.";
    return {
      statusCode: code === 0 ? 500 : code,
      body: JSON.stringify({
        error: "Impossible de lister les modèles ou de générer une réponse.",
        details: msg,
      }),
    };
  } catch (fatal) {
    console.error("Erreur fatale function:", fatal);
    return { statusCode: 500, body: JSON.stringify({ error: "Erreur interne function.", details: String(fatal?.message || fatal) }) };
  }
};
