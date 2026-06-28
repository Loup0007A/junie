/* eslint-disable */
import React, { useState } from 'react';
import { useAuth } from '../hooks/useContexts';
import { Avatar } from './Sidebar';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';

// Parse inline markdown to HTML (manual, lightweight)
function parseMarkdown(text) {
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

export default function MessageBubble({ message, showAvatar, isOwn, onAdminDelete }) {
  const { user } = useAuth();
  const [showActions, setShowActions] = useState(false);
  const [imgModal, setImgModal] = useState(null);

  const isAdmin = user?.role === 'admin';

  if (message.deleted) return (
    <div style={{ padding: '4px 16px', opacity: 0.4, fontStyle: 'italic', fontSize: 13, color: 'var(--text-muted)' }}>
      [Message supprimé]
    </div>
  );

  return (
    <>
      <div
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

          {/* Content */}
          <div style={{ position: 'relative' }}>
            {message.type === 'gif' ? (
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
                className="md-content"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
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
        </div>

        {/* Admin actions */}
        {isAdmin && showActions && (
          <button
            className="btn btn-ghost btn-icon"
            style={{ opacity: 0.7, padding: 4, alignSelf: 'center' }}
            onClick={() => onAdminDelete && onAdminDelete(message.id)}
            title="Supprimer ce message"
          >
            <svg width="14" height="14" fill="none" stroke="var(--danger)" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
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
