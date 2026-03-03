import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from './store';
import { Match } from './types';
import { sendRegistrationToTelegram, sendResultToTelegram, sendAddCashToTelegram, sendSupportToTelegram, sendWinnerAnnouncementToTelegram, sendBroadcastToTelegram } from './telegram';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getPrize = (m: Match) => {
  if (m.customPrizePool > 0) return m.customPrizePool;
  return Math.floor(m.registeredPlayers * m.entryFee * 0.4);
};

const getMapGradient = (map: string) => {
  const g: Record<string, string> = {
    Erangel: 'from-green-900 via-green-800 to-emerald-900',
    Miramar: 'from-yellow-900 via-amber-800 to-orange-900',
    Sanhok: 'from-teal-900 via-cyan-800 to-teal-900',
    Livik: 'from-blue-900 via-indigo-800 to-blue-900',
    TDM: 'from-red-900 via-rose-800 to-red-900',
  };
  return g[map] || 'from-gray-900 via-gray-800 to-gray-900';
};

const getMapColor = (map: string) => {
  const c: Record<string, string> = {
    Erangel: '#10b981', Miramar: '#f59e0b',
    Sanhok: '#06b6d4', Livik: '#6366f1', TDM: '#ef4444',
  };
  return c[map] || '#6366f1';
};

const getMapEmoji = (map: string) => {
  const e: Record<string, string> = {
    Erangel: '🏝️', Miramar: '🏜️', Sanhok: '🌴', Livik: '❄️', TDM: '⚔️',
  };
  return e[map] || '🎮';
};

const playSound = (type: 'click' | 'success' | 'error' | 'fanfare') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    if (type === 'click') { o.frequency.value = 800; g.gain.setValueAtTime(0.1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1); }
    else if (type === 'success') { o.frequency.setValueAtTime(523, ctx.currentTime); o.frequency.setValueAtTime(659, ctx.currentTime + 0.1); o.frequency.setValueAtTime(784, ctx.currentTime + 0.2); g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4); }
    else if (type === 'error') { o.frequency.value = 200; o.type = 'sawtooth'; g.gain.setValueAtTime(0.1, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); }
    else if (type === 'fanfare') { o.frequency.setValueAtTime(523, ctx.currentTime); o.frequency.setValueAtTime(784, ctx.currentTime + 0.15); o.frequency.setValueAtTime(1047, ctx.currentTime + 0.3); g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5); }
    o.start(); o.stop(ctx.currentTime + 0.5);
  } catch {}
};

// ─── PARTICLES ────────────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 2 + 1,
      color: ['#dc2626', '#2563eb', '#7c3aed', '#f59e0b', '#10b981'][Math.floor(Math.random() * 5)]
    }));
    let raf: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.shadowBlur = 8; ctx.shadowColor = p.color; ctx.fill();
      });
      particles.forEach((p, i) => particles.slice(i + 1).forEach(p2 => {
        const d = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (d < 120) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.strokeStyle = `rgba(255,255,255,${0.05 * (1 - d / 120)})`; ctx.lineWidth = 0.5; ctx.stroke(); }
      }));
      raf = requestAnimationFrame(animate);
    };
    animate();
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
}

// ─── LOADING ──────────────────────────────────────────────────────────────────
function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setProgress(p => { if (p >= 100) { clearInterval(t); setTimeout(onDone, 300); return 100; } return p + 2; }), 40);
    return () => clearInterval(t);
  }, [onDone]);
  return (
    <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      <ParticleCanvas />
      <motion.div initial={{ scale: 0, rotateY: -180 }} animate={{ scale: 1, rotateY: 0 }} transition={{ duration: 0.8, type: 'spring' }}
        className="text-7xl mb-6">🎮</motion.div>
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="text-5xl font-black text-white mb-2" style={{ fontFamily: 'Orbitron, monospace', textShadow: '0 0 30px #dc2626' }}>
        JEETO
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        className="text-gray-400 mb-8 text-sm tracking-widest">BGMI TOURNAMENT PLATFORM</motion.p>
      <div className="w-64 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-red-600 via-orange-500 to-red-600"
          style={{ width: `${progress}%` }} transition={{ duration: 0.1 }} />
      </div>
      <p className="text-gray-500 text-xs mt-3">{progress}%</p>
    </motion.div>
  );
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
function Confetti({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div key={i} className="absolute w-3 h-3 rounded-sm"
          style={{ left: `${Math.random() * 100}%`, backgroundColor: ['#dc2626','#2563eb','#f59e0b','#10b981','#7c3aed','#f97316'][i % 6] }}
          initial={{ top: '-5%', rotate: 0, opacity: 1 }}
          animate={{ top: '110%', rotate: Math.random() * 720, opacity: 0 }}
          transition={{ duration: 2 + Math.random() * 1, delay: Math.random() * 0.5, ease: 'easeIn' }} />
      ))}
    </div>
  );
}

// ─── COUNTDOWN ────────────────────────────────────────────────────────────────
function Countdown({ date, time }: { date: string; time: string }) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const update = () => {
      const target = new Date(`${date}T${time}`);
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setLeft('Starting...'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLeft(`${h}h ${m}m ${s}s`);
    };
    update(); const t = setInterval(update, 1000); return () => clearInterval(t);
  }, [date, time]);
  return <span className="text-yellow-400 font-mono text-xs">⏰ {left}</span>;
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────
function Navbar({ logoTapCount, setLogoTapCount }: { logoTapCount: number; setLogoTapCount: (n: number) => void }) {
  const { page, setPage, currentUser, isAdminLoggedIn, logoutAdmin, theme, setTheme, soundEnabled, toggleSound } = useStore();
  const lastTap = useRef(0);

  const handleLogoTap = () => {
    const now = Date.now();
    const newCount = now - lastTap.current < 500 ? logoTapCount + 1 : 1;
    lastTap.current = now;
    setLogoTapCount(newCount);
    if (newCount >= 5) { setPage('adminLogin'); setLogoTapCount(0); }
  };

  return (
    <motion.nav initial={{ y: -80 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 100 }}
      className="fixed top-0 left-0 right-0 z-40 backdrop-blur-xl bg-black/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <button onClick={handleLogoTap} className="flex items-center gap-2">
          <span className="text-2xl">🎮</span>
          <span className="text-xl font-black text-white" style={{ fontFamily: 'Orbitron, monospace', textShadow: '0 0 20px #dc2626' }}>JEETO</span>
        </button>
        <div className="hidden md:flex items-center gap-6">
          {['home','leaderboard','winners','results','support'].map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`text-sm font-semibold capitalize transition-all hover:text-red-400 ${page === p ? 'text-red-500' : 'text-gray-400'}`}>
              {p === 'home' ? '🏠 Home' : p === 'leaderboard' ? '🏆 Ranks' : p === 'winners' ? '🏅 Winners' : p === 'results' ? '📸 Results' : '💬 Support'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { toggleSound(); }} className="p-2 text-gray-400 hover:text-white transition-colors text-lg">{soundEnabled ? '🔊' : '🔇'}</button>
          <button onClick={() => setTheme(theme === 'red' ? 'blue' : theme === 'blue' ? 'purple' : 'red')} className="p-2 text-lg">🎨</button>
          {isAdminLoggedIn ? (
            <button onClick={logoutAdmin} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg font-bold hover:bg-red-700 transition-colors">🚪 Logout</button>
          ) : (
            <button onClick={() => { if (soundEnabled) playSound('click'); setPage(currentUser ? 'profile' : 'login'); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-sm text-white hover:bg-white/20 transition-all">
              <span>👤</span>
              <span className="hidden sm:block">{currentUser ? currentUser.displayName.split(' ')[0] : 'Login'}</span>
            </button>
          )}
        </div>
      </div>
    </motion.nav>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
function BottomNav() {
  const { page, setPage, currentUser, soundEnabled } = useStore();
  const tabs = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'leaderboard', icon: '🏆', label: 'Ranks' },
    { id: 'winners', icon: '🏅', label: 'Winners' },
    { id: 'results', icon: '📸', label: 'Results' },
    { id: currentUser ? 'profile' : 'login', icon: '👤', label: currentUser ? 'Profile' : 'Login' },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-black/95 backdrop-blur-xl border-t border-white/10">
      <div className="flex items-center justify-around py-2">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { if (soundEnabled) playSound('click'); setPage(tab.id); }}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all ${page === tab.id || (tab.id === 'profile' && page === 'profile') || (tab.id === 'login' && page === 'login') ? 'text-red-500' : 'text-gray-500'}`}>
            <span className="text-xl">{tab.icon}</span>
            <span className="text-xs font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── BROADCAST BANNER ─────────────────────────────────────────────────────────
function BroadcastBanner() {
  const { broadcast, clearBroadcast } = useStore();
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    if (!broadcast) return;
    const t = setInterval(() => {
      const left = broadcast.expiresAt - Date.now();
      if (left <= 0) { clearBroadcast(); return; }
      const m = Math.floor(left / 60000); const s = Math.floor((left % 60000) / 1000);
      setTimeLeft(`${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(t);
  }, [broadcast, clearBroadcast]);
  if (!broadcast || broadcast.expiresAt < Date.now()) return null;
  return (
    <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="fixed top-16 left-0 right-0 z-30 bg-gradient-to-r from-red-600 via-orange-500 to-red-600 text-white">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span>📢</span>
          <span className="font-semibold">{broadcast.message}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-75">⏱️ {timeLeft}</span>
          <button onClick={clearBroadcast} className="text-white/70 hover:text-white text-lg">✕</button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── MATCH CARD ───────────────────────────────────────────────────────────────
function MatchCard({ match, onRegister }: { match: Match; onRegister: (match: Match) => void }) {
  const { currentUser, soundEnabled } = useStore();
  const [showPlayers, setShowPlayers] = useState(false);
  const [showPrize, setShowPrize] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const prize = getPrize(match);
  const seatsLeft = match.maxPlayers - match.registeredPlayers;
  const pct = (match.registeredPlayers / match.maxPlayers) * 100;
  const color = getMapColor(match.map);
  const verifiedPlayers = match.players.filter(p => p.verified);
  const isRegistered = currentUser && match.players.some(p => p.bgmiName === currentUser.bgmiName);
  const mySlot = isRegistered ? match.players.find(p => p.bgmiName === currentUser?.bgmiName) : null;
  const isFull = match.registeredPlayers >= match.maxPlayers;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 10;
    const y = ((e.clientX - rect.left) / rect.width - 0.5) * -10;
    setTilt({ x, y });
  };

  const shareText = `🎮 BGMI Tournament!\n🗺️ ${match.name}\n🏆 Prize: ₹${prize}\n💺 Seats: ${seatsLeft}/${match.maxPlayers}\n🎫 Entry: ₹${match.entryFee}\n\nJoin Now! 🔥`;

  return (
    <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 100 }}
      onMouseMove={handleMouseMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform 0.1s ease', borderColor: `${color}40` }}
      className={`relative rounded-2xl overflow-hidden border bg-gradient-to-br ${getMapGradient(match.map)} backdrop-blur-xl shadow-2xl`}>
      
      {/* Header */}
      <div className="relative p-5 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">{getMapEmoji(match.map)}</span>
              <div>
                <h3 className="text-white font-black text-lg leading-tight">{match.name}</h3>
                <p className="text-gray-300 text-xs">{match.map} · {match.type} · {match.time}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {match.status === 'open' && !isFull && <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/50 text-green-400 text-xs rounded-full font-bold">🟢 OPEN</span>}
            {match.status === 'live' && <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/50 text-red-400 text-xs rounded-full font-bold animate-pulse">🔴 LIVE</span>}
            {match.status === 'done' && <span className="px-2 py-0.5 bg-gray-500/20 border border-gray-500/50 text-gray-400 text-xs rounded-full font-bold">✅ DONE</span>}
            {isFull && match.status === 'open' && <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/50 text-orange-400 text-xs rounded-full font-bold">🔒 FULL</span>}
          </div>
        </div>

        {/* Prize */}
        <div className="text-center py-3 rounded-xl mb-3" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <p className="text-gray-400 text-xs mb-1">🏆 PRIZE POOL</p>
          <p className="text-4xl font-black" style={{ color, textShadow: `0 0 20px ${color}` }}>₹{prize.toLocaleString()}</p>
          <button onClick={() => setShowPrize(!showPrize)} className="text-xs text-gray-400 hover:text-white mt-1">
            {showPrize ? '▲ Hide split' : '▼ View split'}
          </button>
          <AnimatePresence>
            {showPrize && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="mt-3 grid grid-cols-3 gap-2 overflow-hidden">
                {[{ label: '🥇 1st', amt: match.prizeFirst || Math.floor(prize * 0.5), color: '#f59e0b' },
                  { label: '🥈 2nd', amt: match.prizeSecond || Math.floor(prize * 0.3), color: '#94a3b8' },
                  { label: '🥉 3rd', amt: match.prizeThird || Math.floor(prize * 0.2), color: '#b45309' }
                ].map(item => (
                  <div key={item.label} className="text-center p-2 rounded-lg bg-black/30">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="font-bold text-sm" style={{ color: item.color }}>₹{item.amt}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Seats */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">💺 {seatsLeft} seats left</span>
            <span className="text-gray-400">{match.registeredPlayers}/{match.maxPlayers}</span>
          </div>
          <div className="h-2 bg-black/40 rounded-full overflow-hidden">
            <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: 'easeOut' }}
              style={{ background: pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#10b981' }} />
          </div>
        </div>

        {/* Entry Fee */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-gray-400 text-sm">🎫 Entry Fee</span>
          <span className="text-white font-bold">₹{match.entryFee}</span>
        </div>

        {/* Countdown */}
        {match.status === 'open' && match.date && <div className="mb-3 text-center"><Countdown date={match.date} time={match.time} /></div>}

        {/* My Slot */}
        {isRegistered && mySlot && (
          <div className="mb-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
            <p className="text-green-400 font-bold text-sm">✅ Registered — Slot #{mySlot.slotNumber}</p>
            {mySlot.paymentStatus === 'approved' && match.roomId && (
              <div className="mt-2 p-2 bg-black/40 rounded-lg">
                <p className="text-yellow-400 text-xs font-bold">🔑 Room ID: {match.roomId} | Pass: {match.roomPassword}</p>
              </div>
            )}
          </div>
        )}

        {/* Verified Players */}
        {verifiedPlayers.length > 0 && (
          <button onClick={() => setShowPlayers(!showPlayers)} className="w-full text-xs text-gray-400 hover:text-white mb-3 text-center transition-colors">
            👥 {verifiedPlayers.length} verified players {showPlayers ? '▲' : '▼'}
          </button>
        )}
        <AnimatePresence>
          {showPlayers && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="mb-3 max-h-32 overflow-y-auto space-y-1">
              {verifiedPlayers.map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2 bg-black/30 rounded-lg">
                  <span className="text-green-400 text-xs">🎮</span>
                  <span className="text-white text-xs font-medium">{p.bgmiName}</span>
                  <span className="text-gray-500 text-xs ml-auto">#{p.slotNumber}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Register Button */}
        {match.status === 'open' && !isRegistered && !isFull && (
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => { if (soundEnabled) playSound('fanfare'); onRegister(match); }}
            className="w-full py-3 rounded-xl font-black text-white text-sm transition-all"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, boxShadow: `0 4px 20px ${color}40` }}>
            ⚡ REGISTER NOW
          </motion.button>
        )}

        {/* Share */}
        {match.status !== 'done' && (
          <div className="flex gap-2 mt-2">
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`)}
              className="flex-1 py-2 bg-green-600/20 border border-green-600/30 text-green-400 text-xs rounded-lg hover:bg-green-600/30 transition-all font-semibold">
              📱 WhatsApp
            </button>
            <button onClick={() => window.open(`https://t.me/share/url?text=${encodeURIComponent(shareText)}`)}
              className="flex-1 py-2 bg-blue-600/20 border border-blue-600/30 text-blue-400 text-xs rounded-lg hover:bg-blue-600/30 transition-all font-semibold">
              ✈️ Telegram
            </button>
            <button onClick={() => { navigator.clipboard.writeText(shareText); }}
              className="flex-1 py-2 bg-purple-600/20 border border-purple-600/30 text-purple-400 text-xs rounded-lg hover:bg-purple-600/30 transition-all font-semibold">
              📋 Copy
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── REGISTRATION MODAL ───────────────────────────────────────────────────────
function RegistrationModal({ match, onClose }: { match: Match; onClose: () => void }) {
  const { registerPlayer, currentUser, soundEnabled, updateUserProfile } = useStore();
  const [step, setStep] = useState(1);
  const [agreed, setAgreed] = useState(false);
  const [bgmiName, setBgmiName] = useState(currentUser?.bgmiName || '');
  const [charId, setCharId] = useState(currentUser?.characterId || '');
  const [upiId, setUpiId] = useState(currentUser?.upiId || '');
  const [paymentSS, setPaymentSS] = useState<File | null>(null);
  const [bgmiSS, setBgmiSS] = useState<File | null>(null);
  const [timer, setTimer] = useState(300);
  const [timedOut, setTimedOut] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slotNumber, setSlotNumber] = useState(0);
  const [applyCoupon, setApplyCoupon] = useState(false);
  const [couponAmount, setCouponAmount] = useState(0);
  const prize = getPrize(match);

  useEffect(() => {
    if (step !== 4) return;
    const t = setInterval(() => setTimer(prev => {
      if (prev <= 1) { clearInterval(t); setTimedOut(true); return 0; }
      return prev - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [step]);

  useEffect(() => {
    if (currentUser) setCouponAmount(Math.min(currentUser.couponBalance, match.entryFee));
  }, [currentUser, match.entryFee]);

  const handleSubmit = async () => {
    if (!paymentSS || !bgmiSS) { alert('Please upload both screenshots!'); return; }
    if (!upiId.trim()) { alert('Please enter your UPI ID!'); return; }
    setLoading(true);
    try {
      const result = await registerPlayer(match.id, bgmiName, charId, upiId);
      if (!result.success) { alert(result.message); setLoading(false); return; }
      setSlotNumber(result.slotNumber || 0);
      if (currentUser) {
        await updateUserProfile(currentUser.id, { bgmiName, characterId: charId, upiId });
      }
      await sendRegistrationToTelegram({
        bgmiName, characterId: charId, upiId,
        matchName: match.name, matchTime: match.time,
        slotNumber: result.slotNumber || 0,
        paymentScreenshot: paymentSS, bgmiScreenshot: bgmiSS
      });
      if (soundEnabled) playSound('success');
      setStep(5);
    } catch { alert('Error! Try again.'); }
    setLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${getMapColor(match.map)}20, transparent)` }}>
          <div>
            <h2 className="text-white font-black text-lg">{match.name}</h2>
            <p className="text-gray-400 text-xs">🏆 Prize: ₹{prize} · 🎫 Entry: ₹{match.entryFee}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center">✕</button>
        </div>

        {/* Step Indicator */}
        {step < 5 && (
          <div className="flex items-center justify-center gap-2 p-4">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-400'}`}>{s}</div>
                {s < 4 && <div className={`w-8 h-0.5 ${step > s ? 'bg-red-600' : 'bg-gray-700'}`} />}
              </div>
            ))}
          </div>
        )}

        <div className="p-4">
          {/* Step 1: Rules */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-center text-lg">📋 Tournament Rules</h3>
              {['📸 Result screenshot is COMPULSORY', '🚫 No hacks or cheats allowed', '🛡️ Anti-cheat system is ACTIVE', '👮 Admin will kick unauthorized players', '💰 Prizes paid to registered UPI ID', '⚠️ Fake ID = Permanent ban'].map(rule => (
                <div key={rule} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                  <span className="text-sm text-gray-300">{rule}</span>
                </div>
              ))}
              <label className="flex items-center gap-3 p-3 bg-red-600/10 border border-red-600/30 rounded-lg cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="w-4 h-4 accent-red-600" />
                <span className="text-white text-sm font-semibold">I Agree to all rules</span>
              </label>
              <button disabled={!agreed} onClick={() => { if (soundEnabled) playSound('click'); setStep(2); }}
                className="w-full py-3 bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl hover:bg-red-700 transition-colors">
                Continue →
              </button>
            </div>
          )}

          {/* Step 2: Player Details */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-center text-lg">🎮 Player Details</h3>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">BGMI Name *</label>
                <input value={bgmiName} onChange={e => setBgmiName(e.target.value)} placeholder="Enter your BGMI name"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Character ID * (8-12 digits)</label>
                <input value={charId} onChange={e => setCharId(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="Enter your BGMI Character ID"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
                {charId && (charId.length < 8 || charId.length > 12) && <p className="text-red-400 text-xs mt-1">⚠️ Must be 8-12 digits</p>}
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">UPI ID * (for prize)</label>
                <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="your-upi@bank"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">📸 BGMI Profile Screenshot *</label>
                <label className="w-full p-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-gray-400 text-sm cursor-pointer hover:border-red-500 transition-colors flex items-center justify-center gap-2">
                  {bgmiSS ? <><span className="text-green-400">✅</span> {bgmiSS.name}</> : <><span>📁</span> Upload BGMI Screenshot</>}
                  <input type="file" accept="image/*" className="hidden" onChange={e => setBgmiSS(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-xl hover:bg-gray-600">← Back</button>
                <button onClick={() => {
                  if (!bgmiName.trim()) { alert('Enter BGMI Name!'); return; }
                  if (charId.length < 8 || charId.length > 12) { alert('Character ID must be 8-12 digits!'); return; }
                  if (!upiId.trim()) { alert('Enter UPI ID!'); return; }
                  if (!bgmiSS) { alert('Upload BGMI screenshot!'); return; }
                  if (soundEnabled) playSound('click'); setStep(3);
                }} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Next →</button>
              </div>
            </div>
          )}

          {/* Step 3: Coupon */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-center text-lg">🎫 Entry Fee</h3>
              {currentUser && currentUser.couponBalance > 0 && (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={applyCoupon} onChange={e => setApplyCoupon(e.target.checked)} className="w-4 h-4 accent-yellow-500" />
                    <div>
                      <p className="text-yellow-400 font-bold text-sm">💰 Use Coupon Balance</p>
                      <p className="text-gray-400 text-xs">Available: ₹{currentUser.couponBalance} · Save ₹{couponAmount}</p>
                    </div>
                  </label>
                </div>
              )}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Entry Fee</span>
                  <span className="text-white">₹{match.entryFee}</span>
                </div>
                {applyCoupon && <div className="flex justify-between mb-2">
                  <span className="text-gray-400">Coupon Discount</span>
                  <span className="text-green-400">-₹{couponAmount}</span>
                </div>}
                <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                  <span className="text-white font-bold">Pay via UPI</span>
                  <span className="text-red-400 font-black text-xl">₹{match.entryFee - (applyCoupon ? couponAmount : 0)}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-xl hover:bg-gray-600">← Back</button>
                <button onClick={() => { if (soundEnabled) playSound('click'); setStep(4); }} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Next →</button>
              </div>
            </div>
          )}

          {/* Step 4: Payment */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-white font-bold text-center text-lg">💳 Payment</h3>
              {!timedOut ? (
                <>
                  <div className="text-center p-4 bg-red-600/10 border border-red-600/30 rounded-xl">
                    <p className="text-red-400 font-black text-3xl font-mono">⏱️ {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}</p>
                    <p className="text-gray-400 text-xs mt-1">Complete payment before timer ends!</p>
                    <div className="h-1.5 bg-gray-700 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-red-600 rounded-full transition-all" style={{ width: `${(timer / 300) * 100}%` }} />
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                    <p className="text-gray-400 text-xs mb-1">Pay ₹{match.entryFee - (applyCoupon ? couponAmount : 0)} to UPI:</p>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-bold text-lg flex-1">liju21977@okicici</p>
                      <button onClick={() => { navigator.clipboard.writeText('liju21977@okicici'); if (soundEnabled) playSound('success'); }}
                        className="px-3 py-1 bg-blue-600/20 border border-blue-600/30 text-blue-400 text-xs rounded-lg">📋 Copy</button>
                    </div>
                    {match.qrCode && (
                      <div className="mt-3 flex justify-center">
                        <img src={match.qrCode} alt="QR Code" className="w-40 h-40 rounded-xl object-cover border border-white/20" />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">📸 Payment Screenshot *</label>
                    <label className="w-full p-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-gray-400 text-sm cursor-pointer hover:border-red-500 transition-colors flex items-center justify-center gap-2">
                      {paymentSS ? <><span className="text-green-400">✅</span> {paymentSS.name}</> : <><span>📁</span> Upload Payment Screenshot</>}
                      <input type="file" accept="image/*" className="hidden" onChange={e => setPaymentSS(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(3)} className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-xl">← Back</button>
                    <button onClick={handleSubmit} disabled={loading || !paymentSS}
                      className="flex-1 py-3 bg-red-600 disabled:opacity-50 text-white font-bold rounded-xl hover:bg-red-700">
                      {loading ? '⏳ Submitting...' : '✅ Submit'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-6xl mb-4">⏰</p>
                  <p className="text-white font-bold text-xl mb-2">Time's Up!</p>
                  <p className="text-gray-400 mb-6">Payment time expired. Please try again.</p>
                  <button onClick={() => { setTimer(300); setTimedOut(false); }} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl">🔄 Try Again</button>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Success */}
          {step === 5 && (
            <div className="text-center py-8 space-y-4">
              <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }} className="text-8xl">🎉</motion.p>
              <h3 className="text-white font-black text-2xl">Registration Done!</h3>
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-green-400 font-bold text-lg">Your Slot: #{slotNumber}</p>
                <p className="text-gray-400 text-sm mt-1">Admin will verify your payment</p>
                <p className="text-gray-400 text-sm">Room ID will be visible after verification</p>
              </div>
              <p className="text-gray-400 text-sm">Join Telegram for updates!</p>
              <div className="flex gap-3">
                <button onClick={() => window.open('https://t.me/pampa_ji_op')} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl">✈️ Join Telegram</button>
                <button onClick={onClose} className="flex-1 py-3 bg-gray-700 text-white font-bold rounded-xl">Close</button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
function HomePage() {
  const { matches, currentUser } = useStore();
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [mapFilter, setMapFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('open');
  const scrollY = useRef(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      scrollY.current = window.scrollY;
      if (heroRef.current) {
        heroRef.current.style.transform = `translateY(${scrollY.current * 0.4}px)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = matches.filter(m => {
    if (tab === 'live' && m.status !== 'live') return false;
    if (tab === 'open' && m.status !== 'open') return false;
    if (tab === 'done' && m.status !== 'done') return false;
    if (mapFilter !== 'all' && m.map !== mapFilter) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.map.toLowerCase().includes(search.toLowerCase()) && !m.type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPrize = matches.reduce((sum, m) => sum + getPrize(m), 0);
  const totalPlayers = matches.reduce((sum, m) => sum + m.registeredPlayers, 0);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <div className="relative h-screen flex items-center justify-center overflow-hidden">
        <div ref={heroRef} className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1920&q=80)', filter: 'brightness(0.3)' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black" />
        <div className="relative z-10 text-center px-4">
          <motion.div initial={{ opacity: 0, y: -30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
            <p className="text-red-500 text-sm font-bold tracking-widest mb-4 uppercase">🎮 India's #1 BGMI Tournament Platform</p>
            <h1 className="text-6xl md:text-8xl font-black mb-4 leading-none" style={{ fontFamily: 'Orbitron, monospace', textShadow: '0 0 60px #dc2626' }}>
              <span className="bg-gradient-to-r from-red-500 via-orange-400 to-red-500 bg-clip-text text-transparent">JEETO</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 font-light">Win Real Cash in BGMI Tournaments</p>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-6 flex-wrap">
            {[
              { label: 'Active Matches', value: matches.filter(m => m.status === 'open').length, icon: '🎮' },
              { label: 'Total Players', value: totalPlayers, icon: '👥' },
              { label: 'Prize Pool', value: `₹${totalPrize.toLocaleString()}`, icon: '💰' },
            ].map(stat => (
              <div key={stat.label} className="text-center px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl">
                <p className="text-3xl mb-1">{stat.icon}</p>
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="text-gray-400 text-xs">{stat.label}</p>
              </div>
            ))}
          </motion.div>

          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            onClick={() => document.getElementById('matches')?.scrollIntoView({ behavior: 'smooth' })}
            className="mt-8 px-8 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white font-black rounded-2xl text-lg hover:from-red-500 hover:to-orange-500 transition-all shadow-lg shadow-red-600/30 hover:shadow-red-600/50 hover:scale-105 transform">
            🎮 View Tournaments
          </motion.button>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-gray-400 text-2xl">↓</div>
      </div>

      {/* How It Works */}
      <section className="py-20 px-4 bg-gradient-to-b from-black to-gray-950">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center text-white mb-12" style={{ fontFamily: 'Orbitron, monospace' }}>HOW IT WORKS</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '1', icon: '📋', title: 'Read Rules', desc: 'Agree to fair play rules' },
              { step: '2', icon: '📝', title: 'Register', desc: 'Enter BGMI name & Character ID' },
              { step: '3', icon: '💳', title: 'Pay ₹20', desc: 'Pay entry fee via UPI' },
              { step: '4', icon: '🏆', title: 'Win Prize', desc: 'Play & win real cash!' },
            ].map(item => (
              <motion.div key={item.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="text-center p-6 bg-white/5 border border-white/10 rounded-2xl hover:border-red-500/50 transition-all group">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-black mx-auto mb-3 group-hover:scale-110 transition-transform">{item.step}</div>
                <p className="text-4xl mb-3">{item.icon}</p>
                <h3 className="text-white font-bold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-10 px-4 bg-gray-950">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: '🛡️', title: '100% Secure', desc: 'Verified payments' },
            { icon: '🔒', title: 'Private Rooms', desc: 'Only verified players' },
            { icon: '⚡', title: 'Fast Verify', desc: 'Quick admin approval' },
            { icon: '💰', title: 'Real Prizes', desc: 'Cash to winners' },
          ].map(badge => (
            <motion.div key={badge.title} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
              className="text-center p-4 bg-white/5 border border-white/10 rounded-xl hover:border-red-500/30 transition-all">
              <p className="text-3xl mb-2">{badge.icon}</p>
              <p className="text-white font-bold text-sm">{badge.title}</p>
              <p className="text-gray-500 text-xs">{badge.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Matches */}
      <section id="matches" className="py-20 px-4 bg-black">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-black text-center text-white mb-8" style={{ fontFamily: 'Orbitron, monospace' }}>TOURNAMENTS</h2>
          
          {/* Search */}
          <div className="max-w-md mx-auto mb-6">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search matches..."
              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
            {['open', 'live', 'done'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all capitalize ${tab === t ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {t === 'open' ? '🟢 Open' : t === 'live' ? '🔴 Live' : '✅ Done'} ({matches.filter(m => m.status === t).length})
              </button>
            ))}
          </div>

          {/* Map Filter */}
          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {['all', 'Erangel', 'Miramar', 'Sanhok', 'Livik', 'TDM'].map(m => (
              <button key={m} onClick={() => setMapFilter(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mapFilter === m ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {m === 'all' ? '🎮 All' : `${getMapEmoji(m)} ${m}`}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-6xl mb-4">🎮</p>
              <p className="text-gray-400 text-xl">No matches found</p>
              <p className="text-gray-600 text-sm mt-2">Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(m => (
                <MatchCard key={m.id} match={m} onRegister={(match) => {
                  if (!currentUser) { useStore.getState().setPage('login'); return; }
                  setSelectedMatch(match);
                }} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Winners Gallery */}
      <section className="py-20 px-4 bg-gray-950">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center text-white mb-12" style={{ fontFamily: 'Orbitron, monospace' }}>PAST WINNERS</h2>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {['SHADOW_KILLER', 'PRO_SNIPER', 'RUSH_MASTER', 'ALPHA_GAMER', 'BEAST_MODE', 'NINJA_PRO'].map((name, i) => (
              <div key={name} className="flex-shrink-0 w-48 p-4 bg-gradient-to-b from-yellow-900/30 to-gray-900 border border-yellow-500/30 rounded-2xl text-center">
                <p className="text-4xl mb-2">{['🥇', '🥈', '🥉', '🏅', '🏅', '🏅'][i]}</p>
                <p className="text-white font-bold text-sm">{name}</p>
                <p className="text-yellow-400 font-black text-lg">₹{[400, 300, 500, 200, 350, 450][i]}</p>
                <p className="text-gray-500 text-xs">{['Erangel Solo', 'Miramar Duo', 'Sanhok Squad', 'Livik Solo', 'TDM', 'Erangel Solo'][i]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-black">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center text-white mb-12" style={{ fontFamily: 'Orbitron, monospace' }}>PLAYER REVIEWS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { name: 'Rahul M.', text: 'Won ₹400 in my first match! Super legit platform.', rating: 5 },
              { name: 'Priya S.', text: 'Fast payment, great admin support. Highly recommended!', rating: 5 },
              { name: 'Arjun K.', text: 'Best BGMI tournament platform. Fair and transparent.', rating: 4 },
              { name: 'Sneha R.', text: 'Room ID on time, prize credited instantly. Love it!', rating: 5 },
            ].map(t => (
              <motion.div key={t.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="p-5 bg-white/5 border border-white/10 rounded-2xl hover:border-white/20 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">{t.name[0]}</div>
                  <div>
                    <p className="text-white font-bold text-sm">{t.name}</p>
                    <p className="text-yellow-400 text-xs">{'⭐'.repeat(t.rating)}</p>
                  </div>
                </div>
                <p className="text-gray-300 text-sm italic">"{t.text}"</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-gray-950">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-center text-white mb-12" style={{ fontFamily: 'Orbitron, monospace' }}>FAQ</h2>
          {[
            { q: 'How do I register?', a: 'Click "Register Now" on any open match, agree to rules, fill your details, pay ₹20 via UPI, and upload screenshot.' },
            { q: 'How are prizes distributed?', a: 'Admin manually sends prize money to your registered UPI ID after match results are verified.' },
            { q: 'When will I get Room ID?', a: 'After admin verifies your payment, Room ID appears on the match card.' },
            { q: 'What if I face issues?', a: 'Contact support via the Support page or email us at shontyvishwakarma@gmail.com' },
            { q: 'Is my payment safe?', a: 'Yes! We use UPI for payments. Only pay after seeing the official UPI ID.' },
          ].map((faq, i) => {
            const [open, setOpen] = useState(false);
            return (
              <div key={i} className="mb-3 border border-white/10 rounded-xl overflow-hidden">
                <button onClick={() => setOpen(!open)} className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-all">
                  <span className="text-white font-semibold text-sm">{faq.q}</span>
                  <span className="text-gray-400 text-xl transform transition-transform" style={{ transform: open ? 'rotate(45deg)' : 'none' }}>+</span>
                </button>
                <AnimatePresence>
                  {open && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                      <p className="p-4 pt-0 text-gray-400 text-sm">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      {selectedMatch && (
        <AnimatePresence>
          <RegistrationModal match={selectedMatch} onClose={() => { setSelectedMatch(null); }} />
        </AnimatePresence>
      )}
      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function AuthPage() {
  const { loginUser, signupUser, setPage, soundEnabled } = useStore();
  const [mode, setMode] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bgmiName, setBgmiName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) { setError('Fill all fields!'); return; }
    setLoading(true); setError('');
    const r = await loginUser(email, password);
    if (r.success) { if (soundEnabled) playSound('success'); setPage('profile'); }
    else { setError(r.message); if (soundEnabled) playSound('error'); }
    setLoading(false);
  };

  const handleSignup = async () => {
    if (!email || !password || !displayName || !bgmiName) { setError('Fill all required fields!'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters!'); return; }
    setLoading(true); setError('');
    const r = await signupUser({ email, password, displayName, bgmiName });
    if (r.success) { if (soundEnabled) playSound('success'); setMode('login'); setError(''); }
    else { setError(r.message); if (soundEnabled) playSound('error'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 pt-20">
      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">
          {mode === 'welcome' && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="text-center space-y-6">
              <p className="text-7xl">🎮</p>
              <h1 className="text-3xl font-black text-white" style={{ fontFamily: 'Orbitron, monospace' }}>Welcome!</h1>
              <p className="text-gray-400">Login or create account to join tournaments</p>
              <div className="space-y-3">
                <button onClick={() => setMode('login')} className="w-full py-4 bg-gradient-to-r from-red-600 to-red-500 text-white font-black rounded-2xl text-lg hover:from-red-500 hover:to-orange-500 transition-all">
                  🔐 Login
                </button>
                <button onClick={() => setMode('signup')} className="w-full py-4 bg-white/5 border border-white/20 text-white font-black rounded-2xl text-lg hover:bg-white/10 transition-all">
                  ✨ Create Account
                </button>
              </div>
              <button onClick={() => setPage('home')} className="text-gray-500 text-sm hover:text-gray-300">← Back to Home</button>
            </motion.div>
          )}

          {mode === 'login' && (
            <motion.div key="login" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
              className="space-y-4">
              <div className="text-center mb-6">
                <p className="text-5xl mb-3">🔐</p>
                <h2 className="text-2xl font-black text-white">Login</h2>
              </div>
              {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
                className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
              <div className="relative">
                <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type={showPass ? 'text' : 'password'}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 pr-12" />
                <button onClick={() => setShowPass(!showPass)} className="absolute right-4 top-4 text-gray-400 hover:text-white">{showPass ? '🙈' : '👁️'}</button>
              </div>
              <button onClick={handleLogin} disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-red-500 text-white font-black rounded-2xl text-lg disabled:opacity-50 hover:from-red-500 hover:to-orange-500 transition-all">
                {loading ? '⏳ Logging in...' : '🔐 Login'}
              </button>
              <div className="flex gap-3">
                <button onClick={() => { setMode('welcome'); setError(''); }} className="flex-1 py-3 bg-gray-800 text-gray-400 font-bold rounded-xl hover:bg-gray-700">← Back</button>
                <button onClick={() => { setMode('signup'); setError(''); }} className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-300 font-bold rounded-xl hover:bg-white/10">Sign Up</button>
              </div>
            </motion.div>
          )}

          {mode === 'signup' && (
            <motion.div key="signup" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
              className="space-y-4">
              <div className="text-center mb-6">
                <p className="text-5xl mb-3">✨</p>
                <h2 className="text-2xl font-black text-white">Create Account</h2>
              </div>
              {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}
              {[
                { value: displayName, set: setDisplayName, placeholder: 'Display Name *', type: 'text' },
                { value: bgmiName, set: setBgmiName, placeholder: 'BGMI Name *', type: 'text' },
                { value: email, set: setEmail, placeholder: 'Email *', type: 'email' },
                { value: password, set: setPassword, placeholder: 'Password * (min 6 chars)', type: showPass ? 'text' : 'password' },
              ].map((field, i) => (
                <input key={i} value={field.value} onChange={e => field.set(e.target.value)} placeholder={field.placeholder} type={field.type}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
              ))}
              <button onClick={handleSignup} disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-red-500 text-white font-black rounded-2xl text-lg disabled:opacity-50">
                {loading ? '⏳ Creating...' : '✨ Create Account'}
              </button>
              <div className="flex gap-3">
                <button onClick={() => { setMode('welcome'); setError(''); }} className="flex-1 py-3 bg-gray-800 text-gray-400 font-bold rounded-xl">← Back</button>
                <button onClick={() => { setMode('login'); setError(''); }} className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-300 font-bold rounded-xl">Login</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────
function ProfilePage() {
  const { currentUser, logoutUser, setPage, matches, updateUserProfile, submitWithdrawal, submitAddCash, soundEnabled } = useStore();
  const [tab, setTab] = useState('overview');
  const [editing, setEditing] = useState(false);
  const [bgmiName, setBgmiName] = useState(currentUser?.bgmiName || '');
  const [upiId, setUpiId] = useState(currentUser?.upiId || '');
  const [addAmount, setAddAmount] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [addSS, setAddSS] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  if (!currentUser) { setPage('login'); return null; }

  const myMatches = matches.filter(m => m.players.some(p => p.bgmiName === currentUser.bgmiName));

  const handleAddCash = async () => {
    if (!addAmount || addAmount < 10) { alert('Minimum ₹10!'); return; }
    if (!addSS) { alert('Upload payment screenshot!'); return; }
    setLoading(true);
    await sendAddCashToTelegram({ userName: currentUser.displayName, email: currentUser.email, bgmiName: currentUser.bgmiName, amount: addAmount, screenshot: addSS });
    await submitAddCash(currentUser.id, currentUser.displayName, currentUser.email, currentUser.bgmiName, addAmount);
    if (soundEnabled) playSound('success');
    alert('Add cash request submitted! Admin will verify and credit soon.');
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || withdrawAmount < 50) { alert('Minimum withdrawal ₹50!'); return; }
    if (withdrawAmount > currentUser.walletBalance) { alert('Insufficient balance!'); return; }
    if (!currentUser.upiId) { alert('Add UPI ID first!'); return; }
    setLoading(true);
    await submitWithdrawal(currentUser.id, currentUser.displayName, currentUser.email, currentUser.bgmiName, currentUser.upiId, withdrawAmount);
    if (soundEnabled) playSound('success');
    alert('Withdrawal request submitted! Admin will process soon.');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-24 px-4">
      <div className="max-w-lg mx-auto">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-gradient-to-br from-red-900/30 to-gray-900 border border-red-500/20 rounded-2xl mb-6 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-red-600 to-orange-500 rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-4">
            {currentUser.displayName[0].toUpperCase()}
          </div>
          <h2 className="text-2xl font-black text-white">{currentUser.displayName}</h2>
          <p className="text-gray-400 text-sm">{currentUser.email}</p>
          <p className="text-gray-400 text-sm">🎮 {currentUser.bgmiName || 'No BGMI Name'}</p>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="text-center">
              <p className="text-xl font-black text-green-400">₹{currentUser.walletBalance || 0}</p>
              <p className="text-gray-500 text-xs">Wallet</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-yellow-400">₹{currentUser.couponBalance || 0}</p>
              <p className="text-gray-500 text-xs">Coupon</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-black text-blue-400">{currentUser.totalMatches || 0}</p>
              <p className="text-gray-500 text-xs">Matches</p>
            </div>
          </div>
          <button onClick={() => { logoutUser(); setPage('home'); }} className="mt-4 px-6 py-2 bg-red-600/20 border border-red-600/30 text-red-400 rounded-xl text-sm font-bold hover:bg-red-600/30">🚪 Logout</button>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['overview', 'history', 'wallet', 'referral', 'achievements'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${tab === t ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {!editing ? (
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-white font-bold">Profile Details</h3>
                  <button onClick={() => setEditing(true)} className="text-red-400 text-sm hover:text-red-300">✏️ Edit</button>
                </div>
                {[
                  { label: 'BGMI Name', value: currentUser.bgmiName || '—' },
                  { label: 'Character ID', value: currentUser.characterId || '—' },
                  { label: 'UPI ID', value: currentUser.upiId || '—' },
                  { label: 'Referral Code', value: currentUser.referralCode || '—' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-gray-400 text-sm">{item.label}</span>
                    <span className="text-white text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                <h3 className="text-white font-bold">Edit Profile</h3>
                <input value={bgmiName} onChange={e => setBgmiName(e.target.value)} placeholder="BGMI Name"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm" />
                <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="UPI ID"
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm" />
                <div className="flex gap-3">
                  <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-gray-700 text-white rounded-xl text-sm">Cancel</button>
                  <button onClick={async () => { await updateUserProfile(currentUser.id, { bgmiName, upiId }); setEditing(false); if (soundEnabled) playSound('success'); }}
                    className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-bold">Save</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {tab === 'history' && (
          <div className="space-y-3">
            {myMatches.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-5xl mb-3">🎮</p>
                <p>No matches played yet!</p>
              </div>
            ) : myMatches.map(m => {
              const mySlot = m.players.find(p => p.bgmiName === currentUser.bgmiName);
              return (
                <div key={m.id} className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-bold text-sm">{m.name}</p>
                      <p className="text-gray-400 text-xs">{m.date} · {m.time}</p>
                      {mySlot && <p className="text-blue-400 text-xs mt-1">Slot #{mySlot.slotNumber}</p>}
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-bold ${m.status === 'done' ? 'bg-gray-500/20 text-gray-400' : m.status === 'live' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                      {m.status === 'done' ? '✅' : m.status === 'live' ? '🔴' : '🟢'} {m.status}
                    </span>
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span>Entry: ₹{m.entryFee}</span>
                    <span>Prize: ₹{getPrize(m)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Wallet */}
        {tab === 'wallet' && (
          <div className="space-y-4">
            <div className="p-6 bg-gradient-to-br from-green-900/30 to-gray-900 border border-green-500/20 rounded-2xl text-center">
              <p className="text-gray-400 text-sm mb-1">Wallet Balance</p>
              <p className="text-5xl font-black text-green-400">₹{currentUser.walletBalance || 0}</p>
            </div>
            {/* Add Cash */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <h3 className="text-white font-bold">➕ Add Cash</h3>
              <div className="grid grid-cols-4 gap-2">
                {[50, 100, 200, 500].map(amt => (
                  <button key={amt} onClick={() => setAddAmount(amt)} className={`py-2 rounded-lg text-sm font-bold transition-all ${addAmount === amt ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>₹{amt}</button>
                ))}
              </div>
              <input value={addAmount || ''} onChange={e => setAddAmount(Number(e.target.value))} placeholder="Custom amount" type="number"
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm" />
              <p className="text-gray-400 text-xs">Pay to UPI: <span className="text-white font-bold">liju21977@okicici</span></p>
              <label className="w-full p-3 bg-white/5 border border-dashed border-white/20 rounded-xl text-gray-400 text-sm cursor-pointer hover:border-red-500 flex items-center justify-center gap-2">
                {addSS ? <><span className="text-green-400">✅</span> {addSS.name}</> : <><span>📁</span> Upload Payment Screenshot</>}
                <input type="file" accept="image/*" className="hidden" onChange={e => setAddSS(e.target.files?.[0] || null)} />
              </label>
              <button onClick={handleAddCash} disabled={loading} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl disabled:opacity-50 hover:bg-green-700">
                {loading ? '⏳...' : '➕ Request Add Cash'}
              </button>
            </div>
            {/* Withdraw */}
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
              <h3 className="text-white font-bold">💸 Withdraw</h3>
              <p className="text-gray-400 text-xs">UPI: <span className="text-white">{currentUser.upiId || 'Add UPI in Overview'}</span></p>
              <input value={withdrawAmount || ''} onChange={e => setWithdrawAmount(Number(e.target.value))} placeholder="Amount (min ₹50)" type="number"
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm" />
              <button onClick={handleWithdraw} disabled={loading} className="w-full py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50 hover:bg-red-700">
                {loading ? '⏳...' : '💸 Request Withdrawal'}
              </button>
            </div>
          </div>
        )}

        {/* Referral */}
        {tab === 'referral' && (
          <div className="space-y-4">
            <div className="p-6 bg-gradient-to-br from-yellow-900/30 to-gray-900 border border-yellow-500/20 rounded-2xl text-center">
              <p className="text-5xl mb-3">🎯</p>
              <h3 className="text-white font-bold text-xl mb-2">Your Referral Code</h3>
              <p className="text-3xl font-black text-yellow-400 mb-3">{currentUser.referralCode}</p>
              <button onClick={() => { navigator.clipboard.writeText(`Join JEETO BGMI Tournaments! Use my referral code: ${currentUser.referralCode} and get ₹10 bonus! https://jeeto-bgmi.vercel.app`); if (soundEnabled) playSound('success'); }}
                className="px-6 py-3 bg-yellow-600 text-white font-bold rounded-xl hover:bg-yellow-700">📋 Copy Link</button>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
              <h3 className="text-white font-bold mb-3">How Referral Works</h3>
              {[
                '1. Share your referral code with friends',
                '2. Friend signs up using your code',
                '3. You get ₹10 coupon credit!',
                '4. Friend gets ₹10 welcome bonus!',
                '5. Use coupons to reduce entry fee',
              ].map(step => (
                <p key={step} className="text-gray-400 text-sm py-2 border-b border-white/5">{step}</p>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        {tab === 'achievements' && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🌟', name: 'First Steps', desc: 'Play 1 match', earned: (currentUser.totalMatches || 0) >= 1 },
              { icon: '🎮', name: 'Regular', desc: 'Play 5 matches', earned: (currentUser.totalMatches || 0) >= 5 },
              { icon: '⚡', name: 'Pro Gamer', desc: 'Play 10 matches', earned: (currentUser.totalMatches || 0) >= 10 },
              { icon: '🏅', name: 'Veteran', desc: 'Play 25 matches', earned: (currentUser.totalMatches || 0) >= 25 },
              { icon: '✅', name: 'Verified', desc: 'Get verified once', earned: (currentUser.totalMatches || 0) >= 1 },
              { icon: '🤝', name: 'Social', desc: 'Refer 3 friends', earned: false },
              { icon: '💎', name: 'Top Earner', desc: 'Win ₹1000+', earned: (currentUser.totalWinnings || 0) >= 1000 },
              { icon: '🏆', name: 'Champion', desc: 'Win 5 prizes', earned: false },
            ].map(a => (
              <div key={a.name} className={`p-4 rounded-xl border text-center transition-all ${a.earned ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/10 opacity-50'}`}>
                <p className="text-4xl mb-2">{a.icon}</p>
                <p className={`font-bold text-sm ${a.earned ? 'text-yellow-400' : 'text-gray-400'}`}>{a.name}</p>
                <p className="text-gray-500 text-xs">{a.desc}</p>
                {a.earned && <p className="text-green-400 text-xs mt-1">✅ Unlocked!</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function LeaderboardPage() {
  const { matches } = useStore();
  const players: Record<string, { name: string; matches: number; verified: number }> = {};
  matches.forEach(m => (m.players || []).forEach(p => {
    if (!players[p.bgmiName]) players[p.bgmiName] = { name: p.bgmiName, matches: 0, verified: 0 };
    players[p.bgmiName].matches++;
    if (p.verified) players[p.bgmiName].verified++;
  }));
  const sorted = Object.values(players).sort((a, b) => b.matches - a.matches).slice(0, 20);

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-24 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-black text-center mb-8" style={{ fontFamily: 'Orbitron, monospace', textShadow: '0 0 20px #dc2626' }}>🏆 LEADERBOARD</h1>
        {sorted.length === 0 ? (
          <div className="text-center py-20 text-gray-500"><p className="text-5xl mb-3">🏆</p><p>No players yet!</p></div>
        ) : (
          <>
            {/* Podium */}
            {sorted.length >= 3 && (
              <div className="flex items-end justify-center gap-4 mb-8">
                {[{ p: sorted[1], rank: 2, height: 'h-24', icon: '🥈', color: '#94a3b8' },
                  { p: sorted[0], rank: 1, height: 'h-32', icon: '🥇', color: '#f59e0b' },
                  { p: sorted[2], rank: 3, height: 'h-20', icon: '🥉', color: '#b45309' }
                ].map(item => (
                  <div key={item.rank} className="flex flex-col items-center">
                    <p className="text-2xl mb-1">{item.icon}</p>
                    <div className={`${item.height} w-24 rounded-t-xl flex items-center justify-center border`} style={{ background: `${item.color}20`, borderColor: `${item.color}50` }}>
                      <div className="text-center p-2">
                        <p className="text-xs font-bold" style={{ color: item.color }}>{item.p.name.slice(0, 8)}</p>
                        <p className="text-gray-400 text-xs">{item.p.matches} matches</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {/* List */}
            <div className="space-y-2">
              {sorted.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all">
                  <span className="text-gray-400 font-bold w-6 text-sm">#{i + 1}</span>
                  <div className="w-8 h-8 bg-gradient-to-br from-red-600 to-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">{p.name[0]}</div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{p.name}</p>
                    <p className="text-gray-500 text-xs">{p.matches} matches · {p.verified} verified</p>
                  </div>
                  {i < 3 && <span>{['🥇', '🥈', '🥉'][i]}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── WINNERS PAGE ─────────────────────────────────────────────────────────────
function WinnersPage() {
  const { matches } = useStore();
  const completed = matches.filter(m => m.status === 'done' && (m.winners?.first || m.winners?.second));

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-24 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-black text-center mb-8" style={{ fontFamily: 'Orbitron, monospace', textShadow: '0 0 20px #f59e0b' }}>🏅 WINNERS</h1>
        {completed.length === 0 ? (
          <div className="text-center py-20 text-gray-500"><p className="text-5xl mb-3">🏆</p><p>No winners announced yet!</p></div>
        ) : (
          <div className="space-y-6">
            {completed.map(m => {
              const prize = getPrize(m);
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className={`p-5 bg-gradient-to-br ${getMapGradient(m.map)} border border-white/10 rounded-2xl`}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-white font-black text-lg">{m.name}</p>
                      <p className="text-gray-400 text-xs">{m.date} · {m.time}</p>
                    </div>
                    <p className="text-yellow-400 font-black text-xl">₹{prize}</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { icon: '🥇', name: m.winners?.first, prize: m.prizeFirst || Math.floor(prize * 0.5), color: '#f59e0b' },
                      { icon: '🥈', name: m.winners?.second, prize: m.prizeSecond || Math.floor(prize * 0.3), color: '#94a3b8' },
                      { icon: '🥉', name: m.winners?.third, prize: m.prizeThird || Math.floor(prize * 0.2), color: '#b45309' },
                    ].filter(w => w.name).map(w => (
                      <div key={w.icon} className="flex items-center gap-3 p-3 bg-black/30 rounded-xl">
                        <span className="text-2xl">{w.icon}</span>
                        <span className="text-white font-bold flex-1">{w.name}</span>
                        <span className="font-black" style={{ color: w.color }}>₹{w.prize}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── RESULTS PAGE ─────────────────────────────────────────────────────────────
function ResultsPage() {
  const { matches, currentUser, setPage } = useStore();
  const [selectedMatch, setSelectedMatch] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  if (!currentUser) return (
    <div className="min-h-screen bg-black text-white pt-20 flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl mb-4">📸</p>
        <p className="text-xl text-gray-400 mb-6">Login to submit results</p>
        <button onClick={() => setPage('login')} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl">Login</button>
      </div>
    </div>
  );

  const myMatches = matches.filter(m => m.players.some(p => p.bgmiName === currentUser.bgmiName) && m.status === 'done');

  const handleSubmit = async () => {
    if (!selectedMatch || !screenshot) { alert('Select match and upload screenshot!'); return; }
    const match = matches.find(m => m.id === selectedMatch);
    if (!match) return;
    setLoading(true);
    await sendResultToTelegram({ bgmiName: currentUser.bgmiName, matchName: match.name, screenshot });
    alert('Result submitted! Admin will verify.');
    setScreenshot(null); setSelectedMatch('');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-24 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-black text-center mb-8" style={{ fontFamily: 'Orbitron, monospace' }}>📸 SUBMIT RESULT</h1>
        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
          {myMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-5xl mb-3">📸</p>
              <p>No completed matches to submit results for!</p>
            </div>
          ) : (
            <>
              <select value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500">
                <option value="">Select Match</option>
                {myMatches.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <label className="w-full p-4 bg-white/5 border border-dashed border-white/20 rounded-xl text-gray-400 cursor-pointer hover:border-red-500 flex items-center justify-center gap-2">
                {screenshot ? <><span className="text-green-400">✅</span> {screenshot.name}</> : <><span>📁</span> Upload Result Screenshot</>}
                <input type="file" accept="image/*" className="hidden" onChange={e => setScreenshot(e.target.files?.[0] || null)} />
              </label>
              <button onClick={handleSubmit} disabled={loading || !selectedMatch || !screenshot}
                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50 hover:bg-red-700">
                {loading ? '⏳ Submitting...' : '📸 Submit Result'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SUPPORT PAGE ─────────────────────────────────────────────────────────────
function SupportPage() {
  const { currentUser, submitSupport, setPage } = useStore();
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [loading, setLoading] = useState(false);

  if (!currentUser) return (
    <div className="min-h-screen bg-black text-white pt-20 flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl mb-4">💬</p>
        <p className="text-xl text-gray-400 mb-6">Login to contact support</p>
        <button onClick={() => setPage('login')} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl">Login</button>
      </div>
    </div>
  );

  const handleSubmit = async () => {
    if (!category || !message || !email) { alert('Fill all fields!'); return; }
    setLoading(true);
    await sendSupportToTelegram({ userName: currentUser.displayName, bgmiName: currentUser.bgmiName, email, category, message });
    await submitSupport({ userId: currentUser.id, userName: currentUser.displayName, bgmiName: currentUser.bgmiName, email, category, message });
    alert('Support request sent! We will reply to your email soon.');
    setMessage(''); setCategory('');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white pt-20 pb-24 px-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-black text-center mb-8" style={{ fontFamily: 'Orbitron, monospace' }}>💬 SUPPORT</h1>
        <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4">
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500">
            <option value="">Select Category</option>
            <option>🏆 Prize not received</option>
            <option>💳 Payment issue</option>
            <option>🔑 Room ID not received</option>
            <option>🚫 Account banned</option>
            <option>⚠️ Match issue</option>
            <option>❓ Other</option>
          </select>
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Your email (for reply)" type="email"
            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue..." rows={5}
            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none" />
          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3 bg-red-600 text-white font-bold rounded-xl disabled:opacity-50 hover:bg-red-700">
            {loading ? '⏳ Sending...' : '📨 Send Message'}
          </button>
          <div className="text-center space-y-1">
            <p className="text-gray-500 text-xs">Or email directly:</p>
            <p className="text-blue-400 text-xs">shontyvishwakarma@gmail.com</p>
            <p className="text-blue-400 text-xs">liju9546@gmail.com</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
function AdminLoginPage() {
  const { loginAdmin, setPage, soundEnabled } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = () => {
    if (loginAdmin(email, password)) { if (soundEnabled) playSound('success'); setPage('admin'); }
    else { setError('Invalid credentials!'); if (soundEnabled) playSound('error'); }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm p-8 bg-gray-900 border border-red-500/20 rounded-2xl">
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">🔐</p>
          <h2 className="text-2xl font-black text-white" style={{ fontFamily: 'Orbitron, monospace' }}>ADMIN LOGIN</h2>
          <p className="text-gray-500 text-xs mt-1">Restricted access</p>
        </div>
        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm mb-4">{error}</div>}
        <div className="space-y-4">
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin Email" type="email"
            className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
          <div className="relative">
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type={showPass ? 'text' : 'password'}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              className="w-full p-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 pr-12" />
            <button onClick={() => setShowPass(!showPass)} className="absolute right-4 top-4 text-gray-400">{showPass ? '🙈' : '👁️'}</button>
          </div>
          <button onClick={handleLogin} className="w-full py-4 bg-gradient-to-r from-red-600 to-red-500 text-white font-black rounded-2xl hover:from-red-500 hover:to-orange-500">🔐 Login</button>
          <button onClick={() => setPage('home')} className="w-full py-3 bg-gray-800 text-gray-400 font-bold rounded-xl hover:bg-gray-700">← Back to Home</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel() {
  const { matches, logoutAdmin, setPage, createMatch, updateMatch, deleteMatch, verifyPlayer, banPlayer, approvePayment, rejectPayment, announceWinners, uploadQRCode, addCashRequests, withdrawalRequests, supportTickets, approveAddCash, rejectAddCash, approveWithdrawal, rejectWithdrawal, setBroadcast, clearBroadcast, broadcast } = useStore();
  const [tab, setTab] = useState('matches');
  const [newMatch, setNewMatch] = useState({ name: '', map: 'Erangel', type: 'Solo', date: '', time: '20:00', maxPlayers: 100, entryFee: 20 });
  const [selectedMatch, setSelectedMatch] = useState('');
  const [roomId, setRoomId] = useState('');
  const [roomPass, setRoomPass] = useState('');
  const [prizePool, setPrizePool] = useState(0);
  const [prize1, setPrize1] = useState(0);
  const [prize2, setPrize2] = useState(0);
  const [prize3, setPrize3] = useState(0);
  const [winner1, setWinner1] = useState('');
  const [winner2, setWinner2] = useState('');
  const [winner3, setWinner3] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastDuration, setBroadcastDuration] = useState(60);
  const [playerFilter, setPlayerFilter] = useState('all');
  const [qrFile, setQrFile] = useState<File | null>(null);
    const totalCollection = matches.reduce((s, m) => s + m.registeredPlayers * m.entryFee, 0);
  const pendingPayments = matches.flatMap(m => m.players.filter(p => p.paymentStatus === 'pending').map(p => ({ ...p, matchId: m.id, matchName: m.name })));
  const pendingAddCash = addCashRequests.filter(r => r.status === 'pending');
  const pendingWithdrawals = withdrawalRequests.filter(r => r.status === 'pending');

  const selectedMatchData = matches.find(m => m.id === selectedMatch);

  const handleCreateMatch = async () => {
    if (!newMatch.date || !newMatch.time) { alert('Fill date and time!'); return; }
    await createMatch(newMatch as any);
    alert('Match created!');
    setNewMatch({ name: '', map: 'Erangel', type: 'Solo', date: '', time: '20:00', maxPlayers: 100, entryFee: 20 });
  };

  const handleQRUpload = async (matchId: string) => {
    if (!qrFile) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      await uploadQRCode(matchId, e.target?.result as string);
      alert('QR uploaded!');
    };
    reader.readAsDataURL(qrFile);
  };

  const tabs = [
    { id: 'matches', label: '🎮 Matches' },
    { id: 'create', label: '➕ Create' },
    { id: 'players', label: `👥 Players` },
    { id: 'payments', label: `💳 Payments${pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ''}` },
    { id: 'addcash', label: `💰 Add Cash${pendingAddCash.length > 0 ? ` (${pendingAddCash.length})` : ''}` },
    { id: 'withdraw', label: `💸 Withdraw${pendingWithdrawals.length > 0 ? ` (${pendingWithdrawals.length})` : ''}` },
    { id: 'winners', label: '🏆 Winners' },
    { id: 'broadcast', label: '📢 Broadcast' },
    { id: 'support', label: `💬 Support${supportTickets.filter(t => t.status === 'open').length > 0 ? ` (${supportTickets.filter(t => t.status === 'open').length})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-10">
      {/* Admin Header */}
      <div className="sticky top-0 z-40 bg-gray-900 border-b border-white/10 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <span className="font-black text-white" style={{ fontFamily: 'Orbitron, monospace' }}>ADMIN PANEL</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPage('home')} className="px-3 py-1.5 bg-white/10 text-white text-xs rounded-lg hover:bg-white/20">🏠 Home</button>
            <button onClick={logoutAdmin} className="px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">🚪 Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Matches', value: matches.length, icon: '🎮', color: '#3b82f6' },
            { label: 'Total Players', value: matches.reduce((s, m) => s + m.registeredPlayers, 0), icon: '👥', color: '#10b981' },
            { label: 'Collection', value: `₹${totalCollection.toLocaleString()}`, icon: '💰', color: '#f59e0b' },
            { label: 'Your Profit', value: `₹${Math.floor(totalCollection * 0.6).toLocaleString()}`, icon: '📈', color: '#ec4899' },
          ].map(stat => (
            <div key={stat.label} className="p-4 bg-gray-900 border border-white/10 rounded-xl">
              <p className="text-2xl mb-1">{stat.icon}</p>
              <p className="text-2xl font-black" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-gray-500 text-xs">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.id ? 'bg-red-600 text-white' : 'bg-gray-900 border border-white/10 text-gray-400 hover:bg-gray-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Matches Tab */}
        {tab === 'matches' && (
          <div className="space-y-4">
            {matches.length === 0 ? (
              <div className="text-center py-20 text-gray-500"><p className="text-5xl mb-3">🎮</p><p>No matches yet. Create one!</p></div>
            ) : matches.map(m => (
              <div key={m.id} className={`p-5 bg-gray-900 border border-white/10 rounded-2xl bg-gradient-to-r ${getMapGradient(m.map)}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-white font-black text-lg">{m.name}</p>
                    <p className="text-gray-400 text-xs">{getMapEmoji(m.map)} {m.map} · {m.type} · {m.date} {m.time}</p>
                    <p className="text-gray-400 text-xs mt-1">👥 {m.registeredPlayers}/{m.maxPlayers} · 🎫 ₹{m.entryFee} · 🏆 ₹{getPrize(m)}</p>
                  </div>
                  <button onClick={() => deleteMatch(m.id)} className="text-red-400 hover:text-red-300 text-sm">🗑️</button>
                </div>

                {/* Status Toggle */}
                <div className="flex gap-2 mb-4 flex-wrap">
                  {(['open', 'live', 'done'] as const).map(s => (
                    <button key={s} onClick={() => updateMatch(m.id, { status: s })}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize ${m.status === s ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}>
                      {s === 'open' ? '🟢 OPEN' : s === 'live' ? '🔴 LIVE' : '✅ DONE'}
                    </button>
                  ))}
                </div>

                {/* Player Count */}
                <div className="flex gap-2 items-center mb-4">
                  <button onClick={() => updateMatch(m.id, { registeredPlayers: Math.max(0, m.registeredPlayers - 1) })} className="w-8 h-8 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg font-bold hover:bg-red-600/30">−</button>
                  <span className="text-white font-bold">{m.registeredPlayers} players</span>
                  <button onClick={() => updateMatch(m.id, { registeredPlayers: Math.min(m.maxPlayers, m.registeredPlayers + 1) })} className="w-8 h-8 bg-green-600/20 border border-green-600/30 text-green-400 rounded-lg font-bold hover:bg-green-600/30">+</button>
                </div>

                {/* Room ID */}
                <div className="flex gap-2 mb-3">
                  <input value={m.id === selectedMatch ? roomId : m.roomId} onChange={e => { setSelectedMatch(m.id); setRoomId(e.target.value); }}
                    onFocus={() => { setSelectedMatch(m.id); setRoomId(m.roomId); setRoomPass(m.roomPassword); }}
                    placeholder="Room ID" className="flex-1 p-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm" />
                  <input value={m.id === selectedMatch ? roomPass : m.roomPassword} onChange={e => { setSelectedMatch(m.id); setRoomPass(e.target.value); }}
                    placeholder="Password" className="flex-1 p-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-red-500 text-sm" />
                  <button onClick={() => updateMatch(m.id, { roomId: roomId || m.roomId, roomPassword: roomPass || m.roomPassword })} className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg font-bold hover:bg-blue-700">Save</button>
                </div>

                {/* Prize */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  <input type="number" placeholder="Total Prize" className="flex-1 min-w-20 p-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none text-sm"
                    onChange={e => setPrizePool(Number(e.target.value))} />
                  <input type="number" placeholder="1st" className="w-20 p-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none text-sm"
                    onChange={e => setPrize1(Number(e.target.value))} />
                  <input type="number" placeholder="2nd" className="w-20 p-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none text-sm"
                    onChange={e => setPrize2(Number(e.target.value))} />
                  <input type="number" placeholder="3rd" className="w-20 p-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none text-sm"
                    onChange={e => setPrize3(Number(e.target.value))} />
                  <button onClick={() => updateMatch(m.id, { customPrizePool: prizePool, prizeFirst: prize1, prizeSecond: prize2, prizeThird: prize3 })} className="px-3 py-2 bg-yellow-600 text-white text-xs rounded-lg font-bold">💰 Set</button>
                </div>

                {/* QR Upload */}
                <div className="flex gap-2 items-center">
                  <label className="flex-1 p-2 bg-white/5 border border-dashed border-white/20 rounded-lg text-gray-400 text-xs cursor-pointer hover:border-red-500 flex items-center gap-2">
                    {qrFile ? qrFile.name : '📱 Upload QR Code'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => setQrFile(e.target.files?.[0] || null)} />
                  </label>
                  <button onClick={() => handleQRUpload(m.id)} className="px-3 py-2 bg-purple-600 text-white text-xs rounded-lg font-bold hover:bg-purple-700">Upload</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Tab */}
        {tab === 'create' && (
          <div className="max-w-lg p-6 bg-gray-900 border border-white/10 rounded-2xl space-y-4">
            <h2 className="text-white font-black text-xl">➕ Create Match</h2>
            <input value={newMatch.name} onChange={e => setNewMatch({ ...newMatch, name: e.target.value })} placeholder="Match Name (optional)"
              className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
            <div className="grid grid-cols-2 gap-4">
              <select value={newMatch.map} onChange={e => setNewMatch({ ...newMatch, map: e.target.value as any })}
                className="p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500">
                {['Erangel', 'Miramar', 'Sanhok', 'Livik', 'TDM'].map(m => <option key={m}>{m}</option>)}
              </select>
              <select value={newMatch.type} onChange={e => setNewMatch({ ...newMatch, type: e.target.value as any })}
                className="p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500">
                {['Solo', 'Duo', 'Squad'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={newMatch.date} onChange={e => setNewMatch({ ...newMatch, date: e.target.value })}
                className="p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500" />
              <select value={newMatch.time} onChange={e => setNewMatch({ ...newMatch, time: e.target.value })}
                className="p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500">
                {Array.from({ length: 19 }, (_, i) => { const h = i + 8; return `${h.toString().padStart(2, '0')}:00`; }).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Max Players</label>
                <input type="number" value={newMatch.maxPlayers} onChange={e => setNewMatch({ ...newMatch, maxPlayers: Number(e.target.value) })}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Entry Fee (₹)</label>
                <input type="number" value={newMatch.entryFee} onChange={e => setNewMatch({ ...newMatch, entryFee: Number(e.target.value) })}
                  className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500" />
              </div>
            </div>
            {/* Preview */}
            <div className={`p-4 bg-gradient-to-br ${getMapGradient(newMatch.map)} border border-white/10 rounded-xl`}>
              <p className="text-white font-bold">{getMapEmoji(newMatch.map)} {newMatch.name || `${newMatch.map} ${newMatch.type}`}</p>
              <p className="text-gray-400 text-xs">🎫 ₹{newMatch.entryFee} · 👥 {newMatch.maxPlayers} seats · 🏆 ₹{Math.floor(newMatch.maxPlayers * newMatch.entryFee * 0.4)} prize</p>
            </div>
            <button onClick={handleCreateMatch} className="w-full py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700">➕ Create Match</button>
          </div>
        )}

        {/* Players Tab */}
        {tab === 'players' && (
          <div className="space-y-4">
            <select value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)}
              className="w-full p-3 bg-gray-900 border border-white/10 rounded-xl text-white focus:outline-none focus:border-red-500">
              <option value="">Select Match</option>
              {matches.map(m => <option key={m.id} value={m.id}>{m.name} ({m.registeredPlayers} players)</option>)}
            </select>
            {selectedMatchData && (
              <>
                <div className="flex gap-2 flex-wrap">
                  {['all', 'verified', 'pending'].map(f => (
                    <button key={f} onClick={() => setPlayerFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${playerFilter === f ? 'bg-red-600 text-white' : 'bg-gray-900 border border-white/10 text-gray-400'}`}>
                      {f} ({f === 'all' ? selectedMatchData.players.length : selectedMatchData.players.filter(p => f === 'verified' ? p.verified : !p.verified).length})
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  {(selectedMatchData.players || []).filter(p => playerFilter === 'all' ? true : playerFilter === 'verified' ? p.verified : !p.verified).map(p => (
                    <div key={p.id} className="p-4 bg-gray-900 border border-white/10 rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-bold">#{p.slotNumber} {p.bgmiName}</p>
                          <p className="text-gray-400 text-xs">🆔 {p.characterId}</p>
                          <p className="text-gray-400 text-xs">💳 {p.upiId}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${p.verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                          {p.verified ? '✅ Verified' : '⏳ Pending'}
                        </span>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {!p.verified && <button onClick={() => verifyPlayer(selectedMatch, p.id)} className="px-3 py-1.5 bg-green-600/20 border border-green-600/30 text-green-400 text-xs rounded-lg hover:bg-green-600/30 font-bold">✅ Verify</button>}
                        <button onClick={() => banPlayer(selectedMatch, p.id)} className="px-3 py-1.5 bg-red-600/20 border border-red-600/30 text-red-400 text-xs rounded-lg hover:bg-red-600/30 font-bold">🚫 Ban</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Payments Tab */}
        {tab === 'payments' && (
          <div className="space-y-3">
            {pendingPayments.length === 0 ? (
              <div className="text-center py-20 text-gray-500"><p className="text-5xl mb-3">💳</p><p>No pending payments!</p></div>
            ) : pendingPayments.map(p => (
              <div key={p.id} className="p-4 bg-gray-900 border border-white/10 rounded-xl">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-white font-bold">#{p.slotNumber} {p.bgmiName}</p>
                    <p className="text-gray-400 text-xs">🆔 {p.characterId}</p>
                    <p className="text-gray-400 text-xs">💳 {p.upiId}</p>
                    <p className="text-blue-400 text-xs">🎮 {p.matchName}</p>
                  </div>
                  <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full font-bold">⏳ Pending</span>
                </div>
                <p className="text-gray-500 text-xs mb-3">📱 Check Telegram for payment screenshot</p>
                <div className="flex gap-2">
                  <button onClick={() => approvePayment(p.matchId, p.id)} className="flex-1 py-2 bg-green-600 text-white text-xs rounded-lg font-bold hover:bg-green-700">✅ Approve</button>
                  <button onClick={() => rejectPayment(p.matchId, p.id)} className="flex-1 py-2 bg-red-600/20 border border-red-600/30 text-red-400 text-xs rounded-lg font-bold hover:bg-red-600/30">❌ Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Cash Tab */}
        {tab === 'addcash' && (
          <div className="space-y-3">
            {addCashRequests.length === 0 ? (
              <div className="text-center py-20 text-gray-500"><p className="text-5xl mb-3">💰</p><p>No add cash requests!</p></div>
            ) : addCashRequests.map(r => (
              <div key={r.id} className="p-4 bg-gray-900 border border-white/10 rounded-xl">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-white font-bold">{r.userName}</p>
                    <p className="text-gray-400 text-xs">📧 {r.userEmail}</p>
                    <p className="text-gray-400 text-xs">🎮 {r.bgmiName}</p>
                    <p className="text-green-400 font-black text-lg">₹{r.amount}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${r.status === 'approved' ? 'bg-green-500/20 text-green-400' : r.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {r.status === 'approved' ? '✅' : r.status === 'rejected' ? '❌' : '⏳'} {r.status}
                  </span>
                </div>
                {r.status === 'pending' && (
                  <>
                    <p className="text-gray-500 text-xs mb-2">📱 Check Telegram for payment proof</p>
                    <div className="flex gap-2">
                      <button onClick={() => approveAddCash(r.id, r.userId, r.amount)} className="flex-1 py-2 bg-green-600 text-white text-xs rounded-lg font-bold">✅ Approve — Add ₹{r.amount}</button>
                      <button onClick={() => rejectAddCash(r.id)} className="flex-1 py-2 bg-red-600/20 border border-red-600/30 text-red-400 text-xs rounded-lg">❌ Reject</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Withdraw Tab */}
        {tab === 'withdraw' && (
          <div className="space-y-3">
            {withdrawalRequests.length === 0 ? (
              <div className="text-center py-20 text-gray-500"><p className="text-5xl mb-3">💸</p><p>No withdrawal requests!</p></div>
            ) : withdrawalRequests.map(r => (
              <div key={r.id} className="p-4 bg-gray-900 border border-white/10 rounded-xl">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-white font-bold">{r.userName}</p>
                    <p className="text-gray-400 text-xs">📧 {r.userEmail}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-blue-400 text-xs font-mono">{r.upiId}</p>
                      <button onClick={() => navigator.clipboard.writeText(r.upiId)} className="text-gray-500 hover:text-white text-xs">📋</button>
                    </div>
                    <p className="text-red-400 font-black text-lg">₹{r.amount}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${r.status === 'approved' ? 'bg-green-500/20 text-green-400' : r.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {r.status === 'approved' ? '✅' : r.status === 'rejected' ? '❌' : '⏳'} {r.status}
                  </span>
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => approveWithdrawal(r.id, r.userId, r.amount)} className="flex-1 py-2 bg-green-600 text-white text-xs rounded-lg font-bold">✅ Mark Sent</button>
                    <button onClick={() => rejectWithdrawal(r.id, r.userId, r.amount)} className="flex-1 py-2 bg-red-600/20 border border-red-600/30 text-red-400 text-xs rounded-lg">❌ Reject</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Winners Tab */}
        {tab === 'winners' && (
          <div className="space-y-4 max-w-lg">
            <select value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)}
              className="w-full p-3 bg-gray-900 border border-white/10 rounded-xl text-white focus:outline-none">
              <option value="">Select Completed Match</option>
              {matches.filter(m => m.status === 'done').map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {selectedMatch && (
              <div className="p-5 bg-gray-900 border border-white/10 rounded-2xl space-y-3">
                <h3 className="text-white font-bold">🏆 Announce Winners</h3>
                {[
                  { label: '🥇 1st Place', value: winner1, set: setWinner1 },
                  { label: '🥈 2nd Place', value: winner2, set: setWinner2 },
                  { label: '🥉 3rd Place', value: winner3, set: setWinner3 },
                ].map(w => (
                  <input key={w.label} value={w.value} onChange={e => w.set(e.target.value)} placeholder={w.label}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500" />
                ))}
                <button onClick={async () => {
                  const m = matches.find(x => x.id === selectedMatch);
                  if (!m) return;
                  const prize = getPrize(m);
                  await announceWinners(selectedMatch, winner1, winner2, winner3);
                  await sendWinnerAnnouncementToTelegram({ matchName: m.name, first: winner1, second: winner2, third: winner3, prize1: m.prizeFirst || Math.floor(prize * 0.5), prize2: m.prizeSecond || Math.floor(prize * 0.3), prize3: m.prizeThird || Math.floor(prize * 0.2), totalPrize: prize });
                  alert('Winners announced!');
                }} className="w-full py-3 bg-yellow-600 text-white font-black rounded-xl hover:bg-yellow-700">🏆 Announce Winners</button>
              </div>
            )}
          </div>
        )}

        {/* Broadcast Tab */}
        {tab === 'broadcast' && (
          <div className="max-w-lg space-y-4">
            {broadcast && broadcast.expiresAt > Date.now() && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-400 font-bold text-sm">Active Broadcast:</p>
                <p className="text-white text-sm mt-1">{broadcast.message}</p>
                <button onClick={clearBroadcast} className="mt-2 px-4 py-2 bg-red-600 text-white text-xs rounded-lg font-bold">🛑 Stop</button>
              </div>
            )}
            <div className="p-5 bg-gray-900 border border-white/10 rounded-2xl space-y-4">
              <h3 className="text-white font-bold">📢 New Broadcast</h3>
              <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Broadcast message..." rows={4}
                className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none" />
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {[{ label: '30 min', val: 30 }, { label: '1 hr', val: 60 }, { label: '2 hrs', val: 120 }, { label: '6 hrs', val: 360 }, { label: '12 hrs', val: 720 }, { label: '24 hrs', val: 1440 }].map(d => (
                    <button key={d.val} onClick={() => setBroadcastDuration(d.val)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all ${broadcastDuration === d.val ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={async () => {
                if (!broadcastMsg) { alert('Enter message!'); return; }
                await setBroadcast(broadcastMsg, broadcastDuration);
                await sendBroadcastToTelegram(broadcastMsg, `${broadcastDuration} minutes`);
                alert('Broadcast sent!');
                setBroadcastMsg('');
              }} className="w-full py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700">📢 Send Broadcast</button>
            </div>
          </div>
        )}

        {/* Support Tab */}
        {tab === 'support' && (
          <div className="space-y-3">
            {supportTickets.length === 0 ? (
              <div className="text-center py-20 text-gray-500"><p className="text-5xl mb-3">💬</p><p>No support tickets!</p></div>
            ) : supportTickets.map(t => (
              <div key={t.id} className="p-4 bg-gray-900 border border-white/10 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-white font-bold">{t.userName} — {t.bgmiName}</p>
                    <p className="text-blue-400 text-xs">📧 {t.email}</p>
                    <p className="text-gray-400 text-xs">📋 {t.category}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${t.status === 'resolved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {t.status === 'resolved' ? '✅ Resolved' : '⏳ Open'}
                  </span>
                </div>
                <p className="text-gray-300 text-sm p-3 bg-white/5 rounded-lg mb-3">"{t.message}"</p>
                <p className="text-gray-500 text-xs">Reply to: <span className="text-blue-400">{t.email}</span></p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-white/10 py-12 px-4 pb-24 md:pb-12">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🎮</span>
              <span className="text-xl font-black text-white" style={{ fontFamily: 'Orbitron, monospace' }}>JEETO</span>
            </div>
            <p className="text-gray-500 text-sm">India's premier BGMI tournament platform. Win real cash prizes!</p>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4">📧 Support</h3>
            <p className="text-gray-500 text-sm">shontyvishwakarma@gmail.com</p>
            <p className="text-gray-500 text-sm">liju9546@gmail.com</p>
          </div>
          <div>
            <h3 className="text-white font-bold mb-4">🔗 Community</h3>
            <a href="https://t.me/pampa_ji_op" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-600/30 text-blue-400 rounded-xl text-sm hover:bg-blue-600/30 transition-all">
              ✈️ Join Telegram
            </a>
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-center">
          <p className="text-gray-600 text-xs">© 2024 JEETO BGMI Tournament Platform. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const { page, initStore, isAdminLoggedIn } = useStore();
  const [loading, setLoading] = useState(true);
  const [logoTapCount, setLogoTapCount] = useState(0);

  useEffect(() => {
    initStore();
  }, [initStore]);

  const handleLoadingDone = useCallback(() => setLoading(false), []);

  const renderPage = () => {
    if (isAdminLoggedIn) {
      if (page === 'admin') return <AdminPanel />;
    }
    switch (page) {
      case 'home': return <HomePage />;
      case 'login': return <AuthPage />;
      case 'signup': return <AuthPage />;
      case 'profile': return <ProfilePage />;
      case 'leaderboard': return <LeaderboardPage />;
      case 'winners': return <WinnersPage />;
      case 'results': return <ResultsPage />;
      case 'support': return <SupportPage />;
      case 'adminLogin': return <AdminLoginPage />;
      case 'admin': return isAdminLoggedIn ? <AdminPanel /> : <AdminLoginPage />;
      default: return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <AnimatePresence>
        {loading && <LoadingScreen onDone={handleLoadingDone} />}
      </AnimatePresence>

      {!loading && (
        <>
          <ParticleCanvas />
          <BroadcastBanner />
          {!isAdminLoggedIn && <Navbar logoTapCount={logoTapCount} setLogoTapCount={setLogoTapCount} />}
          <AnimatePresence mode="wait">
            <motion.div key={page} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {renderPage()}
            </motion.div>
          </AnimatePresence>
          {!isAdminLoggedIn && <BottomNav />}
          {!isAdminLoggedIn && page !== 'adminLogin' && <Footer />}

          {/* Floating Telegram */}
          <motion.a href="https://t.me/pampa_ji_op" target="_blank" rel="noreferrer"
            animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="fixed bottom-20 md:bottom-6 right-4 z-50 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-2xl shadow-lg shadow-blue-600/40 hover:bg-blue-500 transition-colors">
            ✈️
          </motion.a>
        </>
      )}
    </div>
  );
}
