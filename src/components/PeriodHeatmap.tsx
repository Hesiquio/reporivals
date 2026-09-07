import { FC } from 'hono/jsx';
import { ContributionDay } from './HeatmapComparator';
import { AcademicPeriod } from '../utils/periods';

interface PeriodHeatmapProps {
  devName: string;
  githubUsername: string;
  period: AcademicPeriod;
  stats: ContributionDay[];
}

export const PeriodHeatmap: FC<PeriodHeatmapProps> = ({
  devName,
  githubUsername,
  period,
  stats,
}) => {
  // Generate date list between period.startDate and period.endDate
  const dates: string[] = [];
  const start = new Date(period.startDate + 'T00:00:00');
  const end = new Date(period.endDate + 'T23:59:59');
  
  // Align start date to Sunday for a clean GitHub-style weekly column layout
  const alignedStart = new Date(start);
  alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay());

  const current = new Date(alignedStart);
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }

  const getIntensityClass = (total: number, isOutOfRange: boolean) => {
    if (isOutOfRange) return 'bg-slate-950/40 border-transparent opacity-20';
    if (total === 0) return 'bg-slate-900 border-slate-950';
    if (total <= 2) return 'bg-emerald-900/50 border-emerald-950/10 text-emerald-100';
    if (total <= 5) return 'bg-emerald-700/70 border-emerald-800/10 text-emerald-50';
    if (total <= 8) return 'bg-emerald-500 border-emerald-600/20 text-white';
    return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)] border-emerald-300 text-white';
  };

  const statsMap = new Map<string, ContributionDay>();
  stats.forEach((stat) => statsMap.set(stat.fecha, stat));

  // Compute period totals
  let periodCommits = 0;
  let periodPRs = 0;
  let periodIssues = 0;
  stats.forEach((day) => {
    if (day.fecha >= period.startDate && day.fecha <= period.endDate) {
      periodCommits += day.commits || 0;
      periodPRs += day.pull_requests || 0;
      periodIssues += day.issues || 0;
    }
  });
  const periodTotal = periodCommits + periodPRs + periodIssues;

  return (
    <div className="w-full text-slate-100 bg-slate-900/40 backdrop-blur-md p-6 rounded-2xl border border-slate-850 shadow-2xl flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-4">
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            <span>📅</span> Actividad en Semestre: <span className="text-emerald-400">{period.name}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Contribuciones de <span className="text-emerald-400 font-semibold">{devName}</span>{' '}
            <a
              href={`https://github.com/${githubUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 hover:text-emerald-400 underline decoration-slate-700 transition-colors"
              title={`Ver perfil de GitHub de @${githubUsername}`}
            >
              (@{githubUsername})
            </a>{' '}
            durante este ciclo escolar
          </p>
        </div>
        <div className="flex gap-4 font-mono text-xs">
          <div className="text-right">
            <span className="block text-lg font-bold text-emerald-400">{periodTotal}</span>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">En Semestre</span>
          </div>
          <div className="text-right border-l border-slate-800 pl-4">
            <span className="block text-lg font-bold text-slate-350">{periodCommits}</span>
            <span className="text-[10px] text-slate-500 uppercase font-semibold">Commits</span>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="overflow-x-auto pb-2">
        <div className="min-w-[650px] flex flex-col gap-2">
          {/* Heatmap Grid: 7 rows, ~26 columns for 6 months */}
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
            {dates.map((dateStr) => {
              const isOutOfRange = dateStr < period.startDate || dateStr > period.endDate;
              const statsObj = statsMap.get(dateStr) || {
                fecha: dateStr,
                commits: 0,
                pull_requests: 0,
                issues: 0,
                stars_received: 0,
              };
              const totalContributions = (statsObj.commits || 0) + (statsObj.pull_requests || 0) + (statsObj.issues || 0);
              const intensity = getIntensityClass(totalContributions, isOutOfRange);
              const tooltipText = isOutOfRange
                ? `${dateStr}: Fuera de periodo`
                : `${dateStr}: ${statsObj.commits} commits, ${statsObj.pull_requests} PRs, ${statsObj.issues} issues`;

              return (
                <div
                  key={dateStr}
                  className={`w-[11px] h-[11px] rounded-[1.5px] border transition-all duration-150 cursor-pointer relative group/cell ${intensity}`}
                >
                  {!isOutOfRange && (
                    <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/cell:block bg-slate-950 text-slate-100 text-[10px] py-1 px-2 rounded border border-slate-800 whitespace-nowrap z-50 shadow-xl font-sans">
                      {tooltipText}
                    </div>
                  )}
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
        <span className="text-slate-500 font-mono text-[10px]">
          Rango: {period.startDate} al {period.endDate}
        </span>
      </div>
    </div>
  );
};
