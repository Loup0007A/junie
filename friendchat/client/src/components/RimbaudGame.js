/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useAuth, useSocket } from '../hooks/useContexts';
import RimbaudPicker from './RimbaudPicker';

// Ouvre le sélecteur depuis n'importe où (ex : commande « /rimbaud choisir »)
export const openRimbaudPicker = () => window.dispatchEvent(new Event('rimbaud:open-picker'));

const SERIF = "Georgia, 'Times New Roman', serif";

function Blank({ word }) {
  return (
    <span style={{
      display: 'inline-block', minWidth: 34, height: '1em', margin: '0 3px', verticalAlign: '-2px',
      borderBottom: '2px dashed var(--accent-light)',
    }} title={word ? undefined : 'mot à trouver'} />
  );
}

export default function RimbaudGame() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [game, setGame] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerError, setPickerError] = useState(null);
  const inputRef = useRef(null);
  const feedbackTimer = useRef(null);
  const pickerOpenRef = useRef(false);
  useEffect(() => { pickerOpenRef.current = pickerOpen; }, [pickerOpen]);

  useEffect(() => {
    if (!socket) return;
    const onState = (state) => {
      setGame(prev => {
        if (!state) return prev && prev.status !== 'playing' ? prev : null; // garder l'écran de fin
        if (!prev || prev.id !== state.id) { setAnswer(''); setFeedback(null); setMinimized(false); }
        return state;
      });
      if (state && state.status === 'playing') { setPickerOpen(false); setPickerError(null); }
    };
    const onFeedback = (fb) => {
      if (pickerOpenRef.current && !fb.ok && !fb.info) { setPickerError(fb.message); return; }
      setFeedback(fb);
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = setTimeout(() => setFeedback(null), fb.ok ? 8000 : 3500);
    };
    socket.on('rimbaud_state', onState);
    socket.on('rimbaud_feedback', onFeedback);
    socket.emit('rimbaud_get_state');
    return () => { socket.off('rimbaud_state', onState); socket.off('rimbaud_feedback', onFeedback); };
  }, [socket]);

  useEffect(() => {
    const open = () => { setPickerError(null); setPickerOpen(true); };
    window.addEventListener('rimbaud:open-picker', open);
    return () => window.removeEventListener('rimbaud:open-picker', open);
  }, []);

  useEffect(() => {
    if (!game || game.status !== 'playing') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [game?.id, game?.status]);

  const submit = (e) => {
    e?.preventDefault();
    if (!answer.trim() || !socket) return;
    socket.emit('rimbaud_answer', { text: answer.trim() });
    setAnswer('');
    inputRef.current?.focus();
  };

  const startRandom = () => socket?.emit('rimbaud_start', {});

  const picker = pickerOpen && (
    <RimbaudPicker
      error={pickerError}
      onClose={() => setPickerOpen(false)}
      onStart={(opts) => { setPickerError(null); socket?.emit('rimbaud_start', opts); }}
    />
  );

  if (!game) return picker || null;

  const playing = game.status === 'playing';
  const remaining = Math.max(0, Math.ceil((game.endsAt - now) / 1000));
  const progress = playing ? Math.max(0, Math.min(1, (game.endsAt - now) / (game.duration * 1000))) : 0;
  const iKnowIt = game.chosen && game.starterId === user.id;
  const canStop = playing && (game.starterId === user.id || user.role === 'admin');
  const hintsLeft = game.hiddenCount - 1 - game.hintWords.length;
  const iUsedMyHint = game.starterId !== user.id && (game.hintsBy || []).includes(user.username);
  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  if (minimized) {
    return (
      <>
        <button
          onClick={() => setMinimized(false)}
          style={{
            position: 'fixed', top: 72, right: 20, zIndex: 900, cursor: 'pointer',
            background: 'linear-gradient(135deg,var(--accent),var(--accent-light))', color: '#fff', border: 'none',
            borderRadius: 999, padding: '8px 16px', fontWeight: 600, fontSize: 13, boxShadow: 'var(--shadow-lg)',
          }}
          title="Rouvrir le jeu"
        >
          🪶 Rimbaud {playing ? `· ${mmss}` : '· terminé'}
        </button>
        {picker}
      </>
    );
  }

  return (
    <>
      <div className="rimbaud-panel">
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 22 }}>🪶</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Complète le vers</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <em>{game.poemTitle}</em> · vers {game.verseNumber} · lancé par {game.startedBy}{game.chosen ? ' (choisi)' : ''}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={() => setMinimized(true)} title="Réduire">—</button>
          {!playing && <button className="btn btn-ghost btn-icon" onClick={() => setGame(null)} title="Fermer">✕</button>}
        </div>

        {/* Minuteur */}
        {playing && (
          <div style={{ height: 4, background: 'var(--bg-base)' }}>
            <div style={{
              height: '100%', width: `${progress * 100}%`, transition: 'width .25s linear',
              background: remaining <= 15 ? 'var(--danger)' : 'linear-gradient(90deg,var(--accent),var(--accent-light))',
            }} />
          </div>
        )}

        {/* Poème */}
        <div style={{ padding: '14px 18px', fontFamily: SERIF, fontSize: 15, lineHeight: 1.65, overflowY: 'auto', flex: 1 }}>
          {game.truncated && <div style={{ color: 'var(--text-muted)' }}>[…]</div>}
          {game.context.map((l, i) => (
            <div key={i} style={{ marginTop: l.newStanza && i > 0 ? 10 : 0, color: 'var(--text-secondary)', fontStyle: 'italic' }}>{l.text}</div>
          ))}
          <div style={{ marginTop: game.context.length ? 6 : 0, padding: '6px 8px', borderRadius: 8, background: 'var(--accent-dim)', border: '1px solid var(--border-strong)' }}>
            {game.prefix && <span style={{ fontWeight: 600 }}>{game.prefix} </span>}
            {playing ? (
              <>
                {game.hintWords.map((w, i) => <span key={i} style={{ color: 'var(--warning)', fontWeight: 600 }}>{w} </span>)}
                {Array.from({ length: game.hiddenCount - game.hintWords.length }).map((_, i) => <Blank key={i} />)}
              </>
            ) : (
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>{game.answer}</span>
            )}
          </div>
        </div>

        {/* Zone de jeu */}
        <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {playing ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                <span>⏱ <b style={{ color: remaining <= 15 ? 'var(--danger)' : 'var(--text-primary)' }}>{mmss}</b></span>
                <span>{game.hiddenCount} mot{game.hiddenCount > 1 ? 's' : ''} à trouver</span>
                <span>🏅 {game.points} pt{game.points > 1 ? 's' : ''}</span>
              </div>
              {iKnowIt ? (
                <div className="alert alert-info" style={{ fontSize: 12, padding: '8px 10px' }}>
                  Tu as choisi ce vers : regarde les autres chercher 👀
                </div>
              ) : (
                <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
                  <input
                    ref={inputRef}
                    className="input"
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                    placeholder="La fin du vers…"
                    maxLength={300}
                    style={{ flex: 1, padding: '7px 10px', fontFamily: SERIF }}
                    autoFocus
                  />
                  <button className="btn btn-primary btn-sm" type="submit" disabled={!answer.trim()}>Valider</button>
                </form>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => socket?.emit('rimbaud_hint')}
                  disabled={hintsLeft <= 0 || iUsedMyHint}
                  title={iUsedMyHint ? 'Tu as déjà utilisé ton indice (un seul par personne)' : game.starterId === user.id ? 'Révèle le mot suivant (-1 point) — illimité pour le créateur' : 'Révèle le mot suivant (-1 point) — un seul indice par personne'}
                >
                  💡 {iUsedMyHint ? 'Indice utilisé' : 'Indice'}
                </button>
                {canStop && (
                  <button className="btn btn-danger btn-sm" onClick={() => socket?.emit('rimbaud_stop')} title="Arrête la partie et révèle la réponse">
                    Arrêter
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>accents/ponctuation ignorés</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {game.status === 'won'
                  ? (game.winner?.id === user.id ? `🏆 Bravo, tu as trouvé ! +${game.winner.points} pt${game.winner.points > 1 ? 's' : ''}` : `🏆 ${game.winner?.username} a trouvé (+${game.winner?.points})`)
                  : game.status === 'timeout' ? '⏰ Temps écoulé !' : '🏳️ Partie arrêtée'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={startRandom}>🎲 Rejouer</button>
                <button className="btn btn-secondary btn-sm" onClick={openRimbaudPicker}>✍️ Choisir un vers</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setGame(null)}>Fermer</button>
              </div>
            </>
          )}
          {feedback && (
            <div style={{ fontSize: 13, fontWeight: 500, color: feedback.ok ? 'var(--success)' : feedback.info ? 'var(--warning)' : 'var(--text-secondary)' }}>
              {feedback.message}{!feedback.ok && feedback.closeness ? ` (${feedback.closeness} %)` : ''}
            </div>
          )}
        </div>
      </div>
      {picker}
    </>
  );
}
