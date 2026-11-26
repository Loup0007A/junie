/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useContexts';
import { Avatar } from './Sidebar';
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
  return html;
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
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>📊 {message.content}</div>
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
            <span style={{ position: 'relative', flex: 1, textAlign: 'left' }}>{mine ? '✅ ' : ''}{o.text}</span>
            <span style={{ position: 'relative', fontSize: 12, color: 'var(--text-secondary)' }}>{o.votes.length} · {pct} %</span>
          </button>
        );
      })}
      {canClose && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => onClose && onClose(message.id)}>
          🔒 Clore le sondage
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

export default function MessageBubble({ message, showAvatar, isOwn, onAdminDelete, onReact, onReply, onJumpTo, canDelete = true, editing = false, onStartEdit, onSaveEdit, onCancelEdit, onDeleteOwn, onVote, onClosePoll }) {
  const { user } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const [imgModal, setImgModal] = useState(null);

  const isAdmin = user?.role === 'admin';
  const isSystem = message.sender_id === 'system' || String(message.id).startsWith('sys-');
  const reactions = Object.entries(message.reactions || {}).filter(([, names]) => names.length);
  const mentionsMe = !isOwn && message.type === 'text' && mentionsUser(message.content, user?.username);

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
            <Avatar
              user={{ id: message.sender_id, username: message.sender_name, avatar: message.avatar }}
              size={36}
            />
          )}
        </div>

        {/* Bubble */}
        <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
          {showAvatar && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: isOwn ? 'var(--accent-light)' : 'var(--text-primary)' }}>
                {isOwn ? 'Moi' : message.sender_name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {formatTimestamp(message.created_at)}
              </span>
            </div>
          )}

          {/* Quoted message (reply) */}
          {message.reply_to && (
            <div className="reply-quote" onClick={() => onJumpTo && onJumpTo(message.reply_to.id)} title="Voir le message d'origine">
              ↩ <b>{message.reply_to.sender_name}</b> : {stripMarkup(message.reply_to.excerpt)}
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
            ) : (
              <div
                style={{
                  background: isOwn ? 'var(--accent)' : 'var(--bg-elevated)',
                  color: isOwn ? '#fff' : 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                  fontSize: 14,
                  lineHeight: 1.5,
                  wordBreak: 'break-word',
                  boxShadow: 'var(--shadow-sm)'
                }}
                className={`md-content${mentionsMe ? ' msg-mentions-me' : ''}`}
                dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content, user?.username) }}
              />
            )}

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

          {message.edited_at && !editing && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }} title={`Modifié le ${new Date(message.edited_at).toLocaleString('fr-FR')}`}>(modifié)</span>
          )}

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
            {onReply && (
              <button type="button" onClick={() => onReply(message)} title="Répondre">↩️</button>
            )}
            {isOwn && message.type === 'text' && onStartEdit && (
              <button type="button" onClick={() => onStartEdit(message.id)} title="Modifier (ou ↑ dans la zone de saisie)">✏️</button>
            )}
            {isOwn && onDeleteOwn && (
              <button type="button" onClick={() => onDeleteOwn(message.id)} title="Supprimer mon message">
                <svg width="14" height="14" fill="none" stroke="var(--danger)" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            )}
            {!isOwn && isAdmin && canDelete && (
              <button type="button" onClick={() => onAdminDelete && onAdminDelete(message.id)} title="Supprimer ce message">
                <svg width="14" height="14" fill="none" stroke="var(--danger)" strokeWidth="2" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
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
