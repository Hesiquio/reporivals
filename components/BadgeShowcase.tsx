import React, { useState } from 'react';

export interface Badge {
  id: string;
  nombre: string;
  descripcion: string;
  icon_url: string;
  criterio_desbloqueo: string;
}

export interface StudentBadge {
  id: string;
  student_id: string;
  badge_id: string;
  otorgado_en: string; // ISO string or formatted timestamp
}

interface BadgeShowcaseProps {
  allBadges: Badge[];
  studentBadges: StudentBadge[];
  studentName: string;
}

export const BadgeShowcase: React.FC<BadgeShowcaseProps> = ({
  allBadges = [],
  studentBadges = [],
  studentName,
}) => {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);

  // Set of unlocked badge IDs for fast lookup
  const unlockedBadgeMap = React.useMemo(() => {
    const map = new Map<string, StudentBadge>();
    studentBadges.forEach((sb) => {
      map.set(sb.badge_id, sb);
    });
    return map;
  }, [studentBadges]);

  const earnedCount = studentBadges.length;
  const totalCount = allBadges.length;
  const completionPercentage = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  return (
    <div className="w-full text-slate-100 bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-2xl flex flex-col gap-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide flex items-center gap-2">
            🏆 Vitrina de Insignias
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Logros e hitos alcanzados por <span className="text-emerald-400 font-semibold">{studentName}</span>
          </p>
        </div>

        {/* Progress Circle/Bar */}
        <div className="flex items-center gap-3 bg-slate-900/40 px-4 py-2 rounded-xl border border-slate-900 w-full sm:w-auto">
          <div className="flex flex-col text-right">
            <span className="text-xs text-slate-500 font-semibold uppercase">Progreso</span>
            <span className="text-sm font-mono font-bold text-emerald-400">
              {earnedCount} / {totalCount} Insignias
            </span>
          </div>
          <div className="relative w-12 h-12 flex items-center justify-center">
            {/* SVG circular progress indicator */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                strokeWidth="4"
                stroke="currentColor"
                className="text-slate-800"
                fill="transparent"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                strokeWidth="4"
                stroke="currentColor"
                className="text-emerald-400 transition-all duration-500"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - completionPercentage / 100)}
              />
            </svg>
            <span className="absolute text-[10px] font-mono font-extrabold text-white">
              {completionPercentage}%
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {allBadges.map((badge) => {
          const unlockRecord = unlockedBadgeMap.get(badge.id);
          const isUnlocked = !!unlockRecord;

          return (
            <div
              key={badge.id}
              onClick={() => setSelectedBadge(badge)}
              className={`relative flex flex-col items-center p-4 rounded-xl border transition-all duration-300 cursor-pointer select-none group ${
                isUnlocked
                  ? 'bg-slate-900/60 border-emerald-500/20 hover:border-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'bg-slate-950/40 border-slate-900 opacity-60 hover:opacity-80 hover:border-slate-800'
              }`}
            >
              {/* Badge Icon Shield */}
              <div className="relative w-16 h-16 mb-3 flex items-center justify-center">
                {/* Visual backdrop for active vs locked badges */}
                <div
                  className={`absolute inset-0 rounded-full blur-md opacity-40 group-hover:opacity-75 transition-opacity duration-300 ${
                    isUnlocked ? 'bg-gradient-to-tr from-emerald-500 to-teal-500' : 'bg-slate-800'
                  }`}
                />
                
                {/* Actual Icon wrapper */}
                <div
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center text-2xl border bg-slate-900 overflow-hidden ${
                    isUnlocked
                      ? 'border-emerald-500/30 text-emerald-400'
                      : 'border-slate-800 text-slate-600 grayscale'
                  }`}
                >
                  {badge.icon_url.startsWith('http') || badge.icon_url.startsWith('/') ? (
                    <img
                      src={badge.icon_url}
                      alt={badge.nombre}
                      className={`w-full h-full object-cover ${!isUnlocked && 'grayscale'}`}
                    />
                  ) : (
                    // Fallback to text/emoji representation if icon_url is a symbol
                    <span>{badge.icon_url || '🏅'}</span>
                  )}
                </div>

                {/* Locked Padlock Overlap */}
                {!isUnlocked && (
                  <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-lg text-[10px] text-slate-500">
                    🔒
                  </div>
                )}
              </div>

              {/* Title & Status */}
              <span className={`text-sm font-bold text-center group-hover:text-emerald-400 transition-colors ${
                isUnlocked ? 'text-slate-100' : 'text-slate-500'
              }`}>
                {badge.nombre}
              </span>
              
              <span className="text-[10px] text-slate-500 mt-1 text-center font-mono">
                {isUnlocked ? 'Desbloqueado' : 'Bloqueado'}
              </span>

              {/* Unlock Date Tag */}
              {isUnlocked && unlockRecord && (
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full mt-2 font-mono">
                  {new Date(unlockRecord.otorgado_en).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Badge Detail Modal/Modal Sheet */}
      {selectedBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-2xl relative flex flex-col items-center text-center animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setSelectedBadge(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center transition-colors"
            >
              ✕
            </button>

            {/* Badge Render in Modal */}
            <div className="relative w-24 h-24 mb-4 mt-2">
              <div
                className={`absolute inset-0 rounded-full blur-xl opacity-50 ${
                  unlockedBadgeMap.has(selectedBadge.id)
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-500'
                    : 'bg-slate-800'
                }`}
              />
              <div
                className={`relative w-24 h-24 rounded-full flex items-center justify-center text-4xl border bg-slate-950 ${
                  unlockedBadgeMap.has(selectedBadge.id)
                    ? 'border-emerald-400 text-emerald-400'
                    : 'border-slate-800 text-slate-600 grayscale'
                }`}
              >
                {selectedBadge.icon_url.startsWith('http') || selectedBadge.icon_url.startsWith('/') ? (
                  <img
                    src={selectedBadge.icon_url}
                    alt={selectedBadge.nombre}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span>{selectedBadge.icon_url || '🏅'}</span>
                )}
              </div>
            </div>

            <h3 className="text-xl font-black text-white">{selectedBadge.nombre}</h3>
            <p className="text-sm text-slate-300 mt-2 max-w-xs">{selectedBadge.descripcion}</p>

            <div className="w-full border-t border-slate-800 my-4 pt-4 flex flex-col items-center gap-2">
              <div className="text-xs text-slate-400">
                <span className="font-semibold text-slate-500 uppercase tracking-wide block mb-1">Criterio de Desbloqueo</span>
                <code className="bg-slate-950 px-3 py-1 rounded text-emerald-400 font-mono text-[11px] border border-slate-950">
                  {selectedBadge.criterio_desbloqueo}
                </code>
              </div>

              {unlockedBadgeMap.has(selectedBadge.id) ? (
                <div className="text-xs text-emerald-400 mt-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-semibold">
                  ✓ Desbloqueado el{' '}
                  {new Date(unlockedBadgeMap.get(selectedBadge.id)!.otorgado_en).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-500 mt-2 bg-slate-950 px-3 py-1 rounded-full border border-slate-900">
                  🔒 Aún no obtenido
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedBadge(null)}
              className="mt-2 w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
