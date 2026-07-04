/* eslint-disable */
import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useContexts';

function ConfettiCanvas({ onDone }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#7c5cbf','#9d7ee3','#4ade80','#fbbf24','#f87171','#60a5fa','#f472b6'];
    const particles = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width, y: -20 - Math.random() * 200,
      size: 5 + Math.random() * 7, color: colors[Math.floor(Math.random() * colors.length)],
      speedY: 2 + Math.random() * 4, speedX: (Math.random() - 0.5) * 3,
      rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 8,
      shape: Math.random() > 0.5 ? 'rect' : 'circle'
    }));
    let raf, elapsed = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.y += p.speedY; p.x += p.speedX; p.rotation += p.rotSpeed;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size * 0.6);
        else { ctx.beginPath(); ctx.arc(0,0,p.size/2,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
      });
      elapsed += 16;
      if (elapsed < 4500) raf = requestAnimationFrame(draw); else onDone();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);
  return <canvas ref={canvasRef} style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none' }} />;
}

function EmojiRain({ emoji, onDone }) {
  const drops = Array.from({ length: 40 }, (_, i) => ({
    id: i, left: Math.random()*100, delay: Math.random()*2,
    dur: 2.5 + Math.random()*2, size: 22 + Math.random()*22
  }));
  useEffect(() => { const t = setTimeout(onDone, 5000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none', overflow:'hidden' }}>
      <style>{`@keyframes fc-fall { to { transform: translateY(110vh) rotate(360deg); opacity:0; } }`}</style>
      {drops.map(d => (
        <span key={d.id} style={{ position:'absolute', top:-40, left:`${d.left}%`, fontSize:d.size,
          animation:`fc-fall ${d.dur}s linear ${d.delay}s 1` }}>{emoji}</span>
      ))}
    </div>
  );
}

function SnowEffect({ onDone }) {
  const flakes = Array.from({ length: 70 }, (_, i) => ({
    id: i, left: Math.random()*100, delay: Math.random()*5,
    dur: 5 + Math.random()*6, size: 5 + Math.random()*10, op: 0.4 + Math.random()*0.6
  }));
  useEffect(() => { const t = setTimeout(onDone, 11000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none', overflow:'hidden' }}>
      <style>{`@keyframes fc-snow { to { transform: translateY(110vh) translateX(15px); } }`}</style>
      {flakes.map(f => (
        <div key={f.id} style={{ position:'absolute', top:-20, left:`${f.left}%`,
          width:f.size, height:f.size, borderRadius:'50%', background:'#fff', opacity:f.op,
          animation:`fc-snow ${f.dur}s linear ${f.delay}s 1` }} />
      ))}
    </div>
  );
}

function MatrixEffect({ onDone }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const chars = 'アイウエオカキクケコサシスセソ0123456789ABCDEF';
    const fontSize = 14;
    const cols = Math.floor(canvas.width / fontSize);
    const drops = Array(cols).fill(1);
    let tid, elapsed = 0;
    const draw = () => {
      ctx.fillStyle = 'rgba(13,13,26,0.07)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#4ade80'; ctx.font = fontSize + 'px monospace';
      drops.forEach((y, i) => {
        ctx.fillText(chars[Math.floor(Math.random() * chars.length)], i * fontSize, y * fontSize);
        if (y * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
      elapsed += 40;
      if (elapsed < 6000) tid = setTimeout(() => requestAnimationFrame(draw), 40);
      else onDone();
    };
    draw();
    return () => clearTimeout(tid);
  }, [onDone]);
  return <canvas ref={canvasRef} style={{ position:'fixed', inset:0, zIndex:9999, pointerEvents:'none', opacity:0.88 }} />;
}

function DiscoEffect({ onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9998, pointerEvents:'none', mixBlendMode:'overlay', animation:'fc-disco 0.35s linear infinite' }}>
      <style>{`@keyframes fc-disco { 0%{background:rgba(255,0,150,.3)} 25%{background:rgba(0,200,255,.3)} 50%{background:rgba(255,220,0,.3)} 75%{background:rgba(120,0,255,.3)} 100%{background:rgba(255,0,150,.3)} }`}</style>
    </div>
  );
}

function AnnouncementBanner({ text, by, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 7000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', zIndex:10000, maxWidth:'90vw', animation:'fc-drop .3s ease' }}>
      <style>{`@keyframes fc-drop { from{transform:translateX(-50%) translateY(-24px);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} }`}</style>
      <div style={{ background:'linear-gradient(135deg,var(--accent),var(--accent-light))', color:'#fff', padding:'14px 24px', borderRadius:14, boxShadow:'0 8px 32px rgba(124,92,191,.5)', display:'flex', alignItems:'center', gap:12, fontWeight:600, fontSize:15 }}>
        <span style={{ fontSize:22 }}>📢</span>
        <div>
          <div>{text}</div>
          <div style={{ fontSize:11, opacity:.8, fontWeight:400, marginTop:2 }}>— {by}</div>
        </div>
        <button onClick={onDone} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', borderRadius:6, padding:'3px 10px', cursor:'pointer', marginLeft:8, fontSize:13 }}>✕</button>
      </div>
    </div>
  );
}

function SystemToast({ content, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 8000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', zIndex:10000, maxWidth:460, width:'90vw', animation:'fc-drop .25s ease' }}>
      <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--accent)', borderRadius:12, padding:'12px 18px', boxShadow:'var(--shadow-lg)', fontSize:13, lineHeight:1.65, whiteSpace:'pre-line', color:'var(--text-primary)' }}>
        <span style={{ fontSize:15, fontWeight:600, color:'var(--accent-light)' }}>💻 Commande</span>
        <div style={{ marginTop:6 }}>{content}</div>
        <button onClick={onDone} style={{ marginTop:8, fontSize:11, color:'var(--text-muted)', background:'none', border:'none', cursor:'pointer' }}>Fermer</button>
      </div>
    </div>
  );
}

export default function FunEffects({ onChatCleared }) {
  const { socket } = useSocket();
  const [confetti, setConfetti] = useState(false);
  const [shake, setShake] = useState(false);
  const [rain, setRain] = useState(null);
  const [snow, setSnow] = useState(false);
  const [matrix, setMatrix] = useState(false);
  const [disco, setDisco] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [systemMsg, setSystemMsg] = useState(null);

  useEffect(() => {
    if (!socket) return;
    const h = {
      fx_shake: () => { setShake(true); setTimeout(() => setShake(false), 700); },
      fx_confetti: () => setConfetti(true),
      fx_rain: ({ emoji }) => setRain(emoji || '🎉'),
      fx_snow: () => setSnow(true),
      fx_matrix: () => setMatrix(true),
      fx_disco: () => setDisco(true),
      announcement: ({ text, by }) => setAnnouncement({ text, by }),
      system_message: ({ content }) => setSystemMsg(content),
      chat_cleared: ({ by }) => { onChatCleared && onChatCleared(by); setSystemMsg(`🧹 Le chat a été effacé par ${by}`); },
    };
    Object.entries(h).forEach(([e, fn]) => socket.on(e, fn));
    return () => Object.entries(h).forEach(([e, fn]) => socket.off(e, fn));
  }, [socket, onChatCleared]);

  return (
    <>
      {shake && (
        <style>{`
          .app-container { animation: fc-shake 0.55s; }
          @keyframes fc-shake {
            0%,100%{transform:translate(0,0)} 10%{transform:translate(-9px,4px)} 20%{transform:translate(9px,-5px)}
            30%{transform:translate(-7px,-4px)} 40%{transform:translate(7px,5px)} 50%{transform:translate(-5px,4px)}
            60%{transform:translate(5px,-4px)} 70%{transform:translate(-4px,-3px)} 80%{transform:translate(4px,3px)}
            90%{transform:translate(-2px,0)}
          }
        `}</style>
      )}
      {confetti && <ConfettiCanvas onDone={() => setConfetti(false)} />}
      {rain && <EmojiRain emoji={rain} onDone={() => setRain(null)} />}
      {snow && <SnowEffect onDone={() => setSnow(false)} />}
      {matrix && <MatrixEffect onDone={() => setMatrix(false)} />}
      {disco && <DiscoEffect onDone={() => setDisco(false)} />}
      {announcement && <AnnouncementBanner text={announcement.text} by={announcement.by} onDone={() => setAnnouncement(null)} />}
      {systemMsg && <SystemToast content={systemMsg} onDone={() => setSystemMsg(null)} />}
    </>
  );
}
