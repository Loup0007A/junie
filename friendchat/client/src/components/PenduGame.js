/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { Minus, X, Dices, Square } from 'lucide-react';
import { useAuth, useSocket } from '../hooks/useContexts';

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** Dessin du pendu : 7 étapes (une par erreur). */
function Gallows({ wrong, lost }) {
  const stroke = 'var(--text-secondary)';
  const body = lost ? 'var(--danger)' : 'var(--accent-light)';
  const parts = [
    <circle key="h" cx="120" cy="58" r="14" />,
    <line key="b" x1="120" y1="72" x2="120" y2="118" />,
    <line key="la" x1="120" y1="84" x2="102" y2="102" />,
    <line key="ra" x1="120" y1="84" x2="138" y2="102" />,
    <line key="ll" x1="120" y1="118" x2="104" y2="144" />,
    <line key="rl" x1="120" y1="118" x2="136" y2="144" />,
    <path key="f" d="M112 54 l4 4 m0 -4 l-4 4 M124 54 l4 4 m0 -4 l-4 4" />,
  ];
  return (
    <svg viewBox="0 0 180 170" width="150" height="142" role="img" aria-label={`${wrong} erreur${wrong > 1 ? 's' : ''} sur 7`}>
      <g fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round">
        <line x1="20" y1="160" x2="100" y2="160" />
        <line x1="45" y1="160" x2="45" y2="14" />
        <line x1="45" y1="14" x2="120" y2="14" />
        <line x1="45" y1="40" x2="70" y2="14" />
        <line x1="120" y1="14" x2="120" y2="44" strokeWidth="2.5" />
      </g>
      <g fill="none" stroke={body} strokeWidth="4" strokeLinecap="round">{parts.slice(0, wrong)}</g>
    </svg>
  );
}

export default function PenduGame() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [game, setGame] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [word, setWord] = useState('');
  const [feedback, setFeedback] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (!socket) return;
    const onState = (s) => setGame(prev => {
      if (!s) return prev && prev.status !== 'playing' ? prev : null;
      if (!prev || prev.id !== s.id) { setMinimized(false); setFeedback(null); }
      return s;
    });
    const onFeedback = (fb) => {
      setFeedback(fb);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setFeedback(null), 3000);
    };
    socket.on('pendu_state', onState);
    socket.on('pendu_feedback', onFeedback);
    socket.emit('pendu_get_state');
    return () => { socket.off('pendu_state', onState); socket.off('pendu_feedback', onFeedback); };
  }, [socket]);

  // Clavier physique : taper une lettre la propose (hors champs de saisie)
  useEffect(() => {
    if (!game || game.status !== 'playing' || minimized) return;
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea/i.test(e.target.tagName)) return;
      const l = e.key.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (/^[a-z]$/.test(l)) socket?.emit('pendu_guess', { text: l });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game?.id, game?.status, minimized, socket]);

  if (!game) return null;
  const playing = game.status === 'playing';
  const iChose = game.chosen && game.starterId === user.id;
  const tried = new Set(game.tried);
  const shown = new Set(game.pattern.join('').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae').normalize('NFD').replace(/[̀-ͯ]/g, '').split(''));
  const guess = (t) => socket?.emit('pendu_guess', { text: t });

  if (minimized) {
    return (
      <button className="game-pill" style={{ top: 116 }} onClick={() => setMinimized(false)} title="Rouvrir le pendu">
        Pendu · {game.wrong}/{game.maxErrors}
      </button>
    );
  }

  return (
    <section className="rimbaud-panel" aria-label="Jeu du pendu">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'var(--font-display)' }}>Pendu</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Indice : {game.hint} · lancé par {game.startedBy}
          </div>
        </div>
        <button className="btn btn-ghost btn-icon" onClick={() => setMinimized(true)} aria-label="Réduire"><Minus size={17} /></button>
        {!playing && <button className="btn btn-ghost btn-icon" onClick={() => setGame(null)} aria-label="Fermer"><X size={17} /></button>}
      </div>

      <div style={{ padding: '10px 14px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <Gallows wrong={game.wrong} lost={game.status === 'lost'} />
        <div className="pendu-word" aria-label="Mot à trouver">
          {game.pattern.map((c, i) => <span key={i} className={c === '_' ? 'blank' : ''}>{c === '_' ? '' : c}</span>)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{game.wrong} erreur{game.wrong > 1 ? 's' : ''} sur {game.maxErrors}</div>

        {playing && !iChose && (
          <div className="pendu-keys">
            {LETTERS.map(l => {
              const used = tried.has(l);
              const good = used && shown.has(l);
              return (
                <button key={l} type="button" disabled={used} className={used ? (good ? 'good' : 'bad') : ''} onClick={() => guess(l)} aria-label={`Lettre ${l.toUpperCase()}`}>
                  {l.toUpperCase()}
                </button>
              );
            })}
          </div>
        )}
        {iChose && playing && <div className="alert alert-info" style={{ fontSize: 12, padding: '8px 10px' }}>Tu as choisi le mot : regarde les autres chercher.</div>}
        {!playing && (
          <div style={{ fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
            {game.status === 'won' ? `${game.winner} a trouvé « ${game.word} »` : game.status === 'lost' ? `Pendu ! C'était « ${game.word} »` : `Le mot était « ${game.word} »`}
          </div>
        )}
      </div>

      <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {playing ? (
          <>
            {!iChose && (
              <form onSubmit={e => { e.preventDefault(); if (word.trim()) { guess(word.trim()); setWord(''); } }} style={{ display: 'flex', gap: 6 }}>
                <input className="input" value={word} onChange={e => setWord(e.target.value)} placeholder="Proposer le mot entier" maxLength={30} style={{ flex: 1, padding: '7px 10px' }} />
                <button className="btn btn-primary btn-sm" type="submit" disabled={!word.trim()}>Proposer</button>
              </form>
            )}
            {(game.starterId === user.id || user.role === 'admin') && (
              <button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => socket?.emit('pendu_stop')}><Square size={13} /> Arrêter</button>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={() => socket?.emit('pendu_start')}><Dices size={14} /> Rejouer</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setGame(null)}>Fermer</button>
          </div>
        )}
        {feedback && <div style={{ fontSize: 13, color: feedback.ok ? 'var(--success)' : 'var(--text-secondary)' }}>{feedback.message}</div>}
      </div>
    </section>
  );
}
