# 💬 FriendChat

Un chat privé entre amis — beau, sécurisé, et simple à déployer.

---

## Fonctionnalités

### Chat
- **Chat global** en temps réel (WebSocket via Socket.io)
- **Messages privés** (MP) entre membres
- **Indicateur de frappe** en direct
- **Présence** : liste des membres en ligne / hors ligne

### Richesse des messages
- 😊 **Émojis** via `emoji-picker-react` (EmojiTerra)
- 🎞️ **GIFs** Giphy et Tenor avec recherche intégrée
- 📸 **Images** uploadées directement dans le chat (glisser-déposer supporté)
- ✍️ **Markdown** avec barre d'outils :
  - **Gras** `**texte**`
  - *Italique* `*texte*`
  - <u>Souligné</u> `<u>texte</u>`
  - ~~Barré~~ `~~texte~~`
  - `Code inline` `` `texte` ``
  - Blocs de code ` ```code``` `
  - Citations `> texte`
  - Couleurs : rouge, vert, bleu, violet, jaune, orange, rose

### Profils
- **Photo de profil** personnalisable
- **Biographie** courte
- Avatar généré automatiquement si pas de photo

### Sécurité & Administration
- **Inscription sur validation** : personne ne peut rejoindre sans l'approbation de l'admin
- **Panel administrateur** complet :
  - Valider / rejeter les demandes d'inscription
  - Lister tous les utilisateurs
  - **Bannir / débannir** un utilisateur
  - **Muter / démuter** (10 min, 1h, 24h, 1 semaine ou permanent)
  - Promouvoir / rétrograder en admin
  - Supprimer des messages
  - Notifications en temps réel des nouvelles demandes
  - Statistiques (membres, bannis, admins, etc.)
- Authentification **JWT** (7 jours)
- Mots de passe **bcrypt** (coût 12)

---

## Prérequis

- **Node.js** 16 ou supérieur
- **npm** 8 ou supérieur

---

## Démarrage rapide (développement)

```bash
# 1. Cloner / extraire l'archive
cd friendchat

# 2. Installer les dépendances
npm install           # root
cd server && npm install && cd ..
cd client && npm install --legacy-peer-deps && cd ..

# 3. Configurer l'environnement
cp server/.env.example server/.env
# Éditez server/.env si nécessaire (JWT_SECRET, etc.)

# 4. Lancer le serveur + le client en parallèle
npm run dev
```

- **Serveur** : http://localhost:4000
- **Client** : http://localhost:3000
- **Login admin** : `admin` / `Admin1234!`

> ⚠️ Changez le mot de passe admin dès le premier lancement !

---

## Déploiement en production (VPS)

### Option 1 — Script automatique

```bash
bash deploy.sh
```

Le script installe les dépendances, build le React, et démarre avec PM2.

### Option 2 — Manuel

```bash
# 1. Configurer .env
cp server/.env.example server/.env
nano server/.env        # Mettre JWT_SECRET, CLIENT_URL, PORT

# 2. Installer les dépendances serveur
cd server && npm install --production && cd ..

# 3. Builder le client
cd client
cp .env.example .env
# Mettre REACT_APP_SOCKET_URL=https://votre-domaine.com
npm install --legacy-peer-deps
npm run build
cd ..

# 4. Lancer avec PM2
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup     # Pour démarrer au boot du serveur
```

### Option 3 — Docker

```bash
# Copier et éditer .env
cp server/.env.example .env
nano .env   # Renseigner JWT_SECRET et CLIENT_URL

# Lancer
docker-compose up -d

# Logs
docker-compose logs -f
```

### Option 4 — Nginx (reverse proxy)

Voir `nginx.conf` pour la configuration complète.

```bash
sudo cp nginx.conf /etc/nginx/sites-available/friendchat
# Éditer le server_name avec votre domaine
sudo ln -s /etc/nginx/sites-available/friendchat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL avec Let's Encrypt
sudo certbot --nginx -d chat.votredomaine.com
```

---

## Structure du projet

```
friendchat/
├── server/                  # Backend Node.js
│   ├── index.js             # Express + Socket.io principal
│   ├── db.js                # Module base de données (NeDB)
│   ├── data/                # Fichiers DB (auto-créé au 1er lancement)
│   ├── uploads/             # Images uploadées
│   ├── package.json
│   └── .env.example
│
├── client/                  # Frontend React
│   ├── src/
│   │   ├── App.js           # Routeur principal
│   │   ├── hooks/
│   │   │   └── useContexts.js   # AuthContext + SocketContext
│   │   ├── pages/
│   │   │   ├── LoginPage.js
│   │   │   ├── RegisterPage.js
│   │   │   ├── ChatPage.js
│   │   │   └── AdminPage.js
│   │   ├── components/
│   │   │   ├── Sidebar.js       # Navigation + liste membres
│   │   │   ├── ChatWindow.js    # Fenêtre de chat
│   │   │   ├── MessageBubble.js # Rendu des messages
│   │   │   └── MessageInput.js  # Saisie + emoji + GIF + upload
│   │   └── styles/
│   │       └── global.css
│   ├── public/
│   └── package.json
│
├── Dockerfile
├── docker-compose.yml
├── ecosystem.config.js      # PM2
├── nginx.conf
├── deploy.sh
└── README.md
```

---

## Variables d'environnement

### `server/.env`

| Variable | Défaut | Description |
|----------|--------|-------------|
| `PORT` | `4000` | Port du serveur |
| `JWT_SECRET` | *(à changer!)* | Clé secrète JWT |
| `CLIENT_URL` | `http://localhost:3000` | URL du client (CORS) |

### `client/.env`

| Variable | Défaut | Description |
|----------|--------|-------------|
| `REACT_APP_API_URL` | *(vide)* | URL de l'API (vide = proxy CRA) |
| `REACT_APP_SOCKET_URL` | `http://localhost:4000` | URL Socket.io |
| `REACT_APP_GIPHY_KEY` | *(clé démo)* | Votre clé API Giphy |
| `REACT_APP_TENOR_KEY` | *(clé démo)* | Votre clé API Tenor |

---

## APIs tierces (optionnel)

Les GIFs fonctionnent avec les clés de démo, mais il est recommandé d'obtenir les vôtres :

- **Giphy** : https://developers.giphy.com (gratuit)
- **Tenor** : https://tenor.com/gifapi (gratuit)

---

## Sauvegarde

Les données sont stockées dans `server/data/` (fichiers NeDB) et les images dans `server/uploads/`. Sauvegardez ces deux dossiers.

```bash
# Exemple de backup
tar -czf backup-$(date +%Y%m%d).tar.gz server/data/ server/uploads/
```

---

## Compte admin par défaut

| Champ | Valeur |
|-------|--------|
| Nom d'utilisateur | `admin` |
| Mot de passe | `Admin1234!` |

**Changez ce mot de passe immédiatement** via votre profil après le premier lancement.

---

## Technologies

| Côté | Stack |
|------|-------|
| Backend | Node.js, Express, Socket.io, NeDB, JWT, bcrypt, multer |
| Frontend | React 18, React Router 6, Socket.io-client, axios |
| Chat | emoji-picker-react, Giphy API, Tenor API |
| Déploiement | Docker, PM2, Nginx |
