import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function AudioPlayer({ url }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [resolvedUrl, setResolvedUrl] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [audioError, setAudioError] = useState('');

  const isGoogleDrive = url && (url.includes('drive.google.') || url.includes('docs.google.'));
  const isYandex = url && (url.includes('yandex.') || url.includes('yadi.sk'));

  useEffect(() => {
    if (!url || isGoogleDrive) return;
    if (isYandex) {
      setResolving(true);
      fetch(`/api/resolve-audio?url=${encodeURIComponent(url)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.url) setResolvedUrl(d.url);
          else setAudioError(d.error || 'Не удалось загрузить аудио');
        })
        .catch((e) => setAudioError(e.message))
        .finally(() => setResolving(false));
    } else {
      setResolvedUrl(url);
    }
  }, [url]);

  // Google Drive — iframe only
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

  if (resolving) return <p className="text-sm text-slate-400">Загрузка аудио...</p>;
  if (audioError) return <p className="text-sm text-red-500">{audioError}</p>;
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
      {/* Progress bar */}
      <div
        className="w-full h-2 bg-slate-200 rounded-full cursor-pointer"
        onClick={onSeek}
      >
        <div className="h-2 bg-blue-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      {/* Controls */}
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
        {/* Speed */}
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

function ScoreResult({ result }) {
  const { score, score_details } = result;
  const details = typeof score_details === 'string' ? JSON.parse(score_details) : score_details;

  const color = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';
  const bg = score >= 70 ? 'bg-green-50 border-green-200' : score >= 40 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <div className="text-center mb-4">
        <p className={`text-5xl font-bold ${color}`}>{score}</p>
        <p className="text-slate-500 text-sm mt-1">баллов из 100</p>
      </div>
      {details?.reasoning && (
        <p className="text-sm text-slate-700 mb-4 text-center">{details.reasoning}</p>
      )}
      {details?.matched_points?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-green-700 mb-1.5">Верно подмечено:</p>
          <ul className="space-y-1">
            {details.matched_points.map((p, i) => (
              <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                <span className="text-green-500 mt-0.5">✓</span>{p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {details?.missed_points?.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-red-700 mb-1.5">Пропущено:</p>
          <ul className="space-y-1">
            {details.missed_points.map((p, i) => (
              <li key={i} className="text-xs text-slate-700 flex gap-1.5">
                <span className="text-red-400 mt-0.5">✗</span>{p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {details?.generic_phrases?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-1.5">Общие фразы (штраф):</p>
          <ul className="space-y-1">
            {details.generic_phrases.map((p, i) => (
              <li key={i} className="text-xs text-slate-500 italic flex gap-1.5">
                <span className="mt-0.5">–</span>"{p}"
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CallPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const managerName = localStorage.getItem('manager_name') || '';

  const [call, setCall] = useState(null);
  const [existing, setExisting] = useState(null);
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!managerName) { navigate('/'); return; }
    Promise.all([
      fetch(`/api/calls/${id}`).then((r) => r.json()),
      fetch(`/api/submissions/check?call_id=${id}&manager_name=${encodeURIComponent(managerName)}`).then((r) => r.json()),
    ]).then(([callData, sub]) => {
      setCall(callData);
      if (sub) setExisting(sub);
      setLoading(false);
    });
  }, [id, managerName]);


  async function handleSubmit(e) {
    e.preventDefault();
    if (!strengths.trim() || !weaknesses.trim()) {
      setError('Заполни оба поля');
      return;
    }
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
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Загрузка...</div>;
  if (!call || call.error) return <div className="min-h-screen flex items-center justify-center text-slate-400">Звонок не найден</div>;


  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Back */}
        <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-slate-800 mb-6 flex items-center gap-1">
          ← Назад
        </button>

        {/* Call title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">{call.title}</h1>
          <p className="text-sm text-slate-500 mt-1">Менеджер: {managerName}</p>
        </div>

        {/* Audio player */}
        {call.audio_url && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6">
            <p className="text-xs font-medium text-slate-500 mb-3">АУДИОЗАПИСЬ</p>
            <AudioPlayer url={call.audio_url} />
          </div>
        )}

        {/* Already submitted */}
        {existing && !result && (
          <div className="mb-6">
            <p className="text-sm text-slate-500 mb-3">Ты уже сдал этот звонок:</p>
            <ScoreResult result={existing} />
          </div>
        )}

        {/* Result after submit */}
        {result && (
          <div className="mb-6">
            <p className="text-sm font-medium text-slate-700 mb-3">Результат:</p>
            <ScoreResult result={result} />
            <button
              onClick={() => navigate('/')}
              className="mt-4 w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              К списку звонков
            </button>
          </div>
        )}

        {/* Feedback form */}
        {!existing && !result && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs font-medium text-slate-500 mb-3">ИНСТРУКЦИЯ</p>
              <p className="text-sm text-slate-600">
                Прослушай звонок полностью, затем напиши развёрнутую обратную связь. Чем конкретнее — тем выше балл.
                Ссылайся на конкретные моменты, фразы и техники из звонка.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Сильные стороны звонка
              </label>
              <textarea
                rows={5}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Что менеджер делал хорошо? Конкретные моменты, техники, фразы..."
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Слабые стороны звонка
              </label>
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
