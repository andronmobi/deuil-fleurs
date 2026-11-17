const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const preview = document.getElementById('preview');
const placeholder = document.getElementById('placeholder');
const snapBtn = document.getElementById('snapBtn');
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const apiKeyInput = document.getElementById('apiKey');
const modelSelect = document.getElementById('modelSelect');
const resultCard = document.getElementById('resultCard');
const loader = document.getElementById('loader');
const resSummary = document.getElementById('resSummary');
const resInstruction = document.getElementById('resInstruction');

let currentImageBase64 = null;
let streamActive = false;

// Démarrer la caméra au chargement
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = stream;
        video.classList.remove('hidden');
        placeholder.classList.add('hidden');
        streamActive = true;
    } catch (err) {
        console.log("Caméra non accessible ou refusée, utilisation du mode fichier uniquement.");
    }
}
initCamera();

// Prendre une photo depuis la vidéo
snapBtn.addEventListener('click', () => {
    if (!streamActive) {
        fileInput.click();
        return;
    }
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    currentImageBase64 = canvas.toDataURL('image/jpeg', 0.8);

    preview.src = currentImageBase64;
    preview.classList.remove('hidden');
    video.classList.add('hidden');
    placeholder.classList.add('hidden');
    streamActive = false;
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    enableAnalyze();
});

// Importer une image depuis le fichier
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentImageBase64 = event.target.result;
            preview.src = currentImageBase64;
            preview.classList.remove('hidden');
            video.classList.add('hidden');
            placeholder.classList.add('hidden');
            enableAnalyze();
        };
        reader.readAsDataURL(file);
    }
});

function enableAnalyze() {
    if (currentImageBase64) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove('bg-slate-800', 'text-slate-500', 'cursor-not-allowed');
        analyzeBtn.classList.add('bg-emerald-600', 'hover:bg-emerald-500', 'text-white', 'cursor-pointer');
    }
}

// Appel à l'API Gemini
analyzeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = modelSelect.value;

    if (!apiKey) {
        alert("Veuillez entrer votre clé API Gemini.");
        return;
    }
    if (!currentImageBase64) return;

    loader.classList.remove('hidden');
    resultCard.classList.add('hidden');
    analyzeBtn.disabled = true;

    const base64Data = currentImageBase64.split(',')[1];

    const promptText = `Analyse cette image de plante. Réponds précisément sous forme JSON strict avec uniquement ces 3 clés :
    - "type": (le nom ou type de la plante, ex: "un rosier", "une orchidée", etc.)
    - "is_dead": (booléen true si la plante est morte, false si elle est vivante)
    - "is_pollinator": (booléen true si c'est une plante pollinisatrice reconnue, false sinon)`;

    const payload = {
        contents: [
            {
                parts: [
                    { text: promptText },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: base64Data
                        }
                    }
                ]
            }
        ]
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const textResponse = data.candidates[0].content.parts[0].text;

        // Nettoyage du markdown JSON
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJson);

        const plantType = result.type || "plante";
        const isDead = result.is_dead === true;
        const isPollinator = result.is_pollinator === true;

        // Construction de la phrase demandée
        let etatTexte = isDead ? "morte" : "vivante";
        resSummary.textContent = `Merci pour ce cliché, il s'agit d'un(e) ${plantType}, qui est ${etatTexte}.`;

        // Détermination de la consigne selon les règles
        let instructionText = "";
        if (isDead) {
            instructionText = "Mettez votre plante dans la poubelle verte, à des fins de compost.";
        } else if (isPollinator) {
            instructionText = "Placez cette plante dans le bac dédié à la mairie.";
        } else {
            instructionText = "Placez cette plante dans le bac dédié aux particuliers.";
        }

        resInstruction.textContent = instructionText;
        resultCard.classList.remove('hidden');
    } catch (err) {
        console.error(err);
        alert("Erreur lors de l'analyse : " + err.message);
    } finally {
        loader.classList.add('hidden');
        analyzeBtn.disabled = false;
    }
});
