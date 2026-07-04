// ─────────────────────────────────────────────────────────────
//  Commandes admin "/" — petits effets rigolos pour égayer le chat
//  Toutes les commandes sont réservées aux administrateurs.
// ─────────────────────────────────────────────────────────────

const SYSTEM_SENDER = { id: 'system', name: '🤖 Système' };

// Liste des commandes disponibles, affichée par /help
const COMMAND_LIST = [
  { cmd: '/help', desc: 'Affiche la liste des commandes' },
  { cmd: '/clear', desc: 'Efface tous les messages du chat global (visuellement)' },
  { cmd: '/announce <texte>', desc: 'Envoie une annonce stylée à tout le monde' },
  { cmd: '/shake', desc: 'Fait trembler l\'écran de tous les membres' },
  { cmd: '/confetti', desc: 'Lance des confettis pour tout le monde' },
  { cmd: '/rain <emoji>', desc: 'Fait pleuvoir un emoji sur tous les écrans' },
  { cmd: '/snow', desc: 'Fait tomber de la neige ❄️' },
  { cmd: '/rickroll', desc: 'Envoie un Rickroll classique dans le chat' },
  { cmd: '/dadjoke', desc: 'Envoie une blague aléatoire' },
  { cmd: '/8ball <question>', desc: 'Boule magique — pose une question' },
  { cmd: '/roll <NdN>', desc: 'Lance des dés, ex: /roll 2d6' },
  { cmd: '/coinflip', desc: 'Pile ou face' },
  { cmd: '/fakeban <pseudo>', desc: 'Fait croire (pour rire) qu\'on bannit quelqu\'un' },
  { cmd: '/honk', desc: 'HONK 🦢' },
  { cmd: '/disco', desc: 'Active le mode disco sur l\'écran de tout le monde' },
  { cmd: '/matrix', desc: 'Effet pluie Matrix sur l\'écran de tout le monde' },
];

const DAD_JOKES = [
  "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon ils tombent dans le bateau.",
  "Qu'est-ce qu'un crocodile qui surveille la pharmacie ? Un Lacoste garde.",
  "Pourquoi les poissons détestent l'ordinateur ? Ils ont peur du net.",
  "Quel est le sport le plus silencieux ? Le para-chute.",
  "Pourquoi le football c'est rigolo ? Parce que Cantona.",
  "Comment appelle-t-on un chat tout seul ? Un chat-mat.",
  "Quel est le comble pour un électricien ? De ne pas être au courant.",
  "Pourquoi les développeurs confondent Halloween et Noël ? Parce que OCT 31 == DEC 25.",
  "Qu'est-ce qu'un mille-pattes sans pattes ? Un cent-pattes en retard.",
  "Pourquoi le café porte plainte ? Il s'est fait moudre.",
];

const EIGHTBALL_ANSWERS = [
  "Oui, c'est certain. 🎱", "Sans aucun doute. ✨", "Tu peux compter dessus. 👍",
  "C'est probable. 🤔", "Les signes pointent vers oui. ✅",
  "Réponse floue, redemande. 🌫️", "Demande plus tard. ⏳",
  "Mieux vaut ne pas te le dire maintenant. 🤐",
  "Mes sources disent non. ❌", "Très douteux. 😬", "N'y compte pas. 🚫",
];

function rollDice(notation) {
  const match = /^(\d{1,2})d(\d{1,3})$/i.exec((notation || '').trim());
  if (!match) return null;
  const count = Math.min(parseInt(match[1], 10), 20);
  const sides = Math.min(parseInt(match[2], 10), 1000);
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0), notation: `${count}d${sides}` };
}

/**
 * Parses and executes a slash command.
 * Returns an object describing what to broadcast, or null if not a command.
 *
 * @param {string} content - raw message text
 * @param {object} user - the sender (must be admin to use most commands)
 * @param {object} io - socket.io server instance
 * @param {object} socket - the sender's socket
 */
function handleCommand(content, user, io, socket) {
  if (!content.startsWith('/')) return false;

  const [cmdRaw, ...rest] = content.trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase();
  const argStr = content.slice(cmdRaw.length).trim();

  // /help is available to everyone
  if (cmd === '/help') {
    const isAdmin = user.role === 'admin';
    const list = isAdmin ? COMMAND_LIST : COMMAND_LIST.slice(0, 1);
    const text = isAdmin
      ? 'Commandes admin disponibles :\n' + COMMAND_LIST.map(c => `**${c.cmd}** — ${c.desc}`).join('\n')
      : 'Seuls les administrateurs peuvent utiliser des commandes spéciales.';
    socket.emit('system_message', { content: text });
    return true;
  }

  // All other commands require admin
  if (user.role !== 'admin') {
    socket.emit('system_message', { content: `🚫 La commande ${cmd} est réservée aux administrateurs.` });
    return true;
  }

  switch (cmd) {
    case '/clear': {
      io.to('global').emit('chat_cleared', { by: user.username });
      return true;
    }

    case '/announce': {
      if (!argStr) { socket.emit('system_message', { content: 'Usage : /announce <texte>' }); return true; }
      io.emit('announcement', { text: argStr, by: user.username });
      return true;
    }

    case '/shake': {
      io.emit('fx_shake', { by: user.username });
      return true;
    }

    case '/confetti': {
      io.emit('fx_confetti', { by: user.username });
      return true;
    }

    case '/rain': {
      const emoji = argStr || '🎉';
      io.emit('fx_rain', { emoji, by: user.username });
      return true;
    }

    case '/snow': {
      io.emit('fx_snow', { by: user.username });
      return true;
    }

    case '/disco': {
      io.emit('fx_disco', { by: user.username });
      return true;
    }

    case '/matrix': {
      io.emit('fx_matrix', { by: user.username });
      return true;
    }

    case '/honk': {
      io.to('global').emit('new_global_message', {
        id: `sys-${Date.now()}`, room: 'global', sender_id: 'system',
        sender_name: '🦢 Oie sauvage', content: 'HONK HONK HONK 🦢🦢🦢',
        type: 'text', created_at: Date.now(), avatar: null
      });
      return true;
    }

    case '/rickroll': {
      io.to('global').emit('new_global_message', {
        id: `sys-${Date.now()}`, room: 'global', sender_id: 'system',
        sender_name: '🎵 DJ ' + user.username,
        content: 'https://media.giphy.com/media/Vuw9m5wXviFIQ/giphy.gif',
        type: 'gif', created_at: Date.now(), avatar: null
      });
      return true;
    }

    case '/dadjoke': {
      const joke = DAD_JOKES[Math.floor(Math.random() * DAD_JOKES.length)];
      io.to('global').emit('new_global_message', {
        id: `sys-${Date.now()}`, room: 'global', sender_id: 'system',
        sender_name: '🎭 Blague de papa', content: joke,
        type: 'text', created_at: Date.now(), avatar: null
      });
      return true;
    }

    case '/8ball': {
      if (!argStr) { socket.emit('system_message', { content: 'Usage : /8ball <ta question>' }); return true; }
      const answer = EIGHTBALL_ANSWERS[Math.floor(Math.random() * EIGHTBALL_ANSWERS.length)];
      io.to('global').emit('new_global_message', {
        id: `sys-${Date.now()}`, room: 'global', sender_id: 'system',
        sender_name: '🎱 Boule magique',
        content: `**${user.username}** a demandé : *${argStr}*\n→ ${answer}`,
        type: 'text', created_at: Date.now(), avatar: null
      });
      return true;
    }

    case '/roll': {
      const notation = argStr || '1d6';
      const result = rollDice(notation);
      const text = result
        ? `🎲 **${user.username}** lance ${result.notation} → [${result.rolls.join(', ')}] = **${result.total}**`
        : `Format invalide. Utilise par exemple : /roll 2d6`;
      io.to('global').emit('new_global_message', {
        id: `sys-${Date.now()}`, room: 'global', sender_id: 'system',
        sender_name: '🎲 Dés', content: text,
        type: 'text', created_at: Date.now(), avatar: null
      });
      return true;
    }

    case '/coinflip': {
      const result = Math.random() < 0.5 ? 'Pile 🪙' : 'Face 🪙';
      io.to('global').emit('new_global_message', {
        id: `sys-${Date.now()}`, room: 'global', sender_id: 'system',
        sender_name: '🪙 Pile ou face',
        content: `**${user.username}** lance la pièce... **${result}** !`,
        type: 'text', created_at: Date.now(), avatar: null
      });
      return true;
    }

    case '/fakeban': {
      const target = rest[0];
      if (!target) { socket.emit('system_message', { content: 'Usage : /fakeban <pseudo>' }); return true; }
      io.to('global').emit('new_global_message', {
        id: `sys-${Date.now()}`, room: 'global', sender_id: 'system',
        sender_name: '⚖️ Modération',
        content: `🔨 **${target}** a été banni pour "existence non autorisée". *(c'est une blague, calmez-vous)*`,
        type: 'text', created_at: Date.now(), avatar: null
      });
      return true;
    }

    default:
      socket.emit('system_message', { content: `Commande inconnue : ${cmd}. Tape /help pour la liste.` });
      return true;
  }
}

module.exports = { handleCommand, COMMAND_LIST };
