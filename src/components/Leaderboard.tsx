import { FC } from 'hono/jsx';

export interface LeaderboardDev {
  id: string;
  nombre: string;
  github_username: string;
  avatar_url?: string;
  total_score: number;
  total_contributions: number;
  badges?: Array<{
    id: string;
    nombre: string;
    icon_url: string;
  }>;
}

interface LeaderboardProps {
  devs: LeaderboardDev[];
  currentDevId?: string;
  isAdmin?: boolean;
  activeSort?: string;
}

export const Leaderboard: FC<LeaderboardProps> = ({ devs, currentDevId, isAdmin, activeSort = 'contributions' }) => {
  return (
    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-850 rounded-2xl overflow-hidden shadow-2xl">
      <div className="px-6 py-5 border-b border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <span>🏆</span> Ranking de Devs
          </h3>
          <p className="text-xs text-slate-400 mt-1">Tabla de posiciones en tiempo real según su actividad en GitHub</p>
        </div>

        {/* View toggles (Contribuciones vs Puntos vs Concentrado) */}
        <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-850 self-start sm:self-auto">
          <a
            href="?sort=contributions"
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSort === 'contributions'
                ? 'bg-slate-900 text-white shadow-sm border border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🔥 Contribuciones
          </a>
          <a
            href="?sort=score"
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSort === 'score'
                ? 'bg-slate-900 text-emerald-400 shadow-sm border border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            💎 Puntos
          </a>
          <a
            href="?sort=all"
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
              activeSort === 'all'
                ? 'bg-slate-900 text-amber-400 shadow-sm border border-slate-800'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            📊 Concentrado
          </a>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <a href="/admin/sync-all" className="text-xs font-bold text-emerald-400 hover:text-emerald-350 bg-emerald-950/20 border border-emerald-900/30 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-950/10">
              <span>🔄</span> Sincronizar Todo
            </a>
          )}
          <span className="text-xs font-mono text-slate-500 bg-slate-950/40 border border-slate-850 px-2 py-1 rounded-md">
            {devs.length} Registrados
          </span>
        </div>
      </div>

      {devs.length === 0 ? (
        <div className="p-12 text-center text-slate-500 space-y-2">
          <p className="text-2xl">👋</p>
          <p className="text-sm font-medium">No hay devs registrados aún.</p>
          <p className="text-xs text-slate-600">¡Sé el primero en iniciar sesión para aparecer en el ranking!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-850/50 bg-slate-950/20 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                <th className="py-4 px-6 text-center w-16">Puesto</th>
                <th className="py-4 px-6">Dev</th>
                <th className="py-4 px-6 hidden md:table-cell">Insignias</th>
                {(activeSort === 'contributions' || activeSort === 'all') && (
                  <th className="py-4 px-6 text-right w-36">Contribuciones</th>
                )}
                {(activeSort === 'score' || activeSort === 'all') && (
                  <th className="py-4 px-6 text-right w-32">Puntos</th>
                )}
                {isAdmin && <th className="py-4 px-6 text-center w-20">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/40">
              {devs.map((std, index) => {
                const rank = index + 1;
                const isCurrent = std.id === currentDevId;

                // Rank designators
                let rankBadge = <span className="text-slate-400 font-mono text-sm">{rank}</span>;
                let rowHighlight = "hover:bg-slate-900/20 transition-colors";
                if (rank === 1) {
                  rankBadge = <span className="text-xl">🥇</span>;
                } else if (rank === 2) {
                  rankBadge = <span className="text-xl">🥈</span>;
                } else if (rank === 3) {
                  rankBadge = <span className="text-xl">🥉</span>;
                }

                if (isCurrent) {
                  rowHighlight = "bg-emerald-950/10 hover:bg-emerald-950/20 border-l-2 border-emerald-500 transition-colors";
                }

                return (
                  <tr key={std.id} className={rowHighlight}>
                    <td className="py-4 px-6 text-center font-bold">
                      {rankBadge}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        {std.avatar_url ? (
                          <img
                            src={std.avatar_url}
                            className="w-10 h-10 rounded-full border border-slate-800 shadow-sm"
                            alt={std.nombre}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full border border-slate-800 bg-slate-800 flex items-center justify-center font-black text-sm text-white">
                            {std.nombre.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white">{std.nombre}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase">
                                Tú
                               </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 font-mono">@{std.github_username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 hidden md:table-cell">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {std.badges && std.badges.length > 0 ? (
                          std.badges.map((badge) => (
                            <span
                              key={badge.id}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-950 border border-slate-800 text-sm cursor-help relative group"
                              title={badge.nombre}
                            >
                              {badge.icon_url}
                              {/* Custom micro-tooltip on hover */}
                              <span className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap bg-slate-950 border border-slate-850 px-2 py-1 text-[10px] rounded text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity font-sans shadow-xl">
                                {badge.nombre}
                              </span>
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-650 font-mono italic">Sin insignias</span>
                        )}
                      </div>
                    </td>
                    {(activeSort === 'contributions' || activeSort === 'all') && (
                      <td className="py-4 px-6 text-right">
                        <span className="text-sm font-semibold text-slate-300 font-mono">
                          {std.total_contributions.toLocaleString()}
                        </span>
                      </td>
                    )}
                    {(activeSort === 'score' || activeSort === 'all') && (
                      <td className="py-4 px-6 text-right">
                        <span className="text-sm font-extrabold text-emerald-400 font-mono">
                          {std.total_score.toLocaleString()} pts
                        </span>
                      </td>
                    )}
                    {isAdmin && (
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <a
                            href={`/admin/sync-dev/${std.id}`}
                            className="text-xs bg-emerald-950/45 hover:bg-emerald-900/50 border border-emerald-900/35 text-emerald-400 p-1.5 rounded transition-colors inline-block"
                            title="Sincronizar Dev"
                          >
                            🔄
                          </a>
                          <a
                            href={`/admin/delete-dev/${std.id}`}
                            onclick="return confirm('¿Seguro que deseas eliminar a este dev del ranking?')"
                            className="text-xs bg-red-950/45 hover:bg-red-900/50 border border-red-900/30 text-red-400 p-1.5 rounded transition-colors inline-block"
                            title="Eliminar Dev"
                          >
                            🗑️
                          </a>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
