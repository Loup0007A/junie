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

### Apparence
- **5 thèmes « Voyelles »** inspirés du sonnet de Rimbaud : A noir (or), E blanc (clair), I rouge, U vert, O bleu — bouton palette en bas de la barre latérale
- Taille du texte des messages (petit / normal / grand), mémorisée dans le navigateur
- Icônes vectorielles (Lucide) partout dans l'interface, polices intégrées au site (Bricolage Grotesque, Figtree, Newsreader pour les poèmes)
- **Emojis façon WhatsApp** : un message de 1 à 3 emojis s'affiche en grand, sans bulle ; les emojis dans le texte sont légèrement agrandis
- Version mobile : barre latérale en tiroir (bouton menu)

### Profils et présence
- **Carte de profil** au clic sur un avatar ou un pseudo : bio, statut, membre depuis, dernière visite, nombre de messages, points Rimbaud, bouton « Envoyer un message privé »
- **Statut personnalisé** (emoji + texte) et disponibilité : En ligne, Absent, **Ne pas déranger** (aucun son ni notification)
- Recherche de membres dans la barre latérale, couleur de pseudo propre à chacun

### Conversations
- **Historique infini** : les anciens messages se chargent en remontant ; bouton « nouveaux messages » quand on lit plus haut
- **Messages épinglés** (admins dans le chat global, les deux participants en MP) avec barre d'accès rapide
- **« Vu »** sous ton dernier message privé quand l'autre l'a lu
- **Brouillons** conservés par conversation
- Aperçu des vidéos **YouTube** (lecture intégrée) et des liens d'images

### Interactions
- 😍 **Réactions emoji** sur les messages (👍 ❤️ 😂 😮 😢 🔥…) — survol d'un message, clic sur une réaction pour l'ajouter/retirer
- ↩️ **Répondre à un message** : la citation s'affiche au-dessus de la réponse, un clic ramène au message d'origine
- 📣 **Mentions `@pseudo`** avec autocomplétion (Tab/Entrée), surlignage des messages qui vous mentionnent, son 🔔 et notification navigateur (bouton « Activer les notifications » dans l'en-tête), compteur de non-lus dans l'onglet

- ✏️ **Modifier / supprimer ses messages** (survol → ✏️ / 🗑, ou **↑** dans la zone de saisie vide pour modifier son dernier message) ; mention « (modifié) »
- 📊 **Sondages** : bouton 📊 ou `/sondage Question ? | choix 1 | choix 2` (`/sondage multi …` pour plusieurs choix), votes en direct, clôture par le créateur ou un admin
- 🔍 **Recherche** dans la conversation ouverte (bouton 🔍 ou Ctrl+F), résultats surlignés, clic pour y aller

### 🛡️ Modération automatique
- **Antispam** : 5 messages d'affilée puis 1 toutes les 1,5 s, 3e message identique en 30 s refusé, max 5 mentions par message. Après 3 avertissements en 1 min → muet automatiquement (2, 5, 15 puis 60 min si ça recommence dans la journée). Les admins sont prévenus.
- **Anti-insultes** : les insultes (FR + EN, y compris variantes « c0nnaaard », « s@lope », expressions) sont masquées (`c******`) dans les messages, MP, modifications, sondages et bios. 3 messages censurés en 10 min → muet 5 min.
- **Exceptions** gérées par les admins avec `/filtre` :

| Commande | Effet |
|----------|-------|
| `/filtre liste` | État du filtre, mots ajoutés/retirés, exceptions |
| `/filtre autoriser <mot>` | Exception : ce mot ne sera jamais masqué |
| `/filtre interdire <mot>` | Retire une exception |
| `/filtre ajouter <mot ou expression>` | Masque un nouveau mot |
| `/filtre retirer <mot>` | Ne masque plus ce mot |
| `/filtre test <texte>` | Montre ce qui serait masqué |
| `/filtre on` / `off` | Active / désactive le filtre |

Les administrateurs ne sont ni limités par l'antispam ni mutés automatiquement (leurs insultes restent masquées).

### 🪶 Jeu Rimbaud — complète le vers
Ouvert à tous les membres, une partie à la fois dans le chat global.

| Commande | Effet |
|----------|-------|
| `/rimbaud` | Poème et vers au hasard |
| `/rimbaud choisir` (ou bouton 🪶 Rimbaud) | Sélecteur : on choisit le poème et on **clique sur le mot** où le vers s'arrête |
| `/rimbaud <poème> [vers] [mots]` | Ex. `/rimbaud dormeur 14 3` : 14e vers du *Dormeur du val*, 3 premiers mots affichés |
| `/rimbaud liste` | Poèmes disponibles (19 poèmes, 452 vers) |
| `/rimbaud indice` / `/rimbaud stop` | Révèle un mot (-1 pt) / arrête la partie (lanceur ou admin) |
| `/scores` | Classement |

- Réponse dans le panneau du jeu **ou directement dans le chat** ; accents, majuscules et ponctuation ignorés, petites fautes de frappe tolérées (mot par mot)
- 3 points par vers trouvé, -1 par indice (minimum 1) ; minuteur de 1 à 5 min
- **Un seul indice par personne et par partie** (le créateur de la partie peut en donner autant qu'il veut)
- Celui qui choisit le vers ne peut pas répondre à cette manche
- Textes : *Poésies* d'Arthur Rimbaud (domaine public), fichier `server/rimbaud-poems.js`

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
│   ├── commands.js          # Commandes « / »
│   ├── rimbaud.js           # Jeu « complète le vers »
│   ├── rimbaud-poems.js     # Poèmes de Rimbaud (domaine public)
│   ├── moderation.js        # Antispam + anti-insultes (/filtre)
│   ├── messages.js          # Sondages, modification/suppression, recherche
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
│   │   │   ├── MessageBubble.js # Rendu des messages (réactions, réponses, mentions)
│   │   │   ├── MessageInput.js  # Saisie + emoji + GIF + upload + @mentions
│   │   │   ├── RimbaudGame.js   # Panneau du jeu Rimbaud
│   │   │   ├── RimbaudPicker.js # Sélecteur poème / coupure
│   │   │   ├── PollModal.js     # Création de sondage
│   │   │   ├── ProfileCard.js   # Carte de profil
│   │   │   ├── StatusModal.js   # Statut et disponibilité
│   │   │   ├── AppearanceModal.js # Thèmes Voyelles
│   │   │   └── AuthBrand.js     # Logo des pages de connexion
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
| Frontend | React 18, React Router 6, Socket.io-client, axios, lucide-react, Fontsource |
| Chat | emoji-picker-react, Giphy API, Tenor API |
| Déploiement | Docker, PM2, Nginx |
