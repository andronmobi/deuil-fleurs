# 🌿 Deuil Fleurs — PlantScan AI

Page web statique (HTML + JavaScript « vanilla » + Tailwind CSS via CDN) qui :

1. récupère une photo (caméra du téléphone / webcam, ou import d'un fichier) ;
2. l'envoie à l'API Google Gemini ;
3. affiche le type de plante, si elle est vivante ou morte, et la consigne de tri.

Pas de framework (pas de React), pas d'étape de build.

## Pourquoi une fonction Firebase ?

Tout ce qui est dans une page statique (HTML/JS) est visible par n'importe quel visiteur (clic droit → « Inspecter »). Une clé API mise dans le JavaScript serait donc **publique**, même si elle vient d'une variable d'environnement au moment du build.

On fait donc passer l'appel par une petite **Cloud Function** :

```
navigateur ──(photo)──▶ /api/analyze (Cloud Function) ──(photo + clé secrète)──▶ Gemini
```

La clé reste sur le serveur, dans **Google Cloud Secret Manager**, et n'arrive jamais dans le navigateur.

## Structure

```
deuil-fleurs/
├── public/                 # ce qui est publié sur Firebase Hosting
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js           # caméra, import de photo, appel à /api/analyze
├── functions/              # code serveur (Cloud Functions)
│   ├── index.js            # fonction "analyze" : appelle Gemini avec la clé secrète
│   ├── package.json
│   └── .secret.local.example
├── firebase.json           # config Hosting + Functions + redirection /api/analyze
└── package.json            # scripts npm run dev / npm run deploy
```

## Lancer en local

Prérequis : Node.js 22 et Java (pour l'émulateur Firebase).

1. Installer les dépendances :

   ```bash
   npm install
   ```

2. Créer le fichier de la clé pour l'émulateur (il est ignoré par git) :

   ```bash
   cp functions/.secret.local.example functions/.secret.local
   ```

   puis remplacer `colle-ta-cle-ici` par la clé créée sur https://aistudio.google.com/apikey

3. Démarrer :

   ```bash
   npm run dev
   ```

   puis ouvrir http://localhost:5050

On peut ouvrir le dossier dans VS Code ou IntelliJ et lancer `npm run dev` depuis leur terminal intégré.

## Déployer sur Firebase

1. Dans la [console Firebase](https://console.firebase.google.com), créer un projet et passer au **forfait Blaze** (paiement à l'usage). C'est obligatoire pour Cloud Functions et Secret Manager. Le quota gratuit suffit largement pour un projet de classe ; on peut mettre une alerte de budget dans Google Cloud.

2. Se connecter et lier le dossier au projet :

   ```bash
   npx firebase-tools login
   ```

   ```bash
   npx firebase-tools use --add
   ```

3. **Enregistrer la clé Gemini comme secret** (la commande demande de coller la valeur, qui n'apparaît pas à l'écran) :

   ```bash
   npx firebase-tools functions:secrets:set GEMINI_API_KEY
   ```

4. Déployer :

   ```bash
   npm run deploy
   ```

Pour changer la clé plus tard : refaire l'étape 3, puis `npm run deploy` (la fonction utilise toujours la dernière version du secret au déploiement).

Commandes utiles :

```bash
npx firebase-tools functions:secrets:access GEMINI_API_KEY
```

```bash
npx firebase-tools functions:secrets:destroy GEMINI_API_KEY
```

## Limites à connaître

- **N'importe qui peut appeler `/api/analyze`** et consommer le quota Gemini. La fonction limite déjà les modèles autorisés et le nombre d'instances (`maxInstances: 5`). Pour aller plus loin : Firebase App Check, ou une limite de requêtes.
- **Caméra en direct** : elle ne marche que sur `localhost` ou en HTTPS. Une fois déployé sur Firebase (HTTPS), elle marche aussi sur téléphone.
