/* eslint-disable */
import React, { useState } from 'react';
import { BarChart3, X } from 'lucide-react';

const MAX_OPTIONS = 10;

/** Fenêtre de création d'un sondage (chat global). */
export default function PollModal({ onClose, onCreate }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);

  const filled = options.map(o => o.trim()).filter(Boolean);
  const duplicates = new Set(filled.map(o => o.toLowerCase())).size !== filled.length;
  const valid = question.trim() && filled.length >= 2 && !duplicates;

  const setOption = (i, v) => {
    const next = options.map((o, k) => (k === i ? v : o));
    // Ajoute automatiquement une ligne vide quand on remplit la dernière
    if (i === next.length - 1 && v.trim() && next.length < MAX_OPTIONS) next.push('');
    setOptions(next);
  };
  const removeOption = (i) => setOptions(options.length > 2 ? options.filter((_, k) => k !== i) : options);

  const submit = (e) => {
    e.preventDefault();
    if (!valid) return;
    onCreate({ question: question.trim(), options: filled, multi });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={e => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={20} style={{ color: 'var(--accent-light)' }} /> Nouveau sondage</div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Question</label>
          <input className="input" autoFocus maxLength={300} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Pizza ou sushi ce soir ?" />
        </div>
        <div className="form-group">
          <label className="form-label">Choix ({filled.length}/{MAX_OPTIONS})</label>
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: 6 }}>
              <input className="input" maxLength={100} value={o} onChange={e => setOption(i, e.target.value)} placeholder={`Choix ${i + 1}`} style={{ padding: '7px 10px' }} />
              {options.length > 2 && (
                <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeOption(i)} title="Retirer" aria-label="Retirer ce choix"><X size={15} /></button>
              )}
            </div>
          ))}
          {duplicates && <div className="form-error">Deux choix sont identiques.</div>}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={multi} onChange={e => setMulti(e.target.checked)} />
          Autoriser plusieurs choix par personne
        </label>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>Publier le sondage</button>
        </div>
      </form>
    </div>
  );
}
