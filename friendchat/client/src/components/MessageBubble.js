/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useContexts';
import { Avatar } from './Sidebar';
import { openProfile } from './ProfileCard';
import { nameColor } from '../hooks/appearance';
import { stripEmoji, stripLeadingEmoji } from '../hooks/text';
import { Reply, Pencil, Trash2, Pin, PinOff, BarChart3, Check, Lock, CornerUpLeft, Play, CheckCheck } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👀'];
const MENTION_RE = /(^|[\s(>])@([A-Za-z0-9_]{3,20})(?![A-Za-z0-9_])/g;

export const stripMarkup = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/[*~`]/g, '').replace(/^> /gm, '');

export function mentionsUser(text, username) {
  if (!text || !username) return false;
  const re = new RegExp(`(^|[\\s(>*_~])@${username}(?![A-Za-z0-9_])`, 'i');
  return re.test(text);
}

// ─── Emojis façon WhatsApp ───────────────────────────────────
// Un emoji = pictogramme (+ variantes, teinte de peau, séquences ZWJ) ou drapeau.
const EMOJI_SEQ = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu;

/** Nombre d'emojis si le message ne contient QUE des emojis (sinon 0). */
export function emojiOnlyCount(text) {
  if (!text || text.length > 60) return 0;
  const found = text.match(EMOJI_SEQ) || [];
  const rest = text.replace(EMOJI_SEQ, '').replace(/[\s\uFE0F\u200D]/g, '');
  return rest ? 0 : found.length;
}
// 1 emoji → très grand, 2 → grand, 3 → moyen (au-delà : bulle normale)
const JUMBO_SIZES = { 1: 56, 2: 46, 3: 38 };

// Emojis dans le texte : un peu plus gros que les lettres (hors balises HTML)
function enlargeInlineEmojis(html) {
  return html.split(/(<[^>]+>)/).map(part => part.startsWith('<') ? part : part.replace(EMOJI_SEQ, '<span class="emoji-inline">$&</span>')).join('');
}

// ─── Aperçus de liens ───────────────────────────────────────
const YT_RE = /(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const IMG_URL_RE = /https?:\/\/[^\s<>"]+\.(?:png|jpe?g|gif|webp)(?:\?[^\s<>"]*)?/i;

function YouTubeEmbed({ id }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="embed-yt" onClick={() => setPlay(true)} role="button" aria-label="Lire la vidéo YouTube">
      {play ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`} title="Vidéo YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
          <span className="play"><Play size={20} fill="currentColor" /></span>
        </>
      )}
    </div>
  );
}

function LinkPreview({ text, onOpenImage }) {
  const yt = YT_RE.exec(text);
  if (yt) return <YouTubeEmbed id={yt[1]} />;
  const img = IMG_URL_RE.exec(text);
  if (img) return <img className="embed-img" src={img[0]} alt="" loading="lazy" onClick={() => onOpenImage(img[0])} onError={e => { e.currentTarget.style.display = 'none'; }} />;
  return null;
}

// Parse inline markdown to HTML (manual, lightweight)
function parseMarkdown(text, myUsername) {
  if (!text) return '';
  let html = text
    // HTML color tags passthrough (our custom color)
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Restore our custom tags
    .replace(/&lt;u&gt;/g, '<u>').replace(/&lt;\/u&gt;/g, '</u>')
    .replace(/&lt;span class="color-red"&gt;/g, '<span class="color-red">')
    .replace(/&lt;span class="color-green"&gt;/g, '<span class="color-green">')
    .replace(/&lt;span class="color-blue"&gt;/g, '<span class="color-blue">')
    .replace(/&lt;span class="color-purple"&gt;/g, '<span class="color-purple">')
    .replace(/&lt;span class="color-yellow"&gt;/g, '<span class="color-yellow">')
    .replace(/&lt;span class="color-orange"&gt;/g, '<span class="color-orange">')
    .replace(/&lt;span class="color-pink"&gt;/g, '<span class="color-pink">')
    .replace(/&lt;\/span&gt;/g, '</span>')
    // Code block
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    // Blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>')
    // URLs
    .replace(/https?:\/\/[^\s<>"]+/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-light)">${url}</a>`)
    // @mentions
    .replace(MENTION_RE, (m, pre, name) => {
      const me = myUsername && name.toLowerCase() === myUsername.toLowerCase();
      return `${pre}<span class="mention${me ? ' mention-me' : ''}">@${name}</span>`;
    })
    // Newlines
    .replace(/\n/g, '<br/>');
  return enlargeInlineEmojis(html);
}

function formatTimestamp(ts) {
  const date = new Date(ts);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return `Hier ${format(date, 'HH:mm')}`;
  return format(date, 'dd MMM HH:mm', { locale: fr });
}

// ─── Sondage ─────────────────────────────────────────────────
function PollCard({ message, isOwn, onVote, onClose }) {
  const { user } = useAuth();
  const poll = message.poll;
  const total = poll.options.reduce((n, o) => n + o.votes.length, 0);
  const voters = new Set(poll.options.flatMap(o => o.votes)).size;
  const canClose = !poll.closed && (message.sender_id === user?.id || user?.role === 'admin');
  return (
    <div className="poll-card">
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2, display: 'flex', gap: 8, alignItems: 'flex-start', fontFamily: 'var(--font-display)' }}>
        <BarChart3 size={18} style={{ color: 'var(--accent-light)', flexShrink: 0, marginTop: 2 }} /> {message.content}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
        {poll.closed ? 'Sondage clos' : poll.multi ? 'Plusieurs choix possibles' : 'Un seul choix'} · {voters} votant{voters > 1 ? 's' : ''}
      </div>
      {poll.options.map((o, i) => {
        const pct = total ? Math.round((o.votes.length / total) * 100) : 0;
        const mine = o.votes.includes(user?.username);
        return (
          <button
            key={i}
            type="button"
            className={`poll-option${mine ? ' mine' : ''}`}
            disabled={poll.closed}
            onClick={() => onVote && onVote(message.id, i)}
            title={o.votes.length ? o.votes.join(', ') : 'Aucun vote'}
          >
            <span className="poll-bar" style={{ width: `${pct}%` }} />
            <span style={{ position: 'relative', flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>{mine && <Check size={14} strokeWidth={3} style={{ color: 'var(--accent-light)' }} />}{o.text}</span>
            <span style={{ position: 'relative', fontSize: 12, color: 'var(--text-secondary)' }}>{o.votes.length} · {pct} %</span>
          </button>
        );
      })}
      {canClose && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => onClose && onClose(message.id)}>
          <Lock size={13} /> Clore le sondage
        </button>
      )}
    </div>
  );
}

// ─── Édition en place ───────────────────────────────────────
function EditBox({ initial, onSave, onCancel }) {
  const [value, setValue] = useState(initial);
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  }, []);
  const save = () => { const v = value.trim(); if (v && v !== initial) onSave(v); else onCancel(); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 260 }}>
      <textarea
        ref={ref}
        className="input"
        value={value}
        rows={Math.min(6, value.split('\n').length + 1)}
        maxLength={2000}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
          if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
        }}
        style={{ resize: 'vertical', fontSize: 14, padding: '8px 10px', fontFamily: 'var(--font-body)' }}
      />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Entrée pour enregistrer · Échap pour annuler</span>
    </div>
  );
}

export default function MessageBubble({ message, showAvatar, isOwn, onAdminDelete, onReact, onReply, onJumpTo, canDelete = true, editing = false, onStartEdit, onSaveEdit, onCancelEdit, onDeleteOwn, onVote, onClosePoll, onPin, seen = false }) {
  const { user } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const [imgModal, setImgModal] = useState(null);

  const isAdmin = user?.role === 'admin';
  const isSystem = message.sender_id === 'system' || String(message.id).startsWith('sys-');
  const reactions = Object.entries(message.reactions || {}).filter(([, names]) => names.length);
  const mentionsMe = !isOwn && message.type === 'text' && mentionsUser(message.content, user?.username);
  const jumbo = message.type === 'text' && !message.reply_to ? (JUMBO_SIZES[emojiOnlyCount(message.content)] || 0) : 0;
  const hasLink = message.type === 'text' && /https?:\/\//.test(message.content);

  if (message.deleted) return (
    <div style={{ padding: '4px 16px', opacity: 0.4, fontStyle: 'italic', fontSize: 13, color: 'var(--text-muted)' }}>
      [Message supprimé]
    </div>
  );

  return (
    <>
      <div
        id={`msg-${message.id}`}
        style={{
          display: 'flex',
          flexDirection: isOwn ? 'row-reverse' : 'row',
          gap: 8,
          padding: `${showAvatar ? '8px' : '2px'} 16px`,
          alignItems: 'flex-end',
          animation: 'slideIn 0.15s ease',
          position: 'relative'
        }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {/* Avatar */}
        <div style={{ width: 36, flexShrink: 0 }}>
          {showAvatar && (
            <button onClick={() => openProfile(message.sender_id)} style={{ background: 'none', border: 'none', padding: 0, cursor: isSystem ? 'default' : 'pointer', borderRadius: '50%' }} title={isSystem ? undefined : `Profil de ${message.sender_name}`} tabIndex={isSystem ? -1 : 0}>
              <Avatar user={{ id: message.sender_id, username: message.sender_name, avatar: message.avatar }} size={36} />
            </button>
          )}
        </div>

        {/* Bubble */}
        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
          {showAvatar && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
              <span
                className={isSystem || isOwn ? undefined : 'clickable-name'}
                onClick={() => !isSystem && !isOwn && openProfile(message.sender_id)}
                style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: isOwn ? 'var(--text-secondary)' : isSystem ? 'var(--accent-light)' : nameColor(message.sender_name) }}
              >
                {isOwn ? 'Moi' : isSystem ? stripEmoji(message.sender_name) : message.sender_name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {formatTimestamp(message.created_at)}
              </span>
            </div>
          )}

          {/* Quoted message (reply) */}
          {message.reply_to && (
            <div className="reply-quote" onClick={() => onJumpTo && onJumpTo(message.reply_to.id)} title="Voir le message d'origine">
              <CornerUpLeft size={12} style={{ verticalAlign: '-1px', marginRight: 4 }} /><b>{message.reply_to.sender_name}</b> : {stripMarkup(message.reply_to.excerpt)}
            </div>
          )}

          {/* Content */}
          <div style={{ position: 'relative' }}>
            {message.type === 'poll' && message.poll ? (
              <PollCard message={message} isOwn={isOwn} onVote={onVote} onClose={onClosePoll} />
            ) : editing ? (
              <EditBox initial={message.content} onSave={(v) => onSaveEdit && onSaveEdit(message.id, v)} onCancel={() => onCancelEdit && onCancelEdit()} />
            ) : message.type === 'gif' ? (
              <img
                src={message.content}
                alt="GIF"
                className="msg-gif"
                loading="lazy"
                onClick={() => setImgModal(message.content)}
                style={{ cursor: 'pointer', maxWidth: 280, borderRadius: 10 }}
              />
            ) : message.type === 'image' ? (
              <img
                src={message.content}
                alt="Image"
                className="msg-image"
                loading="lazy"
                onClick={() => setImgModal(message.content)}
              />
            ) : jumbo ? (
              <div className="jumbo-emoji" style={{ fontSize: jumbo }} aria-label={message.content}>{message.content}</div>
            ) : (
              <div
                style={{
                  background: isOwn ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: isOwn ? 'var(--on-accent)' : 'var(--text-primary)',
                  padding: '8px 13px',
                  borderRadius: isOwn ? '18px 6px 18px 18px' : '6px 18px 18px 18px',
                  wordBreak: 'break-word',
                  boxShadow: 'var(--shadow-sm)',
                  border: isOwn ? 'none' : '1px solid var(--border)'
                }}
                className={`md-content bubble${isOwn ? ' bubble-own' : ''}${mentionsMe ? ' msg-mentions-me' : ''}`}
                dangerouslySetInnerHTML={{ __html: parseMarkdown(isSystem ? stripLeadingEmoji(message.content) : message.content, user?.username) }}
              />
            )}
            {hasLink && !editing && <LinkPreview text={message.content} onOpenImage={setImgModal} />}

            {/* Timestamp for non-first messages */}
            {!showAvatar && (
              <span style={{
                position: 'absolute',
                [isOwn ? 'right' : 'left']: '100%',
                bottom: 2,
                marginLeft: isOwn ? 0 : 8,
                marginRight: isOwn ? 8 : 0,
                fontSize: 10,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                opacity: showActions ? 1 : 0,
                transition: 'opacity 0.15s'
              }}>
                {formatTimestamp(message.created_at)}
              </span>
            )}
          </div>

          {(message.edited_at || message.pinned) && !editing && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {message.pinned && <span className="pin-label"><Pin size={10} style={{ verticalAlign: '-1px' }} /> Épinglé</span>}
              {message.edited_at && <span style={{ fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic' }} title={`Modifié le ${new Date(message.edited_at).toLocaleString('fr-FR')}`}>modifié</span>}
            </div>
          )}
          {seen && <span className="seen-label"><CheckCheck size={13} style={{ verticalAlign: '-2px', color: 'var(--accent-light)' }} /> Vu</span>}

          {/* Reactions */}
          {reactions.length > 0 && (
            <div className="reaction-row" style={{ justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
              {reactions.map(([emoji, names]) => (
                <button
                  key={emoji}
                  type="button"
                  className={`reaction-chip${names.includes(user?.username) ? ' mine' : ''}`}
                  onClick={() => onReact && onReact(message.id, emoji)}
                  title={names.join(', ')}
                >
                  <span>{emoji}</span><span>{names.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Hover actions: reactions, reply, admin delete */}
        {showActions && !isSystem && !editing && (
          <div className="msg-actions">
            {onReact && QUICK_REACTIONS.slice(0, 6).map(e => (
              <button key={e} type="button" onClick={() => onReact(message.id, e)} title={`Réagir ${e}`}>{e}</button>
            ))}
            <span className="msg-actions-sep" />
            {onReply && (
              <button type="button" onClick={() => onReply(message)} title="Répondre" aria-label="Répondre"><Reply size={15} /></button>
            )}
            {onPin && (
              <button type="button" onClick={() => onPin(message.id)} title={message.pinned ? 'Désépingler' : 'Épingler'} aria-label={message.pinned ? 'Désépingler' : 'Épingler'}>
                {message.pinned ? <PinOff size={15} /> : <Pin size={15} />}
              </button>
            )}
            {isOwn && message.type === 'text' && onStartEdit && (
              <button type="button" onClick={() => onStartEdit(message.id)} title="Modifier (ou flèche haut dans la zone de saisie)" aria-label="Modifier"><Pencil size={15} /></button>
            )}
            {isOwn && onDeleteOwn && (
              <button type="button" onClick={() => onDeleteOwn(message.id)} title="Supprimer mon message" aria-label="Supprimer"><Trash2 size={15} style={{ color: 'var(--danger)' }} /></button>
            )}
            {!isOwn && isAdmin && canDelete && (
              <button type="button" onClick={() => onAdminDelete && onAdminDelete(message.id)} title="Supprimer ce message" aria-label="Supprimer"><Trash2 size={15} style={{ color: 'var(--danger)' }} /></button>
            )}
          </div>
        )}
      </div>

      {/* Image lightbox */}
      {imgModal && (
        <div className="modal-overlay" onClick={() => setImgModal(null)} style={{ zIndex: 2000 }}>
          <img src={imgModal} alt="full" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }} />
        </div>
      )}
    </>
  );
}

export function DateDivider({ date }) {
  const d = new Date(date);
  let label;
  if (isToday(d)) label = "Aujourd'hui";
  else if (isYesterday(d)) label = 'Hier';
  else label = format(d, 'EEEE d MMMM', { locale: fr });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', pointerEvents: 'none' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'capitalize' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}
