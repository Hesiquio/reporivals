import { FC } from 'hono/jsx';
import { ContributionDay } from './HeatmapComparator';

interface StudentHeatmapProps {
  studentName: string;
  githubUsername: string;
  stats: ContributionDay[];
  daysToDisplay?: number;
}

export const StudentHeatmap: FC<StudentHeatmapProps> = ({
  studentName,
  githubUsername,
  stats,
  daysToDisplay = 365,
}) => {
  // Generate date list for the last 365 days (grouped into weeks)
  const dates: string[] = [];
  const today = new Date();
  
  // To align weeks correctly like GitHub (columns of Sunday to Saturday)
  // Let's go back exactly daysToDisplay days
  for (let i = daysToDisplay - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  const getIntensityClass = (total: number) => {
    if (total === 0) return 'bg-slate-900 border-slate-950';
    if (total <= 2) return 'bg-emerald-900/50 border-emerald-950/10 text-emerald-100';
    if (total <= 5) return 'bg-emerald-700/70 border-emerald-800/10 text-emerald-50';
    if (total <= 8) return 'bg-emerald-500 border-emerald-600/20 text-white';
    return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)] border-emerald-300 text-white';
  };

  const statsMap = new Map<string, ContributionDay>();
  stats.forEach((stat) => statsMap.set(stat.fecha, stat));

  // Compute total contributions
  let totalCommits = 0;
  let totalPRs = 0;
  let totalIssues = 0;
  stats.forEach((day) => {
    totalCommits += day.commits || 0;
    totalPRs += day.pull_requests || 0;
    totalIssues += day.issues || 0;
  });
  const grandTotal = totalCommits + totalPRs + totalIssues;

  return (
    <div className="w-full text-slate-100 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-850 shadow-2xl flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <span>🔥</span> Historial de Contribuciones
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Actividad de <span className="text-emerald-400 font-semibold">{studentName}</span> (@{githubUsername}) en el último año
          </p>
        </div>
        <div className="flex gap-4 font-mono text-xs">
          <div className="text-right">
            <span className="block text-lg font-bold text-emerald-400">{grandTotal}</span>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Contribuciones</span>
          </div>
          <div className="text-right border-l border-slate-800 pl-4">
            <span className="block text-lg font-bold text-slate-350">{totalCommits}</span>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Commits</span>
          </div>
        </div>
      </div>

      {/* Grid container with overflow handling */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[720px] flex flex-col gap-2">
          {/* Heatmap Grid: 7 rows (days of the week), multiple columns */}
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
            {dates.map((dateStr) => {
              const statsObj = statsMap.get(dateStr) || {
                fecha: dateStr,
                commits: 0,
                pull_requests: 0,
                issues: 0,
                stars_received: 0,
              };
              const totalContributions = (statsObj.commits || 0) + (statsObj.pull_requests || 0) + (statsObj.issues || 0);
              const intensity = getIntensityClass(totalContributions);
              const tooltipText = `${dateStr}: ${statsObj.commits} commits, ${statsObj.pull_requests} PRs, ${statsObj.issues} issues`;

              return (
                <div
                  key={dateStr}
                  className={`w-[11px] h-[11px] rounded-[1.5px] border transition-all duration-150 cursor-pointer relative group/cell ${intensity}`}
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/cell:block bg-slate-950 text-slate-100 text-[10px] py-1 px-2 rounded border border-slate-800 whitespace-nowrap z-50 shadow-xl font-sans">
                    {tooltipText}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-850/50 pt-3 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span>Menos</span>
          <div className="w-[11px] h-[11px] rounded-[1.5px] bg-slate-900 border border-slate-950" />
          <div className="w-[11px] h-[11px] rounded-[1.5px] bg-emerald-900/50 border border-emerald-950/10" />
          <div className="w-[11px] h-[11px] rounded-[1.5px] bg-emerald-700/70 border border-emerald-800/10" />
          <div className="w-[11px] h-[11px] rounded-[1.5px] bg-emerald-500 border border-emerald-600/20" />
          <div className="w-[11px] h-[11px] rounded-[1.5px] bg-emerald-400 border border-emerald-300" />
          <span>Más</span>
        </div>
        <span className="text-slate-600 italic text-[10px]">Pasa el cursor sobre un cuadro para ver detalles del día</span>
      </div>
    </div>
  );
};
