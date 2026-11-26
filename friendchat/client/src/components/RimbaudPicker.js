/* eslint-disable */
import React, { useState, useEffect, useMemo } from 'react';
import { Feather, X, Crosshair, Dices } from 'lucide-react';
import { api } from '../hooks/useContexts';

const SERIF = 'var(--font-poem)';
const DURATIONS = [[60, '1 min'], [90, '1 min 30'], [120, '2 min'], [180, '3 min'], [300, '5 min']];

/**
 * Sélecteur du jeu Rimbaud : on choisit un poème, puis on clique sur le mot
 * à partir duquel les joueurs doivent compléter le vers.
 */
export default function RimbaudPicker({ onClose, onStart, error }) {
  const [poems, setPoems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [poemId, setPoemId] = useState(null);
  const [cut, setCut] = useState(null); // { line, shown }
  const [duration, setDuration] = useState(120);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/api/rimbaud/poems')
      .then(r => { setPoems(r.data); setPoemId(r.data[0]?.id || null); })
      .catch(() => setLoadError('Impossible de charger les poèmes.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (error) setSending(false); }, [error]);

  const poem = poems.find(p => p.id === poemId);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!q) return poems;
    return poems.filter(p => p.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q));
  }, [poems, search]);

  const selectPoem = (id) => { setPoemId(id); setCut(null); };

  const pickRandomCut = () => {
    if (!poem) return;
    const line = 1 + Math.floor(Math.random() * (poem.lines.length - 1));
    const n = poem.lines[line].words.length;
    const shown = n <= 2 ? Math.min(1, n - 1) : 1 + Math.floor(Math.random() * Math.max(1, Math.floor(n / 2)));
    setCut({ line, shown });
  };

  const launch = () => {
    if (!poem || !cut) return;
    setSending(true);
    onStart({ poemId: poem.id, line: cut.line, shown: cut.shown, duration });
  };

  const target = poem && cut ? poem.lines[cut.line] : null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1500 }}>
      <div
        className="modal rimbaud-picker"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 920, width: '95vw', height: '86vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-dim)', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Feather size={18} /></span>
          <div style={{ flex: 1 }}>
            <div className="modal-title">Choisir le vers à compléter</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Choisis un poème puis <b>clique sur le mot</b> à partir duquel les autres devront compléter le vers.
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} title="Fermer" aria-label="Fermer"><X size={18} /></button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Liste des poèmes */}
          <div style={{ width: 230, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: 10 }}>
              <input className="input" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '6px 10px' }} />
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading && <div style={{ padding: 16, color: 'var(--text-muted)' }}><span className="spinner" /></div>}
              {loadError && <div style={{ padding: 16, color: 'var(--danger)', fontSize: 13 }}>{loadError}</div>}
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPoem(p.id)}
                  className="rimbaud-poem-item"
                  style={{ background: p.id === poemId ? 'var(--accent-dim)' : 'none', borderLeft: `3px solid ${p.id === poemId ? 'var(--accent-light)' : 'transparent'}` }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: SERIF }}>{p.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.lines.length} vers · {p.date}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Texte cliquable */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 26px', fontFamily: SERIF, fontSize: 15, lineHeight: 1.8 }}>
            {poem && (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{poem.title}</div>
                {poem.lines.map((l, li) => {
                  const isTarget = cut && cut.line === li;
                  const after = cut && li > cut.line;
                  return (
                    <div key={li} style={{ display: 'flex', gap: 10, marginTop: l.newStanza ? 14 : 0, opacity: after ? 0.35 : 1 }}>
                      <span style={{ width: 24, textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', paddingTop: 4, flexShrink: 0 }}>{li + 1}</span>
                      <div>
                        {l.words.map((w, wi) => {
                          const hidden = isTarget && wi >= cut.shown;
                          return (
                            <span
                              key={wi}
                              className={`rimbaud-word${hidden ? ' is-hidden' : ''}${isTarget && wi === cut.shown ? ' is-cut' : ''}`}
                              onClick={() => setCut({ line: li, shown: wi })}
                              title={`Couper ici : les joueurs devront trouver à partir de « ${w} »`}
                            >{w}</span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Aperçu + lancement */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-surface)' }}>
          <div style={{ fontSize: 13, minHeight: 22 }}>
            {target ? (
              <>
                <span style={{ color: 'var(--text-muted)' }}>Les joueurs verront : </span>
                <span style={{ fontFamily: SERIF }}>
                  <b>{target.words.slice(0, cut.shown).join(' ')}</b>{' '}
                  {target.words.slice(cut.shown).map((_, i) => <span key={i} style={{ display: 'inline-block', width: 30, borderBottom: '2px dashed var(--accent-light)', margin: '0 2px' }} />)}
                </span>
                <span style={{ color: 'var(--text-muted)' }}> — {target.words.length - cut.shown} mot{target.words.length - cut.shown > 1 ? 's' : ''} à trouver, vers {cut.line + 1}</span>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>Clique sur un mot du poème pour choisir où le vers s'arrête.</span>
            )}
          </div>
          {error && <div className="alert alert-error" style={{ padding: '6px 10px', fontSize: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={pickRandomCut} disabled={!poem} title="Choisit un vers et une coupure au hasard dans ce poème (tu pourras ajuster)"><Crosshair size={14} /> Coupure au hasard</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSending(true); onStart({ duration }); }} disabled={sending} title="Poème et vers au hasard : tu peux jouer aussi"><Dices size={14} /> Partie 100 % hasard</button>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              Durée
              <select className="input" value={duration} onChange={e => setDuration(Number(e.target.value))} style={{ padding: '4px 8px', width: 'auto' }}>
                {DURATIONS.map(([d, label]) => <option key={d} value={d}>{label}</option>)}
              </select>
            </label>
            <div style={{ flex: 1 }} />
            {cut && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tu connais la réponse : tu ne joueras pas cette manche.</span>}
            <button className="btn btn-primary" onClick={launch} disabled={!cut || sending}>
              {sending ? <span className="spinner" /> : 'Lancer la partie'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
