const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

// Clé API Gemini stockée dans Google Cloud Secret Manager.
// En production : `firebase functions:secrets:set GEMINI_API_KEY`
// En local (émulateur) : fichier functions/.secret.local
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

// Modèles autorisés (évite qu'on utilise la clé pour n'importe quel modèle)
const ALLOWED_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
];
const DEFAULT_MODEL = ALLOWED_MODELS[0];

const PROMPT = `Analyse cette image de plante. Réponds précisément sous forme JSON strict avec uniquement ces 3 clés :
- "type": (le nom ou type de la plante, ex: "un rosier", "une orchidée", etc.)
- "is_dead": (booléen true si la plante est morte, false si elle est vivante)
- "is_pollinator": (booléen true si c'est une plante pollinisatrice reconnue, false sinon)`;

// Codes Gemini temporaires : 429 (quota/débit), 500, 503 (modèle surchargé)
const RETRYABLE_STATUSES = new Set([429, 500, 503]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function callGemini(model, payload) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY.value(),
            },
            body: JSON.stringify(payload),
        }
    );
    return response.json();
}

// Essaie le modèle choisi (2 tentatives), puis les autres modèles autorisés
// si Gemini est surchargé. Renvoie la dernière réponse (succès ou erreur).
async function callGeminiWithFallback(selectedModel, payload) {
    const models = [selectedModel, ...ALLOWED_MODELS.filter((m) => m !== selectedModel)];
    let data;
    for (const model of models) {
        for (let attempt = 1; attempt <= 2; attempt++) {
            data = await callGemini(model, payload);
            if (!data.error || !RETRYABLE_STATUSES.has(data.error.code)) {
                return data;
            }
            logger.warn(`Gemini indisponible (${model}, tentative ${attempt})`, data.error.message);
            if (attempt < 2) await sleep(1000);
        }
    }
    return data;
}

exports.analyze = onRequest(
    {
        region: "europe-west1",
        secrets: [GEMINI_API_KEY],
        maxInstances: 5, // limite les coûts en cas d'abus
        memory: "256MiB",
        timeoutSeconds: 120, // laisse le temps aux nouvelles tentatives
    },
    async (req, res) => {
        if (req.method !== "POST") {
            res.status(405).json({ error: "Méthode non autorisée" });
            return;
        }

        const { image, model } = req.body || {};
        // image = data URL : "data:image/jpeg;base64,...."
        const match = typeof image === "string" && image.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
        if (!match) {
            res.status(400).json({ error: "Image manquante ou invalide" });
            return;
        }
        const [, mimeType, base64Data] = match;
        const selectedModel = ALLOWED_MODELS.includes(model) ? model : DEFAULT_MODEL;

        const payload = {
            contents: [
                {
                    parts: [
                        { text: PROMPT },
                        { inline_data: { mime_type: mimeType, data: base64Data } },
                    ],
                },
            ],
            generationConfig: { responseMimeType: "application/json" },
        };

        try {
            const data = await callGeminiWithFallback(selectedModel, payload);

            if (data.error) {
                logger.error("Erreur Gemini", data.error);
                const busy = RETRYABLE_STATUSES.has(data.error.code);
                res.status(busy ? 503 : 502).json({
                    error: busy
                        ? "Gemini est surchargé pour le moment, réessayez dans quelques instants."
                        : data.error.message,
                });
                return;
            }

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
            const result = JSON.parse(cleanJson);

            res.json({
                type: result.type || "plante",
                is_dead: result.is_dead === true,
                is_pollinator: result.is_pollinator === true,
            });
        } catch (err) {
            logger.error("Échec de l'analyse", err);
            res.status(500).json({ error: "L'analyse a échoué : " + err.message });
        }
    }
);
