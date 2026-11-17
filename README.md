# 🌿 Deuil Fleurs — PlantScan AI

Page web statique (HTML + JavaScript « vanilla » + Tailwind CSS via CDN) qui :

1. récupère une photo (caméra du téléphone / webcam, ou import d'un fichier) ;
2. l'envoie à l'API Google Gemini ;
3. affiche le type de plante, si elle est vivante ou morte, et la consigne de tri.

Pas de framework (pas de React), pas d'étape de build : on ouvre `index.html` via un petit serveur local.

## Structure

```
deuil-fleurs/
├── index.html      # la page (structure HTML + classes Tailwind)
├── css/
│   └── style.css   # styles personnalisés
├── js/
│   └── app.js      # caméra, import de photo, appel à Gemini
└── package.json    # script « npm run dev » pour lancer un serveur local
```

## Lancer le projet

La caméra (`getUserMedia`) ne fonctionne que sur `http://localhost` ou en HTTPS — pas en ouvrant le fichier directement (`file://`). Il faut donc un petit serveur local.

**Option 1 — terminal (Node.js installé) :**

```bash
npm run dev
```

puis ouvrir http://localhost:8080

**Option 2 — VS Code :** installer l'extension recommandée *Live Server* (VS Code la propose à l'ouverture du dossier), puis clic droit sur `index.html` → *Open with Live Server*.

**Option 3 — IntelliJ / WebStorm :** ouvrir le dossier, ouvrir `index.html`, puis cliquer sur l'icône de navigateur en haut à droite de l'éditeur (serveur intégré).

**Option 4 — Python :**

```bash
python3 -m http.server 8080
```

## Clé API Gemini

Créer une clé sur https://aistudio.google.com/apikey et la coller dans le champ de la page. Ne jamais la mettre dans le code ni la committer.

## Tester sur un téléphone

Sur le téléphone, le bouton « Importer » permet de choisir une photo ou d'en prendre une. Pour la caméra en direct, la page doit être servie en HTTPS (par ex. via GitHub Pages ou un tunnel type `ngrok`), car `http://<ip-du-pc>:8080` n'est pas considéré comme sécurisé.
