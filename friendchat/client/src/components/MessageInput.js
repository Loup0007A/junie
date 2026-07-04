/* eslint-disable */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { api } from '../hooks/useContexts';

export default function MessageInput({ onSend, onTyping, disabled, placeholder = 'Écrire un message…' }) {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [gifSearch, setGifSearch] = useState('');
  const [gifs, setGifs] = useState([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifError, setGifError] = useState(false);
  const [gifSource, setGifSource] = useState('giphy'); // giphy | tenor
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const gifDebounce = useRef(null);

  // Markdown helpers
  const wrapText = useCallback((prefix, suffix = prefix) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = text.slice(start, end) || 'texte';
    const newText = text.slice(0, start) + prefix + selected + suffix + text.slice(end);
    setText(newText);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  }, [text]);

  const insertText = useCallback((str) => {
    const el = inputRef.current;
    if (!el) return;
    const pos = el.selectionStart;
    const newText = text.slice(0, pos) + str + text.slice(pos);
    setText(newText);
    setTimeout(() => { el.focus(); el.setSelectionRange(pos + str.length, pos + str.length); }, 0);
  }, [text]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e) => {
    setText(e.target.value);
    if (onTyping) onTyping();
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => { if (onTyping) onTyping(true); }, 2000);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend({ content: trimmed, type: 'text' });
    setText('');
  };

  const handleEmojiClick = (emojiData) => {
    insertText(emojiData.emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const searchGifs = async (query) => {
    if (!query.trim()) return;
    setGifLoading(true);
    setGifError(false);
    try {
      const r = await api.get('/api/gifs/search', { params: { q: query, source: gifSource, limit: 15 } });
      setGifs(r.data.results || []);
      if (!r.data.results || r.data.results.length === 0) setGifError(false);
    } catch (err) {
      console.error('GIF search error:', err);
      setGifError(true);
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  };

  // Debounced live search as the user types
  const handleGifSearchChange = (value) => {
    setGifSearch(value);
    clearTimeout(gifDebounce.current);
    if (!value.trim()) { setGifs([]); return; }
    gifDebounce.current = setTimeout(() => searchGifs(value), 450);
  };

  // Trending GIFs on open
  useEffect(() => {
    if (showGif && gifs.length === 0 && !gifSearch) {
      (async () => {
        setGifLoading(true);
        setGifError(false);
        try {
          const r = await api.get('/api/gifs/trending', { params: { source: gifSource, limit: 12 } });
          setGifs(r.data.results || []);
        } catch (err) {
          console.error('GIF trending error:', err);
          setGifError(true);
        } finally {
          setGifLoading(false);
        }
      })();
    }
  }, [showGif, gifSource]);

  const sendGif = (gif) => {
    onSend({ content: gif.url, type: 'gif' });
    setShowGif(false);
    setGifs([]);
    setGifSearch('');
  };

  const handleImageUpload = async (file) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const r = await api.post('/api/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onSend({ content: r.data.url, type: 'image' });
    } catch (err) {
      alert('Erreur lors de l\'upload de l\'image');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleImageUpload(file);
  };

  // Slash command autocomplete
  const COMMANDS = [
    { cmd: '/help', desc: 'Liste des commandes' },
    { cmd: '/announce', desc: 'Annonce à tous', example: '/announce Bonne nuit !' },
    { cmd: '/shake', desc: 'Fait trembler l\'écran' },
    { cmd: '/confetti', desc: 'Lance des confettis 🎊' },
    { cmd: '/rain', desc: 'Fait pleuvoir un emoji', example: '/rain 🍕' },
    { cmd: '/snow', desc: 'Fait tomber la neige ❄️' },
    { cmd: '/disco', desc: 'Mode disco 🪩' },
    { cmd: '/matrix', desc: 'Pluie Matrix 💻' },
    { cmd: '/honk', desc: 'HONK HONK 🦢' },
    { cmd: '/rickroll', desc: 'Rickroll classique 🎵' },
    { cmd: '/dadjoke', desc: 'Blague aléatoire 😄' },
    { cmd: '/8ball', desc: 'Boule magique 🎱', example: '/8ball Vais-je gagner ?' },
    { cmd: '/roll', desc: 'Lance des dés 🎲', example: '/roll 2d6' },
    { cmd: '/coinflip', desc: 'Pile ou face 🪙' },
    { cmd: '/fakeban', desc: 'Faux ban pour rire 🔨', example: '/fakeban pseudo' },
    { cmd: '/clear', desc: 'Efface l\'affichage du chat' },
  ];

  const showCmdSuggest = text.startsWith('/') && !text.includes(' ');
  const filteredCmds = showCmdSuggest
    ? COMMANDS.filter(c => c.cmd.startsWith(text.toLowerCase()))
    : [];

  const MD_ACTIONS = [
    { icon: <b>B</b>, label: 'Gras', action: () => wrapText('**') },
    { icon: <em>I</em>, label: 'Italique', action: () => wrapText('*') },
    { icon: <span style={{ textDecoration: 'underline' }}>U</span>, label: 'Souligné', action: () => wrapText('<u>', '</u>') },
    { icon: <span style={{ textDecoration: 'line-through' }}>S</span>, label: 'Barré', action: () => wrapText('~~') },
    { icon: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>`</code>, label: 'Code', action: () => wrapText('`') },
    { icon: '🔴', label: 'Rouge', action: () => wrapText('<span class="color-red">', '</span>') },
    { icon: '🟢', label: 'Vert', action: () => wrapText('<span class="color-green">', '</span>') },
    { icon: '🔵', label: 'Bleu', action: () => wrapText('<span class="color-blue">', '</span>') },
    { icon: '🟣', label: 'Violet', action: () => wrapText('<span class="color-purple">', '</span>') },
    { icon: '🟡', label: 'Jaune', action: () => wrapText('<span class="color-yellow">', '</span>') },
  ];

  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', position: 'relative' }}>
      {/* Markdown toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 8, flexWrap: 'wrap' }}>
        {MD_ACTIONS.map((a, i) => (
          <div className="tooltip-wrapper" key={i}>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '3px 7px', fontSize: 13, minWidth: 28, lineHeight: 1 }}
              onMouseDown={e => { e.preventDefault(); a.action(); }}
              title={a.label}
            >
              {a.icon}
            </button>
            <span className="tooltip">{a.label}</span>
          </div>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Shift+Entrée pour nouvelle ligne
        </span>
      </div>

      {/* Slash command autocomplete */}
      {filteredCmds.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 16, right: 16, marginBottom: 4,
          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden', zIndex: 200
        }}>
          <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ⚡ Commandes admin
          </div>
          {filteredCmds.slice(0, 8).map(c => (
            <button
              key={c.cmd}
              type="button"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 14px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)', fontSize: 13, transition: 'background var(--transition)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
              onMouseDown={e => {
                e.preventDefault();
                setText(c.example ? c.example.split(' ')[0] + ' ' : c.cmd + ' ');
                inputRef.current?.focus();
              }}
            >
              <code style={{ color: 'var(--accent-light)', fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 110 }}>{c.cmd}</code>
              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{c.desc}</span>
              {c.example && <span style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>{c.example}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        style={{ display: 'flex', gap: 8, alignItems: 'flex-end', position: 'relative' }}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        {/* Emoji button */}
        <div style={{ position: 'relative' }}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }} title="Emoji">
            <span style={{ fontSize: 18 }}>😊</span>
          </button>
          {showEmoji && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 100, marginBottom: 8 }}>
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme="dark"
                emojiStyle="native"
                searchPlaceholder="Rechercher un emoji…"
                width={320}
                height={380}
              />
            </div>
          )}
        </div>

        {/* GIF button */}
        <div style={{ position: 'relative' }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12, fontWeight: 700, padding: '6px 8px' }} onClick={() => { setShowGif(!showGif); setShowEmoji(false); }} title="GIF">
            GIF
          </button>
          {showGif && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, zIndex: 100, marginBottom: 8,
              background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12,
              width: 320, maxHeight: 380, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)'
            }}>
              <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button className={`btn btn-sm ${gifSource === 'giphy' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setGifSource('giphy'); setGifs([]); setGifSearch(''); setGifError(false); }}>
                    Giphy
                  </button>
                  <button className={`btn btn-sm ${gifSource === 'tenor' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setGifSource('tenor'); setGifs([]); setGifSearch(''); setGifError(false); }}>
                    Tenor
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    className="input"
                    placeholder="Rechercher un GIF…"
                    value={gifSearch}
                    onChange={e => handleGifSearchChange(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchGifs(gifSearch)}
                    autoFocus
                    style={{ flex: 1, padding: '6px 10px' }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={() => searchGifs(gifSearch)}>🔍</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, minHeight: 120 }}>
                {gifLoading ? (
                  <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <div className="spinner" />
                  </div>
                ) : gifError ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20, color: 'var(--danger)', fontSize: 13 }}>
                    Service GIF indisponible.<br/>Réessayez dans un instant.
                  </div>
                ) : gifs.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                    {gifSearch ? 'Aucun résultat…' : 'Recherchez un GIF…'}
                  </div>
                ) : gifs.map(gif => (
                  <img
                    key={gif.id}
                    src={gif.preview}
                    alt="gif"
                    loading="lazy"
                    style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', transition: 'opacity 0.15s', background: 'var(--bg-base)' }}
                    onClick={() => sendGif(gif)}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Image upload */}
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Envoyer une image">
          {uploading ? <span className="spinner" /> : (
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && handleImageUpload(e.target.files[0])} />

        {/* Text input */}
        <textarea
          ref={inputRef}
          className="input"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={disabled ? 'Vous êtes muet(te)…' : placeholder}
          disabled={disabled}
          rows={1}
          style={{ flex: 1, resize: 'none', lineHeight: 1.5, padding: '8px 12px', minHeight: 40, maxHeight: 120, overflowY: 'auto', fontFamily: 'var(--font-body)' }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
        />

        {/* Send button */}
        <button
          type="button"
          className="btn btn-primary btn-icon"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          style={{ flexShrink: 0, width: 40, height: 40 }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      {/* Click outside to close pickers */}
      {(showEmoji || showGif) && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => { setShowEmoji(false); setShowGif(false); }} />
      )}
    </div>
  );
}
