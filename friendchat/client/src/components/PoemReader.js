/* eslint-disable */
import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
import { api } from '../hooks/useContexts';

// Ouvre le lecteur (query : morceau de titre ou identifiant, vide = au hasard)
export const openPoem = (query = '') => window.dispatchEvent(new CustomEvent('fc:open-poem', { detail: { query } }));

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]+/g, '');
let cache = null;

/** Lecteur des poèmes de Rimbaud (monté une fois dans ChatPage). */
export default function PoemReader() {
  const [open, setOpen] = useState(false);
  const [poems, setPoems] = useState(cache || []);
  const [index, setIndex] = useState(0);
  const [notFound, setNotFound] = useState(null);

  useEffect(() => {
    const onOpen = async (e) => {
      const q = norm(e.detail?.query || '');
      let list = cache;
      if (!list) {
        try { list = cache = (await api.get('/api/rimbaud/poems')).data; } catch { return; }
        setPoems(list);
      }
      let i = q ? list.findIndex(p => norm(p.id) === q || norm(p.title).includes(q)) : -1;
      setNotFound(q && i < 0 ? e.detail.query : null);
      if (i < 0) i = Math.floor(Math.random() * list.length);
      setIndex(i);
      setOpen(true);
    };
    window.addEventListener('fc:open-poem', onOpen);
    return () => window.removeEventListener('fc:open-poem', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowRight') setIndex(i => (i + 1) % poems.length);
      if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + poems.length) % poems.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, poems.length]);

  const poem = poems[index];
  const stanzas = useMemo(() => {
    if (!poem) return [];
    const out = [];
    poem.lines.forEach(l => { if (l.newStanza || !out.length) out.push([]); out[out.length - 1].push(l.text); });
    return out;
  }, [poem]);

  if (!open || !poem) return null;
  const go = (d) => { setNotFound(null); setIndex(i => (i + d + poems.length) % poems.length); };

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal poem-reader" onClick={e => e.stopPropagation()} role="dialog" aria-label={poem.title}>
        <div className="modal-header" style={{ marginBottom: 6 }}>
          <select className="input" value={index} onChange={e => { setNotFound(null); setIndex(+e.target.value); }} aria-label="Choisir un poème" style={{ width: 'auto', maxWidth: '70%', padding: '6px 10px' }}>
            {poems.map((p, i) => <option key={p.id} value={i}>{p.title}</option>)}
          </select>
          <button className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Fermer"><X size={18} /></button>
        </div>
        {notFound && <div className="alert alert-info" style={{ padding: '6px 10px', fontSize: 12 }}>Aucun poème ne correspond à « {notFound} » : en voici un au hasard.</div>}
        <article className="poem-body">
          <h2>{poem.title}</h2>
          <div className="poem-date">{poem.date}</div>
          {stanzas.map((st, i) => <p key={i}>{st.map((v, k) => <span key={k}>{v}<br /></span>)}</p>)}
          <div className="poem-sign">Arthur Rimbaud</div>
        </article>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => go(-1)}><ChevronLeft size={15} /> Précédent</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setNotFound(null); setIndex(Math.floor(Math.random() * poems.length)); }}><Shuffle size={14} /> Au hasard</button>
          <button className="btn btn-secondary btn-sm" onClick={() => go(1)}>Suivant <ChevronRight size={15} /></button>
        </div>
      </div>
    </div>
  );
}
