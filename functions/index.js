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

exports.analyze = onRequest(
    {
        region: "europe-west1",
        secrets: [GEMINI_API_KEY],
        maxInstances: 5, // limite les coûts en cas d'abus
        memory: "256MiB",
        timeoutSeconds: 60,
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
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": GEMINI_API_KEY.value(),
                    },
                    body: JSON.stringify(payload),
                }
            );
            const data = await response.json();

            if (data.error) {
                logger.error("Erreur Gemini", data.error);
                res.status(502).json({ error: data.error.message });
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
