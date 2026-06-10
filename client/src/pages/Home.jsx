import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [calls, setCalls] = useState([]);
  const [managerName, setManagerName] = useState(() => localStorage.getItem('manager_name') || '');
  const [editing, setEditing] = useState(!localStorage.getItem('manager_name'));
  const [submissions, setSubmissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/calls')
      .then((r) => r.json())
      .then((data) => {
        setCalls(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!managerName || !calls.length) return;
    Promise.all(
      calls.map((c) =>
        fetch(`/api/submissions/check?call_id=${c.id}&manager_name=${encodeURIComponent(managerName)}`)
          .then((r) => r.json())
          .then((sub) => ({ callId: c.id, sub }))
      )
    ).then((results) => {
      const map = {};
      results.forEach(({ callId, sub }) => { if (sub) map[callId] = sub; });
      setSubmissions(map);
    });
  }, [managerName, calls]);

  function saveName() {
    if (!managerName.trim()) return;
    localStorage.setItem('manager_name', managerName.trim());
    setEditing(false);
  }

  const done = Object.values(submissions).filter((s) => s?.is_final).length;
  const total = calls.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Валидатор звонков</h1>
          <p className="text-slate-500 text-sm">Прослушай звонок и дай обратную связь</p>
        </div>

        {/* Manager name */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          {editing ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Твоё имя</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Например: Алиса Иванова"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveName()}
                />
                <button
                  onClick={saveName}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Менеджер</p>
                <p className="font-semibold text-slate-900">{managerName}</p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                Изменить
              </button>
            </div>
          )}
        </div>

        {/* Progress */}
        {managerName && !editing && (
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-600 mb-1">
              <span>Прогресс</span>
              <span>{done} / {total}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: total ? `${(done / total) * 100}%` : '0%' }}
              />
            </div>
          </div>
        )}

        {/* Calls list */}
        {loading ? (
          <div className="text-slate-400 text-sm text-center py-8">Загрузка...</div>
        ) : calls.length === 0 ? (
          <div className="text-slate-400 text-sm text-center py-8">Звонки ещё не добавлены</div>
        ) : (
          <div className="space-y-3">
            {calls.map((call) => {
              const sub = submissions[call.id];
              const isFinal = sub?.is_final === true;
              const hasAttempts = sub && sub.attempt_count > 0;
              const score = sub?.best_score;

              return (
                <button
                  key={call.id}
                  onClick={() => managerName && !editing && navigate(`/call/${call.id}`)}
                  disabled={!managerName || editing}
                  className="w-full bg-white border border-slate-200 rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        isFinal ? 'bg-green-100 text-green-700' :
                        hasAttempts ? 'bg-amber-100 text-amber-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {isFinal ? '✓' : hasAttempts ? '↻' : '▶'}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 text-sm">{call.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(call.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>
                    {isFinal && (
                      <div className="text-right">
                        <p className={`text-lg font-bold ${score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {score}
                        </p>
                        <p className="text-xs text-slate-400">баллов</p>
                      </div>
                    )}
                    {hasAttempts && !isFinal && (
                      <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-full">
                        попытка {sub.attempt_count}
                      </span>
                    )}
                    {!sub && (
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded-full">не сдан</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Admin link */}
        <div className="mt-10 text-center">
          <button
            onClick={() => navigate('/admin')}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Панель администратора
          </button>
        </div>
      </div>
    </div>
  );
}
