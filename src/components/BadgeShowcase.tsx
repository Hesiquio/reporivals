import { FC } from 'hono/jsx';

export interface Badge {
  id: string;
  nombre: string;
  descripcion: string;
  icon_url: string;
  criterio_desbloqueo: any;
}

export interface DevBadge {
  id: string;
  dev_id: string;
  badge_id: string;
  otorgado_en: string;
}

interface BadgeShowcaseProps {
  allBadges: Badge[];
  devBadges: DevBadge[];
  devName: string;
}

export function formatBadgeCriterion(criterioRaw: any): string {
  if (!criterioRaw) return 'Requisito especial';
  let c: any = criterioRaw;
  if (typeof c === 'string') {
    try {
      c = JSON.parse(c);
    } catch {
      return c;
    }
  }
  if (!c || typeof c !== 'object') return String(c);

  switch (c.type) {
    case 'first_commit':
      return 'Registrar tu primer commit o aportación en GitHub';
    case 'streak': {
      const days = c.target_days || c.target || c.days || 3;
      return `Mantener una racha de ${days} días seguidos de aportaciones`;
    }
    case 'commits': {
      const min = c.target || c.min || 1;
      return `Acumular al menos ${min} aportaciones / commits`;
    }
    case 'prs': {
      const min = c.target || c.min || 1;
      return `Abrir o participar en al menos ${min} Pull Request${min > 1 ? 's' : ''}`;
    }
    case 'issues': {
      const min = c.target || c.min || 1;
      return `Abrir o participar en al menos ${min} Issue${min > 1 ? 's' : ''}`;
    }
    case 'repos': {
      const min = c.target || c.min || 1;
      return `Tener al menos ${min} repositorios públicos en GitHub`;
    }
    case 'score': {
      const min = c.target || c.min || 1;
      return `Alcanzar ${Number(min).toLocaleString()} puntos de score total`;
    }
    case 'languages': {
      const min = c.target || c.min || 1;
      return `Utilizar activamente al menos ${min} lenguajes de programación distintos`;
    }
    default:
      return typeof c === 'string' ? c : JSON.stringify(c);
  }
}

export const BadgeShowcase: FC<BadgeShowcaseProps> = ({
  allBadges = [],
  devBadges = [],
  devName,
}) => {
  const unlockedBadgeMap = new Map<string, DevBadge>();
  devBadges.forEach((sb) => {
    unlockedBadgeMap.set(sb.badge_id, sb);
  });

  const earnedCount = devBadges.length;
  const totalCount = allBadges.length;
  const completionPercentage = totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0;

  // Sort: unlocked first (by awarded date descending), then locked badges alphabetically
  const sortedBadges = [...allBadges].sort((a, b) => {
    const aUnlocked = unlockedBadgeMap.has(a.id);
    const bUnlocked = unlockedBadgeMap.has(b.id);
    if (aUnlocked && !bUnlocked) return -1;
    if (!aUnlocked && bUnlocked) return 1;
    if (aUnlocked && bUnlocked) {
      const aDate = unlockedBadgeMap.get(a.id)?.otorgado_en || '';
      const bDate = unlockedBadgeMap.get(b.id)?.otorgado_en || '';
      return bDate.localeCompare(aDate);
    }
    return a.nombre.localeCompare(b.nombre);
  });

  return (
    <div className="w-full text-slate-100 bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-2xl flex flex-col gap-6">
      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-wide flex items-center gap-2">
            🏆 Vitrina de Insignias
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Logros e hitos alcanzados por <span className="text-emerald-400 font-semibold">{devName}</span>
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
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - completionPercentage / 100)}`}
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
        {sortedBadges.map((badge) => {
          const unlockRecord = unlockedBadgeMap.get(badge.id);
          const isUnlocked = !!unlockRecord;
          const statusText = isUnlocked ? 'Desbloqueado' : 'Bloqueado';
          const unlockDate = isUnlocked && unlockRecord 
            ? new Date(unlockRecord.otorgado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) 
            : '';
          const criterioTexto = formatBadgeCriterion(badge.criterio_desbloqueo);
          const statusDetail = isUnlocked && unlockRecord
            ? `Desbloqueado el ${new Date(unlockRecord.otorgado_en).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`
            : '🔒 Aún no obtenido';

          return (
            <div
              key={badge.id}
              data-badge-title={badge.nombre}
              data-badge-desc={badge.descripcion}
              data-badge-icon={badge.icon_url}
              data-badge-criterio={criterioTexto}
              data-badge-status={statusDetail}
              data-badge-unlocked={isUnlocked ? 'true' : 'false'}
              onclick="openBadgeModal(this)"
              className={`relative flex flex-col items-center p-4 rounded-xl border transition-all duration-300 cursor-pointer select-none group ${
                isUnlocked
                  ? 'bg-slate-900/60 border-emerald-500/20 hover:border-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  : 'bg-slate-950/40 border-slate-900 opacity-60 hover:opacity-80 hover:border-slate-800'
              }`}
            >
              {/* Badge Icon Shield */}
              <div className="relative w-16 h-16 mb-3 flex items-center justify-center">
                <div
                  className={`absolute inset-0 rounded-full blur-md opacity-40 group-hover:opacity-75 transition-opacity duration-300 ${
                    isUnlocked ? 'bg-gradient-to-tr from-emerald-500 to-teal-500' : 'bg-slate-800'
                  }`}
                />
                
                <div
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center text-2xl border bg-slate-900 overflow-hidden ${
                    isUnlocked ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-800 text-slate-650 grayscale'
                  }`}
                >
                  {badge.icon_url && (badge.icon_url.startsWith('http') || badge.icon_url.startsWith('/')) ? (
                    <img
                      src={badge.icon_url}
                      alt={badge.nombre}
                      className={`w-full h-full object-cover ${!isUnlocked && 'grayscale'}`}
                    />
                  ) : (
                    <span>{badge.icon_url || '🏅'}</span>
                  )}
                </div>

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
                {statusText}
              </span>

              {isUnlocked && (
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full mt-2 font-mono">
                  {unlockDate}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Standalone HTML5 Dialog Modal Sheet */}
      <dialog
        id="badge-modal"
        className="bg-transparent backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm p-4 w-full max-w-md focus:outline-none"
      >
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl relative flex flex-col items-center text-center">
          <button
            onclick="document.getElementById('badge-modal').close()"
            className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            ✕
          </button>

          {/* Icon frame in dialog */}
          <div className="relative w-24 h-24 mb-4 mt-2">
            <div id="m-back" className="absolute inset-0 rounded-full blur-xl opacity-50 bg-slate-800" />
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center text-4xl border border-slate-800 bg-slate-950 text-slate-300 overflow-hidden">
              <span id="m-icon">🏅</span>
            </div>
          </div>

          <h3 id="m-title" className="text-xl font-black text-white">Título de Insignia</h3>
          <p id="m-desc" className="text-sm text-slate-300 mt-2 max-w-xs">Descripción detallada.</p>

          <div className="w-full border-t border-slate-800 my-4 pt-4 flex flex-col items-center gap-3">
            <div className="w-full text-center">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Requisito de Desbloqueo</span>
              <div id="m-criterio" className="bg-slate-950/90 px-3.5 py-2 rounded-xl text-emerald-400 text-xs border border-slate-800 font-medium inline-block max-w-sm">
                criterio
              </div>
            </div>

            <div id="m-status-box" className="text-xs text-slate-500 mt-1 bg-slate-950 px-3.5 py-1.5 rounded-full border border-slate-900 font-semibold">
              <span id="m-status">Estado</span>
            </div>
          </div>

          <button
            onclick="document.getElementById('badge-modal').close()"
            className="mt-2 w-full bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold py-2 px-4 rounded-xl transition-all"
          >
            Cerrar
          </button>
        </div>
      </dialog>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            function openBadgeModal(el) {
              const title = el.getAttribute('data-badge-title') || '';
              const desc = el.getAttribute('data-badge-desc') || '';
              const icon = el.getAttribute('data-badge-icon') || '🏅';
              const criterio = el.getAttribute('data-badge-criterio') || '';
              const status = el.getAttribute('data-badge-status') || '';
              const isUnlocked = el.getAttribute('data-badge-unlocked') === 'true';

              document.getElementById('m-title').innerText = title;
              document.getElementById('m-desc').innerText = desc;
              
              const mIcon = document.getElementById('m-icon');
              if (icon.startsWith('http') || icon.startsWith('/')) {
                mIcon.innerHTML = '<img src="' + icon + '" class="w-full h-full object-cover rounded-full" />';
              } else {
                mIcon.innerText = icon;
              }

              document.getElementById('m-criterio').innerText = criterio;
              document.getElementById('m-status').innerText = status;

              const mBack = document.getElementById('m-back');
              const mStatusBox = document.getElementById('m-status-box');

              if (isUnlocked) {
                mBack.className = 'absolute inset-0 rounded-full blur-xl opacity-50 bg-gradient-to-tr from-emerald-500 to-teal-500';
                mStatusBox.className = 'text-xs text-emerald-400 mt-1 bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/20 font-semibold';
              } else {
                mBack.className = 'absolute inset-0 rounded-full blur-xl opacity-50 bg-slate-800';
                mStatusBox.className = 'text-xs text-slate-500 mt-1 bg-slate-950 px-3.5 py-1.5 rounded-full border border-slate-900 font-semibold';
              }

              document.getElementById('badge-modal').showModal();
            }
          `
        }}
      />
    </div>
  );
};
