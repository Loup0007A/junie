// ─────────────────────────────────────────────────────────────
//  Messages : format commun, sondages, modification/suppression
//  de ses propres messages, recherche.
// ─────────────────────────────────────────────────────────────

const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');
const { censor } = require('./moderation');

// Horodatages strictement croissants : deux messages de la même milliseconde gardent leur ordre
let lastMsgTs = 0;
const nextMsgTs = () => (lastMsgTs = Math.max(Date.now(), lastMsgTs + 1));

// Forme commune à l'historique REST et aux événements socket
function serializeMessage(m, avatar = null) {
  const out = {
    id: m.id, sender_id: m.senderId, sender_name: m.senderName,
    content: m.content, type: m.type || 'text', created_at: m.createdAt,
    deleted: m.deleted || false, avatar,
    reactions: m.reactions || {},
    reply_to: m.replyTo || null,
    edited_at: m.editedAt || null,
    pinned: m.pinned || null,
  };
  if (m.poll) out.poll = m.poll;
  if (m.room) out.room = m.room;
  if (m.receiverId) { out.receiver_id = m.receiverId; out.read = m.read || false; }
  return out;
}

function excerptOf(m) {
  if (m.type === 'gif') return '🎞️ GIF';
  if (m.type === 'image') return '📸 Image';
  if (m.type === 'poll') return `📊 ${m.content}`.slice(0, 140);
  return m.content.slice(0, 140);
}

// Où trouver un message et à qui envoyer ses mises à jour
function locate(scope, messageId, user) {
  if (scope === 'private') {
    return {
      store: db.privateMessages,
      filter: { id: messageId, $or: [{ senderId: user.id }, { receiverId: user.id }] },
      emit: (io, msg, event, payload) => {
        io.to(`user-${msg.senderId}`).emit(event, payload);
        io.to(`user-${msg.receiverId}`).emit(event, payload);
      },
    };
  }
  return {
    store: db.messages,
    filter: { id: messageId, room: 'global' },
    emit: (io, msg, event, payload) => io.to('global').emit(event, payload),
  };
}

// ─── Modifier / supprimer ses messages ───────────────────────

async function editMessage(io, user, { messageId, content, scope }, filterText) {
  if (typeof messageId !== 'string' || typeof content !== 'string') return { error: 'Requête invalide.' };
  const text = content.trim();
  if (!text || text.length > 2000) return { error: 'Le message doit faire entre 1 et 2000 caractères.' };
  if (text.startsWith('/')) return { error: 'Un message modifié ne peut pas devenir une commande.' };
  const { store, filter, emit } = locate(scope, messageId, user);
  const msg = await store.findOne(filter);
  if (!msg || msg.deleted) return { error: 'Message introuvable.' };
  if (msg.senderId !== user.id) return { error: 'Tu ne peux modifier que tes propres messages.' };
  if ((msg.type || 'text') !== 'text') return { error: 'Seuls les messages texte peuvent être modifiés.' };
  const clean = await filterText(text);
  const editedAt = Date.now();
  await store.update({ id: messageId }, { $set: { content: clean, editedAt } });
  emit(io, msg, 'message_updated', { id: messageId, content: clean, edited_at: editedAt });
  return { ok: true };
}

async function deleteOwnMessage(io, user, { messageId, scope }) {
  if (typeof messageId !== 'string') return { error: 'Requête invalide.' };
  const { store, filter, emit } = locate(scope, messageId, user);
  const msg = await store.findOne(filter);
  if (!msg || msg.deleted) return { error: 'Message introuvable.' };
  const canAdminDelete = user.role === 'admin' && scope !== 'private';
  if (msg.senderId !== user.id && !canAdminDelete) return { error: 'Tu ne peux supprimer que tes propres messages.' };
  await store.update({ id: messageId }, { $set: { deleted: true, deletedAt: Date.now() } });
  emit(io, msg, 'message_deleted', { id: messageId });
  return { ok: true };
}

// ─── Sondages ────────────────────────────────────────────────

const MAX_OPTIONS = 10;

/** Analyse « Question ? | option 1 | option 2 » (avec « multi » en tête pour plusieurs choix). */
function parsePollCommand(argStr) {
  let multi = false;
  let str = argStr.trim();
  if (/^multi\s+/i.test(str)) { multi = true; str = str.replace(/^multi\s+/i, ''); }
  const [question, ...options] = str.split('|').map(s => s.trim());
  return { question, options: options.filter(Boolean), multi };
}

async function createPoll(io, user, { question, options, multi }) {
  if (typeof question !== 'string' || !Array.isArray(options)) return { error: 'Sondage invalide.' };
  const q = question.trim().slice(0, 300);
  const opts = [...new Set(options.filter(o => typeof o === 'string').map(o => o.trim().slice(0, 100)).filter(Boolean))];
  if (!q) return { error: 'Il faut une question. Ex : /sondage Pizza ou sushi ? | Pizza | Sushi' };
  if (opts.length < 2) return { error: 'Il faut au moins 2 choix différents, séparés par « | ».' };
  if (opts.length > MAX_OPTIONS) return { error: `Maximum ${MAX_OPTIONS} choix.` };

  const msg = {
    id: uuidv4(), room: 'global', senderId: user.id, senderName: user.username,
    content: censor(q).text, type: 'poll', createdAt: nextMsgTs(), reactions: {}, replyTo: null,
    poll: { multi: !!multi, closed: false, options: opts.map(text => ({ text: censor(text).text, votes: [] })) },
  };
  await db.messages.insert(msg);
  io.to('global').emit('new_global_message', serializeMessage(msg, user.avatar || null));
  return { ok: true };
}

async function votePoll(io, user, { messageId, index }) {
  if (typeof messageId !== 'string' || !Number.isInteger(index)) return;
  const msg = await db.messages.findOne({ id: messageId, room: 'global', type: 'poll' });
  if (!msg || msg.deleted || !msg.poll || msg.poll.closed) return;
  if (index < 0 || index >= msg.poll.options.length) return;
  const options = msg.poll.options.map((o, i) => {
    const has = o.votes.includes(user.username);
    if (i === index) return { ...o, votes: has ? o.votes.filter(n => n !== user.username) : [...o.votes, user.username] };
    if (!msg.poll.multi) return { ...o, votes: o.votes.filter(n => n !== user.username) }; // un seul choix
    return o;
  });
  const poll = { ...msg.poll, options };
  await db.messages.update({ id: messageId }, { $set: { poll } });
  io.to('global').emit('message_updated', { id: messageId, poll });
}

async function closePoll(io, user, { messageId }) {
  if (typeof messageId !== 'string') return { error: 'Requête invalide.' };
  const msg = await db.messages.findOne({ id: messageId, room: 'global', type: 'poll' });
  if (!msg || msg.deleted) return { error: 'Sondage introuvable.' };
  if (msg.senderId !== user.id && user.role !== 'admin') return { error: 'Seul le créateur du sondage (ou un admin) peut le clore.' };
  const poll = { ...msg.poll, closed: true };
  await db.messages.update({ id: messageId }, { $set: { poll } });
  io.to('global').emit('message_updated', { id: messageId, poll });
  return { ok: true };
}

// ─── Recherche ───────────────────────────────────────────────

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function searchMessages(user, q, withUserId) {
  const query = (q || '').trim().slice(0, 100);
  if (query.length < 2) return [];
  const re = new RegExp(escapeRegex(query), 'i');
  let rows;
  if (!withUserId || withUserId === 'global') {
    rows = await db.messages.find({ room: 'global', deleted: { $ne: true }, type: { $in: ['text', 'poll'] }, content: re })
      .sort({ createdAt: -1 }).limit(40);
  } else {
    rows = await db.privateMessages.find({
      $and: [
        { $or: [{ senderId: user.id, receiverId: withUserId }, { senderId: withUserId, receiverId: user.id }] },
        { deleted: { $ne: true } }, { content: re },
      ],
    }).sort({ createdAt: -1 }).limit(40);
    rows = rows.filter(m => (m.type || 'text') === 'text');
  }
  return rows.map(m => ({ id: m.id, sender_name: m.senderName, content: m.content, type: m.type || 'text', created_at: m.createdAt }));
}

module.exports = {
  nextMsgTs, serializeMessage, excerptOf,
  editMessage, deleteOwnMessage,
  parsePollCommand, createPoll, votePoll, closePoll,
  searchMessages,
};
