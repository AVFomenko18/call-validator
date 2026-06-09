import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Auth ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    const res = await fetch('/api/submissions/summary', {
      headers: { 'x-admin-token': password },
    });
    if (res.ok) {
      sessionStorage.setItem('admin_token', password);
      onLogin(password);
    } else {
      setError('Неверный пароль');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white border border-slate-200 rounded-xl p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Администратор</h1>
        <p className="text-slate-500 text-sm mb-6">Валидатор звонков</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Пароль администратора"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}

// ── JSON parser ──────────────────────────────────────────────────────────────
function parseTranscriptionJSON(jsonText) {
  const data = JSON.parse(jsonText);
  if (data.speakers && data.speakers.length) {
    const speakerMap = {};
    // Determine speaker labels: first speaker = Менеджер, second = Клиент
    data.speakers.forEach((s) => {
      if (!speakerMap[s.speaker]) {
        const idx = Object.keys(speakerMap).length;
        speakerMap[s.speaker] = idx === 0 ? 'Менеджер' : 'Клиент';
      }
    });
    return data.speakers
      .map((s) => {
        const mins = Math.floor(s.start / 60);
        const secs = Math.floor(s.start % 60);
        const time = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        const label = speakerMap[s.speaker];
        return `[${time}] ${label}: ${s.text.trim()}`;
      })
      .join('\n\n');
  }
  return data.text || '';
}

// ── Call Form (create + edit) ─────────────────────────────────────────────────
function NewCallForm({ token, onCreated, onCancel, editCall }) {
  const [form, setForm] = useState({
    title: editCall?.title || '',
    audio_url: editCall?.audio_url || '',
    transcription: editCall?.transcription || '',
    supervisor_feedback: editCall?.supervisor_feedback || '',
  });
  const [transcriptionMode, setTranscriptionMode] = useState('text');
  const [jsonError, setJsonError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => applyJSON(ev.target.result);
    reader.readAsText(file);
  }

  function applyJSON(text) {
    setJsonError('');
    try {
      const transcript = parseTranscriptionJSON(text);
      set('transcription', transcript);
      setTranscriptionMode('text');
    } catch {
      setJsonError('Не удалось разобрать JSON. Проверь формат файла.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.transcription || !form.supervisor_feedback) {
      setError('Заполни все обязательные поля');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const url = editCall ? `/api/calls/${editCall.id}` : '/api/calls';
      const res = await fetch(url, {
        method: editCall ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-slate-900">{editCall ? 'Редактировать звонок' : 'Новый звонок'}</h2>
        <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 text-lg leading-none">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Название *</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Звонок Иванова #3"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ссылка на аудио</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://disk.yandex.ru/i/... или прямая ссылка на mp3"
            value={form.audio_url}
            onChange={(e) => set('audio_url', e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1">Яндекс Диск: файл должен быть с доступом "Всем по ссылке"</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-slate-600">Транскрипция звонка *</label>
            <div className="flex gap-1 bg-slate-100 rounded-md p-0.5">
              {['text', 'json'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setTranscriptionMode(mode)}
                  className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${transcriptionMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {mode === 'text' ? 'Текст' : 'JSON файл'}
                </button>
              ))}
            </div>
          </div>

          {transcriptionMode === 'json' ? (
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
              <p className="text-sm text-slate-500 mb-3">Загрузи JSON файл транскрипции</p>
              <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Выбрать файл
                <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
              </label>
              <p className="text-xs text-slate-400 mt-2">Поддерживается формат с полями speakers[] + text</p>
              {jsonError && <p className="text-xs text-red-600 mt-2">{jsonError}</p>}
            </div>
          ) : (
          <textarea
            rows={6}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Вставь полный текст транскрипции звонка..."
            value={form.transcription}
            onChange={(e) => set('transcription', e.target.value)}
          />
          )}
          {transcriptionMode === 'text' && form.transcription && (
            <p className="text-xs text-green-600 mt-1">✓ {form.transcription.split('\n\n').length} реплик загружено</p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Обратная связь руководителя (эталон) *</label>
          <textarea
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Что руководитель выделил как сильные и слабые стороны этого звонка..."
            value={form.supervisor_feedback}
            onChange={(e) => set('supervisor_feedback', e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Сохраняем (Claude обновляет ключевые моменты)...' : editCall ? 'Сохранить изменения' : 'Создать звонок'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Submission Detail Modal ───────────────────────────────────────────────────
function SubmissionModal({ sub, onClose }) {
  if (!sub) return null;
  const details = typeof sub.score_details === 'string' ? JSON.parse(sub.score_details) : sub.score_details;
  const color = sub.score >= 70 ? 'text-green-600' : sub.score >= 40 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-semibold text-slate-900">{sub.manager_name}</p>
            <p className="text-xs text-slate-500">{sub.call_title}</p>
          </div>
          <div className="text-right">
            <p className={`text-3xl font-bold ${color}`}>{sub.score}</p>
            <p className="text-xs text-slate-400">баллов</p>
          </div>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-slate-700 mb-1">Сильные стороны:</p>
            <p className="text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{sub.strengths}</p>
          </div>
          <div>
            <p className="font-medium text-slate-700 mb-1">Слабые стороны:</p>
            <p className="text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{sub.weaknesses}</p>
          </div>
          {details?.reasoning && (
            <div>
              <p className="font-medium text-slate-700 mb-1">Комментарий Claude:</p>
              <p className="text-slate-600 bg-blue-50 rounded-lg p-3">{details.reasoning}</p>
            </div>
          )}
          {details?.matched_points?.length > 0 && (
            <div>
              <p className="font-medium text-green-700 mb-1">Верно подмечено:</p>
              <ul className="space-y-1">{details.matched_points.map((p, i) => <li key={i} className="text-slate-600 flex gap-1.5"><span className="text-green-500">✓</span>{p}</li>)}</ul>
            </div>
          )}
          {details?.missed_points?.length > 0 && (
            <div>
              <p className="font-medium text-red-700 mb-1">Пропущено:</p>
              <ul className="space-y-1">{details.missed_points.map((p, i) => <li key={i} className="text-slate-600 flex gap-1.5"><span className="text-red-400">✗</span>{p}</li>)}</ul>
            </div>
          )}
        </div>

        <button onClick={onClose} className="mt-5 w-full border border-slate-200 rounded-lg py-2 text-sm text-slate-600 hover:bg-slate-50">
          Закрыть
        </button>
      </div>
    </div>
  );
}

// ── Main Admin ────────────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token') || '');
  const [tab, setTab] = useState('stats');
  const [calls, setCalls] = useState([]);
  const [summary, setSummary] = useState([]);
  const [showNewCall, setShowNewCall] = useState(false);
  const [editingCall, setEditingCall] = useState(null);
  const [selectedSub, setSelectedSub] = useState(null);
  const [loadingDelete, setLoadingDelete] = useState(null);

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  async function loadData() {
    const [callsRes, summaryRes] = await Promise.all([
      fetch('/api/calls', { headers: { 'x-admin-token': token } }).then((r) => r.json()),
      fetch('/api/submissions/summary', { headers: { 'x-admin-token': token } }).then((r) => r.json()),
    ]);
    setCalls(Array.isArray(callsRes) ? callsRes : []);
    setSummary(Array.isArray(summaryRes) ? summaryRes : []);
  }

  async function deleteCall(id) {
    if (!confirm('Удалить звонок и все ответы к нему?')) return;
    setLoadingDelete(id);
    await fetch(`/api/calls/${id}`, { method: 'DELETE', headers: { 'x-admin-token': token } });
    await loadData();
    setLoadingDelete(null);
  }

  async function openSubmission(callId, managerName) {
    const res = await fetch(
      `/api/submissions?call_id=${callId}`,
      { headers: { 'x-admin-token': token } }
    );
    const data = await res.json();
    const sub = data.find((s) => s.manager_name === managerName);
    if (sub) setSelectedSub(sub);
  }

  if (!token) return <LoginScreen onLogin={setToken} />;

  // Build stats table
  const managers = [...new Set(summary.map((s) => s.manager_name))].sort();
  const scoreMap = {};
  summary.forEach((s) => {
    if (!scoreMap[s.manager_name]) scoreMap[s.manager_name] = {};
    scoreMap[s.manager_name][s.call_id] = s.score;
  });

  function avgScore(manager) {
    const scores = Object.values(scoreMap[manager] || {});
    if (!scores.length) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Панель администратора</h1>
            <p className="text-sm text-slate-500">Валидатор звонков</p>
          </div>
          <button onClick={() => navigate('/')} className="text-sm text-slate-500 hover:text-slate-800">
            ← К менеджерам
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-200 rounded-lg p-1 mb-6 w-fit">
          {['stats', 'calls'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t === 'stats' ? 'Статистика' : 'Звонки'}
            </button>
          ))}
        </div>

        {/* Stats tab */}
        {tab === 'stats' && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {managers.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-12">Нет ответов пока</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 font-medium text-slate-600">Менеджер</th>
                      {calls.map((c) => (
                        <th key={c.id} className="text-center px-3 py-3 font-medium text-slate-600 max-w-[100px]">
                          <span className="block truncate text-xs">{c.title}</span>
                        </th>
                      ))}
                      <th className="text-center px-4 py-3 font-medium text-slate-600">Среднее</th>
                    </tr>
                  </thead>
                  <tbody>
                    {managers.map((manager, i) => (
                      <tr key={manager} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="px-4 py-3 font-medium text-slate-800">{manager}</td>
                        {calls.map((c) => {
                          const score = scoreMap[manager]?.[c.id];
                          return (
                            <td key={c.id} className="px-3 py-3 text-center">
                              {score !== undefined ? (
                                <button
                                  onClick={() => openSubmission(c.id, manager)}
                                  className={`inline-block px-2 py-0.5 rounded-md text-xs font-bold cursor-pointer hover:opacity-80 ${
                                    score >= 70 ? 'bg-green-100 text-green-700' :
                                    score >= 40 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {score}
                                </button>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center">
                          {avgScore(manager) !== null ? (
                            <span className={`font-bold ${avgScore(manager) >= 70 ? 'text-green-600' : avgScore(manager) >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {avgScore(manager)}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Calls tab */}
        {tab === 'calls' && (
          <div>
            {editingCall ? (
              <NewCallForm
                token={token}
                editCall={editingCall}
                onCreated={(c) => {
                  setCalls((prev) => prev.map((x) => x.id === c.id ? c : x));
                  setEditingCall(null);
                }}
                onCancel={() => setEditingCall(null)}
              />
            ) : showNewCall ? (
              <NewCallForm
                token={token}
                onCreated={(c) => { setCalls((prev) => [c, ...prev]); setShowNewCall(false); }}
                onCancel={() => setShowNewCall(false)}
              />
            ) : (
              <button
                onClick={() => setShowNewCall(true)}
                className="w-full border-2 border-dashed border-slate-300 rounded-xl py-4 text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm font-medium mb-4"
              >
                + Добавить звонок
              </button>
            )}

            <div className="space-y-3">
              {calls.map((call) => {
                const subCount = summary.filter((s) => s.call_id === call.id).length;
                return (
                  <div key={call.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{call.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(call.created_at).toLocaleDateString('ru-RU')} · {subCount} ответов
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/calls/${call.id}`, { headers: { 'x-admin-token': token } });
                          const full = await res.json();
                          setEditingCall(full);
                          setShowNewCall(false);
                        }}
                        className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                      >
                        Изменить
                      </button>
                      <button
                        onClick={() => deleteCall(call.id)}
                        disabled={loadingDelete === call.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40 px-2 py-1 rounded hover:bg-red-50"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
              {calls.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-8">Нет звонков</p>
              )}
            </div>
          </div>
        )}
      </div>

      <SubmissionModal sub={selectedSub} onClose={() => setSelectedSub(null)} />
    </div>
  );
}
