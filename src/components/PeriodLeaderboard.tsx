import { FC } from 'hono/jsx';
import { AcademicPeriod } from '../utils/periods';

export interface PeriodDevStats {
  id: string;
  nombre: string;
  github_username: string;
  avatar_url?: string;
  commits: number;
  pull_requests: number;
  issues: number;
  stars_received: number;
  total_contributions: number;
  period_score: number;
  active_days: number;
  has_activity: boolean;
  generacion?: string;
  numero_control?: string;
  carrera?: string;
}

interface PeriodLeaderboardProps {
  devs: PeriodDevStats[];
  period: AcademicPeriod;
  currentDevId?: string;
  isAdmin?: boolean;
  activeSort?: string;
  activeGen?: string;
  availableGens?: string[];
}

export const PeriodLeaderboard: FC<PeriodLeaderboardProps> = ({
  devs,
  period,
  currentDevId,
  isAdmin,
  activeSort = 'contributions',
  activeGen,
  availableGens = [],
}) => {
  const activeDevsCount = devs.filter((d) => d.has_activity).length;

  return (
    <div className="bg-slate-900/50 backdrop-blur-md border border-slate-850 rounded-2xl overflow-hidden shadow-2xl space-y-0">
      {/* Header bar */}
      <div className="px-6 py-5 border-b border-slate-850 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <h3 className="text-lg font-bold text-white tracking-wide">
              Rendimiento Semestral: <span className="text-emerald-400">{period.name}</span>
            </h3>
            {period.isCurrent && (
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">
                Semestre en Curso
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Periodo evaluado: <span className="font-mono text-slate-300">{period.startDate}</span> al{' '}
            <span className="font-mono text-slate-300">{period.endDate}</span> • Calificación basada en aportaciones dentro del rango.
          </p>
        </div>

        {/* View toggles & Teacher Action */}
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
          {/* Generation Filter */}
          {availableGens && availableGens.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-850">
              <span className="text-[10px] uppercase font-bold text-slate-400 pl-2">Gen:</span>
              <select
                className="text-xs bg-slate-900 border border-slate-750 text-white rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 font-semibold cursor-pointer"
                onchange="const params = new URLSearchParams(window.location.search); if (this.value) { params.set('gen', this.value); } else { params.delete('gen'); } window.location.search = params.toString();"
              >
                <option value="">Todas las Generaciones</option>
                {availableGens.map((g) => (
                  <option value={g} selected={activeGen === g}>
                    Gen {g}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-850">
            <a
              href={`?period=${period.id}&sort=contributions${activeGen ? `&gen=${activeGen}` : ''}`}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeSort === 'contributions'
                  ? 'bg-slate-900 text-white shadow-sm border border-slate-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🔥 Contribuciones
            </a>
            <a
              href={`?period=${period.id}&sort=score${activeGen ? `&gen=${activeGen}` : ''}`}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeSort === 'score'
                  ? 'bg-slate-900 text-emerald-400 shadow-sm border border-slate-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              💎 Puntos
            </a>
            <a
              href={`?period=${period.id}&sort=commits${activeGen ? `&gen=${activeGen}` : ''}`}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeSort === 'commits'
                  ? 'bg-slate-900 text-cyan-400 shadow-sm border border-slate-800'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              💻 Commits
            </a>
          </div>

          {/* Export to CSV Button for Teachers */}
          <button
            id="exportCsvBtn"
            type="button"
            className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-200 hover:text-white px-3 py-2 rounded-xl transition-all font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Copiar datos del semestre para Excel o Registro de Calificaciones"
          >
            <span>📋</span> Copiar Concentrado (Docente)
          </button>
        </div>
      </div>

      {devs.length === 0 ? (
        <div className="p-12 text-center text-slate-500 space-y-2">
          <p className="text-2xl">📚</p>
          <p className="text-sm font-medium">No hay alumnos registrados en el sistema.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table id="periodLeaderboardTable" className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-850/50 bg-slate-950/20 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                <th className="py-4 px-6 text-center w-16">Puesto</th>
                <th className="py-4 px-6">Alumno / Dev</th>
                <th className="py-4 px-6 text-center w-36 hidden sm:table-cell">Estado en Ciclo</th>
                <th className="py-4 px-6 text-right w-28">Commits</th>
                <th className="py-4 px-6 text-right w-28 hidden md:table-cell">PRs / Issues</th>
                <th className="py-4 px-6 text-right w-36">Contribuciones</th>
                <th className="py-4 px-6 text-right w-32">Puntos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/40">
              {devs.map((std, index) => {
                const isCurrent = std.id === currentDevId;
                const rank = index + 1;

                // Rank designators
                let rankBadge = <span className="text-slate-400 font-mono text-sm">{rank}</span>;
                let rowHighlight = "hover:bg-slate-900/20 transition-colors";
                if (std.has_activity) {
                  if (rank === 1) rankBadge = <span className="text-xl">🥇</span>;
                  else if (rank === 2) rankBadge = <span className="text-xl">🥈</span>;
                  else if (rank === 3) rankBadge = <span className="text-xl">🥉</span>;
                } else {
                  rankBadge = <span className="text-slate-600 font-mono text-xs">-</span>;
                  rowHighlight = "opacity-60 hover:opacity-90 hover:bg-slate-900/10 transition-all";
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
                        <a
                          href={`/dev/${std.github_username}`}
                          className="hover:opacity-85 transition-opacity"
                          title="Ver perfil en Repo Rivals"
                        >
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
                        </a>
                        <div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`/dev/${std.github_username}`}
                              className="text-sm font-bold text-white hover:text-emerald-400 transition-colors"
                            >
                              {std.nombre}
                            </a>
                            {isCurrent && (
                              <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 uppercase">
                                Tú
                              </span>
                            )}
                            {std.generacion && (
                              <span className="text-[9px] bg-slate-850 text-cyan-400 font-mono font-bold px-1.5 py-0.5 rounded border border-slate-750 shadow-sm" title={`Generación ${std.generacion}`}>
                                🎓 Gen {std.generacion}
                              </span>
                            )}
                            {std.carrera && (
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shadow-sm ${
                                std.carrera === 'IIAR'
                                  ? 'bg-purple-950/60 text-purple-400 border-purple-800/40'
                                  : 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                              }`} title={std.carrera === 'IIAR' ? 'Ingeniería en Inteligencia Artificial' : 'Ingeniería en Sistemas Computacionales'}>
                                {std.carrera}
                              </span>
                            )}
                          </div>
                          <a
                            href={`https://github.com/${std.github_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-400 hover:text-emerald-400 font-mono inline-flex items-center gap-1 hover:underline transition-colors group/gh mt-0.5"
                            title={`Abrir perfil de GitHub de @${std.github_username}`}
                          >
                            <span>@{std.github_username}</span>
                            <svg className="w-3 h-3 opacity-50 group-hover/gh:opacity-100 transition-opacity inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                              <polyline points="15 3 21 3 21 9"></polyline>
                              <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* Activity indicator */}
                    <td className="py-4 px-6 text-center hidden sm:table-cell">
                      {std.has_activity ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-950/30 border border-emerald-800/40 text-emerald-400 text-[11px] font-semibold px-2.5 py-1 rounded-full">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          Activo ({std.active_days} {std.active_days === 1 ? 'día' : 'días'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-slate-500 text-[11px] font-medium px-2.5 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                          Sin actividad
                        </span>
                      )}
                    </td>

                    {/* Commits */}
                    <td className="py-4 px-6 text-right">
                      <span className={`text-sm font-mono ${std.commits > 0 ? 'font-semibold text-slate-200' : 'text-slate-600'}`}>
                        {std.commits.toLocaleString()}
                      </span>
                    </td>

                    {/* PRs & Issues */}
                    <td className="py-4 px-6 text-right hidden md:table-cell">
                      <span className="text-xs font-mono text-slate-400">
                        {std.pull_requests} PRs • {std.issues} iss
                      </span>
                    </td>

                    {/* Total Contributions in Period */}
                    <td className="py-4 px-6 text-right">
                      <span className={`text-sm font-mono ${std.total_contributions > 0 ? 'font-bold text-white' : 'text-slate-600'}`}>
                        {std.total_contributions.toLocaleString()}
                      </span>
                    </td>

                    {/* Period Score */}
                    <td className="py-4 px-6 text-right">
                      <span className={`text-sm font-mono font-extrabold ${std.period_score > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {std.period_score.toLocaleString()} pts
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer bar */}
      <div className="px-6 py-4 bg-slate-950/40 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <span>
          Resumen docente: <strong className="text-slate-300">{activeDevsCount}</strong> de{' '}
          <strong className="text-slate-300">{devs.length}</strong> alumnos tuvieron aportaciones en este ciclo escolar.
        </span>
        <span className="text-[11px] font-mono text-slate-600">
          Puntos: 10/commit • 20/PR • 5/issue
        </span>
      </div>

      {/* Client-side script for CSV copy */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.getElementById('exportCsvBtn')?.addEventListener('click', function() {
              const rows = [
                ['Puesto', 'Nombre', 'Usuario GitHub', 'Carrera', 'Generación', 'No. Control', 'Estado', 'Dias Activo', 'Commits', 'PRs', 'Issues', 'Contribuciones', 'Puntos'],
                ${JSON.stringify(
                  devs.map((d, i) => [
                    d.has_activity ? i + 1 : 'N/A',
                    d.nombre,
                    d.github_username,
                    d.carrera || 'ISC',
                    d.generacion || 'N/A',
                    d.numero_control || 'N/A',
                    d.has_activity ? 'Activo' : 'Sin actividad',
                    d.active_days,
                    d.commits,
                    d.pull_requests,
                    d.issues,
                    d.total_contributions,
                    d.period_score,
                  ])
                )}.map(r => r.join('\\t')).join('\\n')
              ];
              const tsvContent = rows.join('\\n');
              navigator.clipboard.writeText(tsvContent).then(function() {
                const btn = document.getElementById('exportCsvBtn');
                if (btn) {
                  const original = btn.innerHTML;
                  btn.innerHTML = '<span>✅</span> ¡Copiado al Portapapeles!';
                  btn.classList.add('bg-emerald-950', 'text-emerald-400', 'border-emerald-800');
                  setTimeout(function() {
                    btn.innerHTML = original;
                    btn.classList.remove('bg-emerald-950', 'text-emerald-400', 'border-emerald-800');
                  }, 2500);
                }
              }).catch(function(err) {
                alert('No se pudo copiar automáticamente. Puedes seleccionar y copiar la tabla directamente.');
              });
            });
          `,
        }}
      />
    </div>
  );
};
