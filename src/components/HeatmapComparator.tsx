import { FC } from 'hono/jsx';

export interface ContributionDay {
  fecha: string; // YYYY-MM-DD
  commits: number;
  pull_requests: number;
  issues: number;
  stars_received: number;
}

export interface Dev {
  id: string;
  nombre: string;
  github_username: string;
  avatar_url: string;
  total_score: number;
}

export interface DevWithStats {
  dev: Dev;
  stats: ContributionDay[];
}

interface HeatmapComparatorProps {
  devA: DevWithStats;
  devB: DevWithStats;
  daysToDisplay?: number;
}

export const HeatmapComparator: FC<HeatmapComparatorProps> = ({
  devA,
  devB,
  daysToDisplay = 120,
}) => {
  // Generate date list
  const dates: string[] = [];
  const today = new Date();
  for (let i = daysToDisplay - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  const getIntensityClass = (total: number) => {
    if (total === 0) return 'bg-slate-800 border-slate-900';
    if (total <= 2) return 'bg-emerald-900/60 border-emerald-950/20 text-emerald-100';
    if (total <= 5) return 'bg-emerald-700/80 border-emerald-800/20 text-emerald-50';
    if (total <= 8) return 'bg-emerald-500 border-emerald-600/30 text-white';
    return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)] border-emerald-300 text-white';
  };

  const getStatsMap = (statsList: ContributionDay[]) => {
    const map = new Map<string, ContributionDay>();
    statsList.forEach((stat) => map.set(stat.fecha, stat));
    return map;
  };

  const statsMapA = getStatsMap(devA.stats);
  const statsMapB = getStatsMap(devB.stats);

  const getAggregatedStats = (devStats: ContributionDay[]) => {
    let totalCommits = 0;
    let totalPRs = 0;
    let totalIssues = 0;
    let maxContributionsSingleDay = 0;

    devStats.forEach((day) => {
      totalCommits += day.commits;
      totalPRs += day.pull_requests;
      totalIssues += day.issues;
      const dayTotal = day.commits + day.pull_requests + day.issues;
      if (dayTotal > maxContributionsSingleDay) {
        maxContributionsSingleDay = dayTotal;
      }
    });

    const totalContributions = totalCommits + totalPRs + totalIssues;
    return {
      totalContributions,
      maxContributionsSingleDay,
      averagePerDay: (totalContributions / Math.max(devStats.length, 1)).toFixed(2),
    };
  };

  const aggA = getAggregatedStats(devA.stats);
  const aggB = getAggregatedStats(devB.stats);

  const renderHeatmapGrid = (statsMap: Map<string, ContributionDay>) => {
    return (
      <div className="grid grid-flow-col grid-rows-7 gap-1 p-4 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl overflow-x-auto">
        {dates.map((dateStr) => {
          const stats = statsMap.get(dateStr) || {
            fecha: dateStr,
            commits: 0,
            pull_requests: 0,
            issues: 0,
            stars_received: 0,
          };
          const totalContributions = stats.commits + stats.pull_requests + stats.issues;
          const intensity = getIntensityClass(totalContributions);
          const tooltipText = `${dateStr}: ${stats.commits} commits, ${stats.pull_requests} PRs, ${stats.issues} issues`;

          return (
            <div
              key={dateStr}
              className={`w-3.5 h-3.5 rounded-sm border transition-all duration-205 cursor-pointer relative group/cell ${intensity}`}
            >
              {/* Native CSS hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/cell:block bg-slate-950 text-slate-100 text-[10px] py-1 px-2 rounded border border-slate-800 whitespace-nowrap z-50">
                {tooltipText}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full text-slate-100 bg-slate-950 p-6 rounded-2xl border border-slate-900 shadow-2xl flex flex-col gap-6">
      {/* Header section with profile cards */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-b border-slate-900 pb-6">
        <div className="flex items-center gap-4 w-full md:w-5/12 bg-slate-900/30 p-4 rounded-xl border border-slate-900">
          <img
            src={devA.dev.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'}
            alt={devA.dev.nombre}
            className="w-14 h-14 rounded-full ring-2 ring-emerald-500/50"
          />
          <div>
            <h3 className="font-bold text-lg text-emerald-400">{devA.dev.nombre}</h3>
            <p className="text-sm text-slate-400">@{devA.dev.github_username}</p>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono mt-1 inline-block">
              Puntaje: {devA.dev.total_score} pts
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 px-4 py-1.5 rounded-full font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20">
            Vs
          </div>
          <span className="text-xs text-slate-500 mt-1">Duelo Amistoso</span>
        </div>

        <div className="flex items-center gap-4 w-full md:w-5/12 justify-end bg-slate-900/30 p-4 rounded-xl border border-slate-900 text-right">
          <div>
            <h3 className="font-bold text-lg text-teal-400">{devB.dev.nombre}</h3>
            <p className="text-sm text-slate-400">@{devB.dev.github_username}</p>
            <span className="text-xs bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full font-mono mt-1 inline-block">
              Puntaje: {devB.dev.total_score} pts
            </span>
          </div>
          <img
            src={devB.dev.avatar_url || 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80'}
            alt={devB.dev.nombre}
            className="w-14 h-14 rounded-full ring-2 ring-teal-500/50"
          />
        </div>
      </div>

      {/* KPI Comparison Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aportaciones Totales</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-emerald-400">{aggA.totalContributions}</span>
            <span className="text-slate-600 font-bold">vs</span>
            <span className="text-2xl font-black text-teal-400">{aggB.totalContributions}</span>
          </div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Promedio Diario</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-emerald-400">{aggA.averagePerDay}</span>
            <span className="text-slate-600 font-bold">vs</span>
            <span className="text-2xl font-black text-teal-400">{aggB.averagePerDay}</span>
          </div>
        </div>

        <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Máximo en un Día</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-emerald-400">{aggA.maxContributionsSingleDay}</span>
            <span className="text-slate-600 font-bold">vs</span>
            <span className="text-2xl font-black text-teal-400">{aggB.maxContributionsSingleDay}</span>
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Heatmap: {devA.dev.nombre}</span>
            <span className="text-xs text-slate-500">Últimos {daysToDisplay} días</span>
          </div>
          {renderHeatmapGrid(statsMapA)}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Heatmap: {devB.dev.nombre}</span>
            <span className="text-xs text-slate-500">Últimos {daysToDisplay} días</span>
          </div>
          {renderHeatmapGrid(statsMapB)}
        </div>
      </div>

      {/* Heatmap Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-900 pt-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <span>Menos</span>
          <div className="w-3.5 h-3.5 rounded-sm bg-slate-800 border border-slate-900" />
          <div className="w-3.5 h-3.5 rounded-sm bg-emerald-900/60 border border-emerald-950/20" />
          <div className="w-3.5 h-3.5 rounded-sm bg-emerald-700/80 border border-emerald-800/20" />
          <div className="w-3.5 h-3.5 rounded-sm bg-emerald-500 border border-emerald-600/30" />
          <div className="w-3.5 h-3.5 rounded-sm bg-emerald-400 border border-emerald-300" />
          <span>Más</span>
        </div>
        <span className="text-slate-650 italic text-[10px]">Pasa el cursor sobre un cuadro para ver detalles del día</span>
      </div>
    </div>
  );
};
