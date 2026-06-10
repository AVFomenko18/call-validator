import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const QUOTES = [
  { text: 'Каждый разбор звонка — это инвестиция в твой следующий лучший результат.' },
  { text: 'Внимательность к деталям сегодня — закрытые сделки завтра.' },
  { text: 'Лучшие продавцы учатся на каждом звонке, не только на своём.' },
  { text: 'Слушать — это тоже навык. И ты его только что прокачал.' },
  { text: 'Разбор чужого опыта — самый быстрый путь к собственному мастерству.' },
  { text: 'Великие продажи начинаются с великого внимания к деталям.' },
];

// ─── AudioPlayer ────────────────────────────────────────────────────────────

function AudioPlayer({ url }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState(null);

  const isGoogleDrive = url && (url.includes('drive.google.') || url.includes('docs.google.'));
  const isYandex = url && (url.includes('yandex.') || url.includes('yadi.sk'));

  useEffect(() => {
    if (!url || isGoogleDrive) return;
    if (isYandex) {
      setResolvedUrl(`/api/audio-proxy?url=${encodeURIComponent(url)}`);
    } else {
      setResolvedUrl(url);
    }
  }, [url]);

  if (isGoogleDrive) {
    const driveMatch = url.match(/\/file\/d\/([^/?]+)/) || url.match(/[?&]id=([^&]+)/);
    const driveId = driveMatch?.[1];
    if (!driveId) return <p className="text-sm text-red-400">Неверная ссылка Google Drive</p>;
    return (
      <div>
        <iframe
          src={`https://drive.google.com/file/d/${driveId}/preview`}
          width="100%" height="120" allow="autoplay"
          className="rounded-lg border-0 block"
        />
        <a href={`https://drive.google.com/file/d/${driveId}/view`} target="_blank" rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-blue-600">
          Открыть в Google Drive (там есть управление скоростью) ↗
        </a>
      </div>
    );
  }

  if (!resolvedUrl) return null;

  function fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  }

  function changeSpeed(s) {
    setSpeed(s);
    if (audioRef.current) audioRef.current.playbackRate = s;
  }

  function onTimeUpdate() {
    const a = audioRef.current;
    if (!a) return;
    setCurrentTime(a.currentTime);
    setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
  }

  function onSeek(e) {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = ratio * a.duration;
  }

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        src={resolvedUrl}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
      <div className="w-full h-2 bg-slate-200 rounded-full cursor-pointer" onClick={onSeek}>
        <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 text-lg"
          >
            {playing ? '⏸' : '▶'}
          </button>
          <span className="text-sm text-slate-500 tabular-nums">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 1.25, 1.5, 2].map((s) => (
            <button
              key={s}
              onClick={() => changeSpeed(s)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${speed === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── FlipCard ────────────────────────────────────────────────────────────────

function FlipCard({ card, isRevealed, showMissed }) {
  const isOpen = card.type === 'matched';
  const flipped = isOpen && isRevealed;
  const missedState = card.type === 'missed' && showMissed;

  return (
    <div style={{ perspective: '800px' }} className="h-32">
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Front face — locked / missed */}
        <div
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          className={`absolute inset-0 rounded-xl flex flex-col items-center justify-center border transition-colors duration-500 ${
            missedState
              ? 'bg-rose-950 border-rose-800'
              : 'bg-slate-800 border-slate-700'
          }`}
        >
          {missedState ? (
            <>
              <span className="text-xl text-rose-400">✗</span>
              <span className="text-xs text-rose-500 mt-1 font-medium">пропущено</span>
            </>
          ) : (
            <span className="text-3xl font-bold text-slate-500 select-none">?</span>
          )}
        </div>

        {/* Back face — matched / revealed */}
        <div
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 flex flex-col shadow-md"
        >
          <span className="text-emerald-100 text-xs font-bold mb-1.5">✓ Верно замечено</span>
          <p className="text-white text-xs leading-snug overflow-hidden" style={{
            display: '-webkit-box',
            WebkitLineClamp: 5,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {card.text}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── CardGame ────────────────────────────────────────────────────────────────

function CardGame({ scoreDetails, attemptNumber, submissionId, onRetry, onFinish }) {
  const details = useMemo(() => {
    if (!scoreDetails) return {};
    return typeof scoreDetails === 'string' ? JSON.parse(scoreDetails) : scoreDetails;
  }, [scoreDetails]);

  const matched = details?.matched_points || [];
  const missed = details?.missed_points || [];
  const total = matched.length + missed.length;
  const percent = total > 0 ? Math.round((matched.length / total) * 100) : 0;
  const canFinish = percent >= 50;

  const cards = useMemo(() => {
    const all = [
      ...matched.map((text) => ({ type: 'matched', text })),
      ...missed.map((text) => ({ type: 'missed', text })),
    ];
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
  }, [scoreDetails]);

  const [revealedIndices, setRevealedIndices] = useState(new Set());
  const [showMissed, setShowMissed] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    setRevealedIndices(new Set());
    setShowMissed(false);
    setShowContent(false);

    let delay = 400;
    const timeouts = [];

    cards.forEach((card, i) => {
      if (card.type === 'matched') {
        const t = setTimeout(() => {
          setRevealedIndices((prev) => new Set([...prev, i]));
        }, delay);
        timeouts.push(t);
        delay += 160;
      }
    });

    timeouts.push(setTimeout(() => setShowMissed(true), delay + 500));
    timeouts.push(setTimeout(() => setShowContent(true), delay + 900));

    return () => timeouts.forEach(clearTimeout);
  }, [cards]);

  async function handleFinish() {
    setFinishing(true);
    try {
      await fetch(`/api/submissions/${submissionId}/finish`, { method: 'POST' });
      onFinish();
    } catch {
      setFinishing(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center pt-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
          Попытка {attemptNumber}
        </p>
        <p className="text-4xl font-bold text-slate-900">
          {matched.length}
          <span className="text-slate-400 text-2xl font-normal"> / {total}</span>
        </p>
        <p className="text-sm text-slate-500 mt-1">карточек открыто · {percent}%</p>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className="h-2.5 rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, #10b981, #14b8a6)',
          }}
        />
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {cards.map((card, i) => (
          <FlipCard
            key={i}
            card={card}
            isRevealed={revealedIndices.has(i)}
            showMissed={showMissed}
          />
        ))}
      </div>

      {/* Reasoning */}
      {showContent && details?.reasoning && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Комментарий разбора:</p>
          <p className="text-sm text-slate-700 leading-relaxed">{details.reasoning}</p>
        </div>
      )}

      {/* Action buttons */}
      {showContent && (
        <div
          className="space-y-3"
          style={{ animation: 'fadeInUp 0.5s ease-out both' }}
        >
          <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>
          {canFinish ? (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-emerald-700 text-sm font-medium">
                  Отличный результат! Ты открыл больше половины карточек
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={onRetry}
                  className="py-3 rounded-xl border-2 border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-400 transition-colors"
                >
                  🔄 Улучшить
                </button>
                <button
                  onClick={handleFinish}
                  disabled={finishing}
                  className="py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {finishing ? 'Сохраняем...' : '✅ Завершить'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-amber-800 text-sm font-medium">
                  Нужно открыть хотя бы 50% карточек — ты открыл {percent}%. Попробуй ещё раз!
                </p>
              </div>
              <button
                onClick={onRetry}
                className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
              >
                🔄 Попробовать снова
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CompletionScreen ────────────────────────────────────────────────────────

function CompletionScreen({ callTitle, onBack }) {
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], []);

  const confetti = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 1.8}s`,
    duration: `${2.5 + Math.random() * 2}s`,
    color: ['#10b981', '#3b82f6', '#f59e0b', '#a78bfa', '#ec4899', '#34d399', '#60a5fa'][i % 7],
    size: `${6 + Math.random() * 9}px`,
    round: Math.random() > 0.45,
  })), []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)' }}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-8vh) rotate(0deg) scale(1); opacity: 1; }
          85%  { opacity: 0.7; }
          100% { transform: translateY(108vh) rotate(720deg) scale(0.7); opacity: 0; }
        }
        @keyframes celebrateIn {
          0%   { opacity: 0; transform: translateY(28px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes trophyBounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-10px); }
        }
      `}</style>

      {confetti.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'fixed',
            left: p.left,
            top: '-12px',
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.round ? '50%' : '3px',
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      ))}

      <div
        className="relative z-10 text-center max-w-sm w-full"
        style={{ animation: 'celebrateIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
      >
        <div
          className="text-6xl mb-5 inline-block"
          style={{ animation: 'trophyBounce 2s ease-in-out infinite 0.8s' }}
        >
          🏆
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">
          Обучение завершено!
        </h1>
        <p className="text-slate-400 text-sm mb-8">{callTitle}</p>

        <div
          className="rounded-2xl p-6 mb-8"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
        >
          <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Цитата дня</p>
          <p className="text-white text-base leading-relaxed font-medium">
            "{quote.text}"
          </p>
        </div>

        <button
          onClick={onBack}
          className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl hover:bg-slate-100 transition-colors text-sm shadow-lg"
        >
          К списку звонков →
        </button>
      </div>
    </div>
  );
}

// ─── CallPage ────────────────────────────────────────────────────────────────

export default function CallPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const managerName = localStorage.getItem('manager_name') || '';

  const [call, setCall] = useState(null);
  const [phase, setPhase] = useState('loading'); // 'loading' | 'form' | 'cards' | 'completed'
  const [latestAttempt, setLatestAttempt] = useState(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!managerName) { navigate('/'); return; }
    Promise.all([
      fetch(`/api/calls/${id}`).then((r) => r.json()),
      fetch(`/api/submissions/check?call_id=${id}&manager_name=${encodeURIComponent(managerName)}`).then((r) => r.json()),
    ]).then(([callData, checkData]) => {
      setCall(callData);
      const validCheck = checkData && !checkData.error && checkData.attempt_count > 0;
      if (!validCheck) {
        setPhase('form');
      } else if (checkData.is_final) {
        setPhase('completed');
      } else {
        setLatestAttempt(checkData.latest);
        setAttemptCount(checkData.attempt_count);
        setPhase('cards');
      }
    });
  }, [id, managerName]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!strengths.trim() || !weaknesses.trim()) { setError('Заполни оба поля'); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ call_id: id, manager_name: managerName, strengths, weaknesses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      setLatestAttempt(data);
      setAttemptCount((prev) => prev + 1);
      setPhase('cards');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setStrengths('');
    setWeaknesses('');
    setError('');
    setPhase('form');
  }

  if (phase === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Загрузка...</div>;
  }
  if (!call || call.error) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Звонок не найден</div>;
  }

  if (phase === 'completed') {
    return <CompletionScreen callTitle={call.title} onBack={() => navigate('/')} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-slate-800 mb-6 flex items-center gap-1">
          ← Назад
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">{call.title}</h1>
          <p className="text-sm text-slate-500 mt-1">Менеджер: {managerName}</p>
        </div>

        {call.audio_url && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
            <p className="text-xs font-medium text-slate-500 mb-3">АУДИОЗАПИСЬ</p>
            <AudioPlayer url={call.audio_url} />
          </div>
        )}

        {/* Card game result */}
        {phase === 'cards' && latestAttempt && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
            <CardGame
              scoreDetails={latestAttempt.score_details}
              attemptNumber={latestAttempt.attempt_number || attemptCount}
              submissionId={latestAttempt.id}
              onRetry={handleRetry}
              onFinish={() => setPhase('completed')}
            />
          </div>
        )}

        {/* Feedback form */}
        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {attemptCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-sm text-blue-700 font-semibold">Попытка {attemptCount + 1}</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Постарайся упомянуть конкретные детали, которые пропустил в прошлый раз
                </p>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500 mb-2">ИНСТРУКЦИЯ</p>
              <p className="text-sm text-slate-600">
                Прослушай звонок полностью, затем напиши развёрнутую обратную связь. Чем конкретнее — тем выше балл.
                Ссылайся на конкретные моменты, фразы и техники из звонка.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Сильные стороны звонка</label>
              <textarea
                rows={5}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Что менеджер делал хорошо? Конкретные моменты, техники, фразы..."
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Слабые стороны звонка</label>
              <textarea
                rows={5}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Что можно было сделать лучше? Где были ошибки или упущенные возможности?"
                value={weaknesses}
                onChange={(e) => setWeaknesses(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Анализируем...' : 'Отправить и получить балл'}
            </button>

            {submitting && (
              <p className="text-xs text-slate-400 text-center">
                Claude анализирует твой ответ — займёт ~10 секунд
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
