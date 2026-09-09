import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { HeatmapComparator, DevWithStats } from './components/HeatmapComparator';
import { BadgeShowcase, Badge, DevBadge } from './components/BadgeShowcase';
import { Leaderboard, LeaderboardDev } from './components/Leaderboard';
import { DevHeatmap } from './components/DevHeatmap';
import { PeriodLeaderboard, PeriodDevStats } from './components/PeriodLeaderboard';
import { PeriodHeatmap } from './components/PeriodHeatmap';
import { getPeriodById, getAvailablePeriods, getCurrentPeriod, AcademicPeriod } from './utils/periods';
import { StudentProfile } from './components/StudentProfile';
import 'hono/jsx/jsx-runtime';

const app = new Hono();

// Load environment variables (natively resolved by Bun from .env files or environment)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const GITHUB_PAT = process.env.GITHUB_PAT || '';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const POINTS_PER_COMMIT = 10;
const POINTS_PER_PR = 20;
const POINTS_PER_ISSUE = 5;
const POINTS_PER_STAR = 15;

interface BadgeCriterion {
  type: string;
  target_days?: number;
  metric?: string;
}

// 0. Helper function to sync a single dev's GitHub stats historically using GraphQL API
async function syncDevStats(dev: { id: string; github_username: string }) {
  if (!supabase) return 0;

  const query = `
    query($username: String!) {
      user(login: $username) {
        name
        avatarUrl
        repositories(isFork: false, privacy: PUBLIC, first: 15, orderBy: {field: UPDATED_AT, direction: DESC}) {
          totalCount
          nodes {
            primaryLanguage {
              name
              color
            }
          }
        }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "RepoRivals-App"
    };
    if (GITHUB_PAT) {
      headers["Authorization"] = `Bearer ${GITHUB_PAT}`;
    }

    console.log(`[Sync] Fetching stats from GitHub GraphQL for username: ${dev.github_username}`);
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query,
        variables: { username: dev.github_username },
      }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.errors) {
        console.error(`[Sync] GitHub GraphQL query errors for ${dev.github_username}:`, JSON.stringify(result.errors));
        return 0;
      }

      const userObj = result.data?.user;
      if (userObj) {
        const collection = userObj.contributionsCollection;
        const calendar = collection.contributionCalendar;

        const weeks = calendar.weeks || [];
        const bulkStats: any[] = [];
        
        for (const week of weeks) {
          const days = week.contributionDays || [];
          for (const day of days) {
            const dateStr = day.date;
            const count = day.contributionCount || 0;

            // Collect the daily contribution count as commits in stats array
            bulkStats.push({
              dev_id: dev.id,
              fecha: dateStr,
              stats: { commits: count, pull_requests: 0, issues: 0, stars_received: 0 }
            });
          }
        }

        // Perform bulk upsert in a single network request
        if (bulkStats.length > 0) {
          const { error: upsertError } = await supabase
            .from("github_stats")
            .upsert(bulkStats, { onConflict: "dev_id,fecha" });
          
          if (upsertError) {
            console.error(`[Sync] Bulk upsert error for ${dev.github_username}:`, upsertError);
          }
        }

        // Calculate score from exact GraphQL aggregates
        const commits = collection.totalCommitContributions || 0;
        const prs = collection.totalPullRequestContributions || 0;
        const issues = collection.totalIssueContributions || 0;

        const newScore = commits * POINTS_PER_COMMIT + prs * POINTS_PER_PR + issues * POINTS_PER_ISSUE;

        const totalContributions = calendar.totalContributions || 0;
        const publicRepos = userObj.repositories?.totalCount || 0;
        
        // 1. Process languages distribution
        const repoNodes = userObj.repositories?.nodes || [];
        const languageCounts: Record<string, { count: number; color: string }> = {};
        let totalValids = 0;
        
        repoNodes.forEach((node: any) => {
          const lang = node.primaryLanguage;
          totalValids++;
          if (lang && lang.name) {
            if (!languageCounts[lang.name]) {
              languageCounts[lang.name] = { count: 0, color: lang.color || '#cccccc' };
            }
            languageCounts[lang.name].count++;
          } else {
            // Group repositories without primary language as "Otros"
            if (!languageCounts["Otros"]) {
              languageCounts["Otros"] = { count: 0, color: "#64748b" };
            }
            languageCounts["Otros"].count++;
          }
        });
        
        // Convert language counts to percentages and counts
        const languagesList = Object.entries(languageCounts).map(([name, val]) => ({
          name,
          color: val.color,
          count: val.count,
          percentage: totalValids > 0 ? Math.round((val.count / totalValids) * 100) : 0
        })).sort((a, b) => b.count - a.count);

        // 2. Compute Active Streak (días seguidos con aportaciones)
        let activeStreak = 0;
        if (bulkStats.length > 0) {
          // Sort stats chronologically descending (newest first)
          const sortedStats = [...bulkStats].sort((a, b) => b.fecha.localeCompare(a.fecha));
          
          const todayStr = new Date().toISOString().split('T')[0];
          const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          
          const hasTodayActivity = sortedStats.find(s => s.fecha === todayStr && s.stats.commits > 0);
          const hasYesterdayActivity = sortedStats.find(s => s.fecha === yesterdayStr && s.stats.commits > 0);
          
          if (hasTodayActivity || hasYesterdayActivity) {
            // Start counting backwards
            for (const day of sortedStats) {
              // Ignore future days if any, start counting from today/yesterday backwards
              if (day.fecha > todayStr) continue;
              
              if (day.stats.commits > 0) {
                activeStreak++;
              } else {
                // If it's today and we haven't done commits yet, don't break the streak immediately
                if (day.fecha === todayStr) continue;
                break; // Streak is broken
              }
            }
          }
        }

        // Safe metadata update fallback
        const currentMetadata = (dev as any).metadata || {};
        const updatedMetadata = { 
          ...currentMetadata, 
          public_repos: publicRepos,
          languages: languagesList,
          current_streak: activeStreak
        };
        
        // Auto-fill avatar and name if not already set or updated from GitHub
        const updateData: any = { 
          total_score: newScore, 
          total_contributions: totalContributions,
          metadata: updatedMetadata
        };
        if (userObj.avatarUrl) {
          updateData.avatar_url = userObj.avatarUrl;
        }
        if (userObj.name) {
          updateData.nombre = userObj.name;
        }

        // 1. Perform safe primary update (score, contributions, metadata, name, avatar)
        await supabase.from("devs").update(updateData).eq("id", dev.id);

        // 2. Perform silent update on dedicated columns (which might not exist yet in DB)
        try {
          await supabase.from("devs").update({ 
            public_repos: publicRepos,
            current_streak: activeStreak
          }).eq("id", dev.id);
        } catch (e) {
          // Fallback to metadata is active if columns are missing
        }

        // Evaluate badges
        const totalCommits = commits;
        const { data: dbBadges } = await supabase.from("badges").select("id, criterio_desbloqueo");
        for (const badge of dbBadges || []) {
          const criterion = (badge.criterio_desbloqueo as unknown as BadgeCriterion) || {};
          if (criterion.type === "first_commit") {
            if (totalCommits > 0) {
              try {
                await supabase.from("dev_badges").insert({ dev_id: dev.id, badge_id: badge.id });
              } catch (e) {}
            }
          } else if (criterion.type === "streak") {
            const targetDays = criterion.target_days || 3;
            const metric = criterion.metric || "commits";

            const { data: history } = await supabase.from("github_stats").select("fecha, stats").eq("dev_id", dev.id).order("fecha", { ascending: true });
            if (history) {
              let consecutiveDays = 0;
              let maxConsecutive = 0;
              let lastDate: Date | null = null;

              for (const row of history) {
                const val = row.stats?.[metric] || 0;
                if (val > 0) {
                  const currentDate = new Date(row.fecha);
                  if (lastDate === null) {
                    consecutiveDays = 1;
                  } else {
                    const diffDays = Math.ceil(Math.abs(currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays === 1) consecutiveDays++;
                    else if (diffDays > 1) consecutiveDays = 1;
                  }
                  lastDate = currentDate;
                  if (consecutiveDays > maxConsecutive) maxConsecutive = consecutiveDays;
                }
              }
              if (maxConsecutive >= targetDays) {
                try {
                  await supabase.from("dev_badges").insert({ dev_id: dev.id, badge_id: badge.id });
                } catch (e) {}
              }
            }
          }
        }

        return newScore;
      }
    } else {
      console.error("GraphQL request failed:", response.status, await response.text());
    }
  } catch (err) {
    console.error("Error calling GitHub GraphQL API:", err);
  }

  return 0;
}

// 1. GET Route: Renders the Dashboard
app.get('/', async (c) => {
  // Auth state
  let currentDev: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: dev } = await supabase.from('devs').select('*').eq('auth_id', user.id).single();
        if (dev) {
          currentDev = dev;
        }
      }
    } catch (e) {
      console.error('Failed to get user from token:', e);
    }
  }

  // Sort and filter parameters
  const sort = c.req.query('sort') || 'contributions'; // default to contributions like github
  const genParam = c.req.query('gen') || '';

  // Load real devs list for Leaderboard
  let leaderboardDevs: LeaderboardDev[] = [];
  let availableGens: string[] = [];
  let devsData: any[] | null = null;
  if (supabase) {
    try {
      const orderColumn = sort === 'score' ? 'total_score' : 'total_contributions';
      const result = await supabase.from('devs').select('*').order(orderColumn, { ascending: false });
      devsData = result.data;

      // Extract unique generations from student metadata
      availableGens = Array.from(
        new Set(
          (devsData || [])
            .map((d: any) => d.metadata?.generacion)
            .filter((g: any) => typeof g === 'string' && g.trim() !== '')
        )
      ).sort().reverse();

      const { data: devBadgesData } = await supabase.from('dev_badges').select('dev_id, badges(id, nombre, icon_url)');
      
      const badgesByDev: Record<string, any[]> = {};
      devBadgesData?.forEach((row: any) => {
        const dId = row.dev_id;
        const b = row.badges;
        if (dId && b) {
          if (!badgesByDev[dId]) {
            badgesByDev[dId] = [];
          }
          if (!badgesByDev[dId].find(x => x.id === b.id)) {
            badgesByDev[dId].push({
              id: b.id,
              nombre: b.nombre,
              icon_url: b.icon_url,
            });
          }
        }
      });

      leaderboardDevs = (devsData || []).map((dev: any) => ({
        id: dev.id,
        nombre: dev.nombre,
        github_username: dev.github_username,
        avatar_url: dev.avatar_url,
        total_score: dev.total_score,
        total_contributions: dev.total_contributions || 0,
        public_repos: dev.public_repos || dev.metadata?.public_repos || 0,
        current_streak: dev.current_streak || dev.metadata?.current_streak || 0,
        badges: badgesByDev[dev.id] || [],
        generacion: dev.metadata?.generacion || undefined,
        numero_control: dev.metadata?.numero_control || undefined,
        carrera: dev.metadata?.carrera || 'ISC',
      }));

      // Filter by generation if specified
      if (genParam) {
        leaderboardDevs = leaderboardDevs.filter((d: any) => d.generacion === genParam);
      }
    } catch (e) {
      console.error("Failed to load leaderboard data:", e);
    }
  }

  // Calculate interactive banner stats
  const totalDevsCount = leaderboardDevs.length;
  const totalGlobalContributions = leaderboardDevs.reduce((sum, d) => sum + d.total_contributions, 0);

  // Group technologies and count projects globally
  const globalLanguagesMap: Record<string, { count: number; color: string }> = {};
  let computedTotalGlobalRepos = 0;

  leaderboardDevs.forEach((dev: any) => {
    // Attempt to read languages from raw dev object in database
    const rawDev = (devsData || []).find((d: any) => d.id === dev.id);
    const langs = rawDev?.metadata?.languages || [];
    
    langs.forEach((l: any) => {
      const name = l.name || 'Otros';
      const count = l.count || 1;
      const color = l.color || '#64748b';
      
      if (!globalLanguagesMap[name]) {
        globalLanguagesMap[name] = { count: 0, color };
      }
      globalLanguagesMap[name].count += count;
      computedTotalGlobalRepos += count;
    });
  });

  // Sort technologies by project count (popularity)
  const sortedGlobalLanguages = Object.entries(globalLanguagesMap).map(([name, val]) => ({
    name,
    color: val.color,
    count: val.count
  })).sort((a, b) => b.count - a.count);

  const totalGlobalRepos = computedTotalGlobalRepos;
  const totalTechnologiesCount = sortedGlobalLanguages.filter(l => l.name !== 'Otros').length;

  // Load logged-in dev's yearly stats (365 days)
  let currentDevStats: any[] = [];
  if (currentDev && supabase) {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
      
      let { data: statsData } = await supabase
        .from('github_stats')
        .select('fecha, stats')
        .eq('dev_id', currentDev.id)
        .gte('fecha', oneYearAgoStr)
        .order('fecha', { ascending: true });

      // Automatically run first-time sync in the background if no stats are loaded yet
      if (!statsData || statsData.length === 0) {
        await syncDevStats(currentDev);
        
        // Refetch stats
        const { data: refetched } = await supabase
          .from('github_stats')
          .select('fecha, stats')
          .eq('dev_id', currentDev.id)
          .gte('fecha', oneYearAgoStr)
          .order('fecha', { ascending: true });
        
        statsData = refetched;

        // Refresh dev info (since total_score changes)
        const { data: updatedDev } = await supabase.from('devs').select('*').eq('id', currentDev.id).single();
        if (updatedDev) {
          currentDev = updatedDev;
        }

        // Also reload the leaderboard devs list so the user sees their updated rank immediately!
        try {
          const orderColumn = sort === 'score' ? 'total_score' : 'total_contributions';
          const { data: devsData } = await supabase.from('devs').select('*').order(orderColumn, { ascending: false });
          const { data: devBadgesData } = await supabase.from('dev_badges').select('dev_id, badges(id, nombre, icon_url)');
          
          const badgesByDev: Record<string, any[]> = {};
          devBadgesData?.forEach((row: any) => {
            const dId = row.dev_id;
            const b = row.badges;
            if (dId && b) {
              if (!badgesByDev[dId]) {
                badgesByDev[dId] = [];
              }
              if (!badgesByDev[dId].find(x => x.id === b.id)) {
                badgesByDev[dId].push({
                  id: b.id,
                  nombre: b.nombre,
                  icon_url: b.icon_url,
                });
              }
            }
          });

          leaderboardDevs = (devsData || []).map((dev: any) => ({
            id: dev.id,
            nombre: dev.nombre,
            github_username: dev.github_username,
            avatar_url: dev.avatar_url,
            total_score: dev.total_score,
            total_contributions: dev.total_contributions || 0,
            public_repos: dev.public_repos || dev.metadata?.public_repos || 0,
            current_streak: dev.current_streak || dev.metadata?.current_streak || 0,
            badges: badgesByDev[dev.id] || [],
            generacion: dev.metadata?.generacion || undefined,
            numero_control: dev.metadata?.numero_control || undefined,
            carrera: dev.metadata?.carrera || 'ISC',
          }));

          if (genParam) {
            leaderboardDevs = leaderboardDevs.filter((d: any) => d.generacion === genParam);
          }
        } catch(err){}
      }

      if (statsData) {
        currentDevStats = statsData.map((row) => ({
          fecha: row.fecha,
          commits: row.stats?.commits || 0,
          pull_requests: row.stats?.pull_requests || 0,
          issues: row.stats?.issues || 0,
          stars_received: row.stats?.stars_received || 0,
        }));
      }
    } catch (e) {
      console.error("Failed to load dev stats:", e);
    }
  }

  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Repo Rivals - Platform Hono JSX</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          dialog::backdrop {
            background: rgba(2, 6, 23, 0.85);
            backdrop-filter: blur(4px);
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <h1 className="text-lg font-black tracking-wider text-white">REPO RIVALS</h1>
              <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
                Ingeniería en Sistemas (Hono + Bun)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/periodos" className="text-xs bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-900/40 text-emerald-400 px-3 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5 shadow-sm">
              <span>📅</span> Periodos Escolares
            </a>
            <a href="/duelo-vs" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              ⚔️ Duelo VS
            </a>
            <a href="/sobre-nosotros" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              Sobre Nosotros
            </a>
            {currentDev ? (
              <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/80 pl-2 pr-3 py-1.5 rounded-xl">
                {currentDev.avatar_url ? (
                  <img src={currentDev.avatar_url} className="w-8 h-8 rounded-full border border-slate-700" alt={currentDev.nombre} />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                    {currentDev.nombre.charAt(0)}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-tight">{currentDev.nombre}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">@{currentDev.github_username}</p>
                </div>
                <a href="/mi-perfil" className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1.5" title="Editar mis datos de estudiante">
                  <span>⚙️</span> Mi Perfil
                </a>
                <a href="/auth/sync-profile" className="text-xs bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-900/30 hover:border-emerald-800/35 text-emerald-400 px-2 py-1 rounded-lg transition-colors font-medium flex items-center gap-1" title="Sincronizar aportaciones de GitHub">
                  <span>🔄</span> Sincronizar
                </a>
                <a href="/auth/logout" className="text-xs bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 hover:border-red-800/50 text-red-400 px-2.5 py-1 rounded-lg transition-colors font-medium">
                  Salir
                </a>
              </div>
            ) : (
              <a href="/auth/login" className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg font-bold transition-all shadow-md shadow-emerald-500/10 font-medium">
                Iniciar con GitHub
              </a>
            )}
            <span className="text-xs bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-full font-mono hidden md:inline-block">
              Hono JSX Engine
            </span>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
          {/* Banner */}
          <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/20 border border-slate-900 p-8 rounded-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-8">
            <div className="max-w-xl text-left">
              <h2 className="text-2xl md:text-3xl font-black text-white">
                Plataforma Gamificada de Aprendizaje
              </h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Compara tu actividad en GitHub con la de tus compañeros devs. Consigue insignias, supera desafíos en tiempo real y asciende en la tabla de posiciones.
              </p>
            </div>
            
            {/* Stats section on the right (Centered) */}
            <div className="space-y-3 w-full md:w-auto flex flex-col items-center">
              <div className="flex items-center justify-center gap-1.5 border-b border-slate-850 pb-1.5 w-full text-center">
                <span className="text-xs">📊</span>
                <span className="text-[10px] uppercase font-extrabold tracking-widest text-slate-400">Estadísticas Globales</span>
              </div>
              <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap justify-center">
                <div className="bg-slate-950 border border-slate-850 px-4 py-3 rounded-xl text-center min-w-[90px] md:min-w-[100px] flex flex-col justify-center">
                  <span className="block text-2xl font-bold text-white">{totalDevsCount}</span>
                  <span className="text-[10px] uppercase text-slate-500 font-semibold">Devs</span>
                </div>
                <div className="bg-slate-950 border border-slate-850 px-4 py-3 rounded-xl text-center min-w-[110px] md:min-w-[120px] flex flex-col justify-center">
                  <span className="block text-2xl font-bold text-emerald-400">
                    {totalGlobalContributions >= 1000 
                      ? `${(totalGlobalContributions / 1000).toFixed(1)}k` 
                      : totalGlobalContributions}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500 font-semibold">Contribuciones</span>
                </div>
                <div className="bg-slate-950 border border-slate-850 px-4 py-3 rounded-xl text-center min-w-[100px] md:min-w-[110px] flex flex-col justify-center">
                  <span className="block text-2xl font-bold text-cyan-400">
                    {totalGlobalRepos >= 1000 
                      ? `${(totalGlobalRepos / 1000).toFixed(1)}k` 
                      : totalGlobalRepos}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500 font-semibold">Proyectos</span>
                </div>
                <div className="bg-slate-950 border border-slate-850 px-4 py-3 rounded-xl text-center min-w-[100px] md:min-w-[110px] flex flex-col justify-center">
                  <span className="block text-2xl font-bold text-amber-400">
                    {totalTechnologiesCount}
                  </span>
                  <span className="text-[10px] uppercase text-slate-500 font-semibold">Tecnologías</span>
                </div>
              </div>
            </div>
          </section>

          {/* Ecosistema de Tecnologías Global */}
          {sortedGlobalLanguages.length > 0 ? (
            <section className="bg-slate-900/20 border border-slate-900/80 p-6 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                    <span>🛠️</span> Ecosistema Tecnológico de la Competencia
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Distribución total de tecnologías y proyectos creados por los devs</p>
                </div>
                <span className="text-[10px] font-mono bg-slate-950 px-2.5 py-1 rounded-md border border-slate-850 text-slate-400 self-start sm:self-auto">
                  {totalGlobalRepos} Proyectos Totales Soportados
                </span>
              </div>

              {/* Segmented Progress Bar */}
              <div className="w-full h-3 rounded-full overflow-hidden bg-slate-950 border border-slate-850/60 flex">
                {sortedGlobalLanguages.map((lang: any) => {
                  const pct = totalGlobalRepos > 0 ? (lang.count / totalGlobalRepos) * 100 : 0;
                  return (
                    <div 
                      key={lang.name}
                      style={{ width: `${pct}%`, backgroundColor: lang.color }}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      title={`${lang.name}: ${lang.count} proyectos (${Math.round(pct)}%)`}
                    />
                  );
                })}
              </div>

              {/* Tags grid */}
              <div className="flex flex-wrap gap-2">
                {sortedGlobalLanguages.map((lang: any) => {
                  const pct = totalGlobalRepos > 0 ? Math.round((lang.count / totalGlobalRepos) * 100) : 0;
                  return (
                    <span 
                      key={lang.name}
                      style={{ borderColor: `${lang.color}20` }}
                      className="inline-flex items-center gap-2 bg-slate-900/40 border px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300"
                    >
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: lang.color }} />
                      <span className="text-white">{lang.name}</span>
                      <span className="bg-slate-950 text-[10px] font-mono font-bold text-slate-400 px-2 py-0.5 rounded-md border border-slate-800">
                        {lang.count} {lang.count === 1 ? 'proyecto' : 'proyectos'} ({pct}%)
                      </span>
                    </span>
                  );
                })}
              </div>
            </section>
          ) : null}

          {/* Admin Panel Form if Admin */}
          {currentDev?.is_admin && (
            <section className="bg-slate-900/35 border border-slate-850 p-6 rounded-2xl space-y-4">
              <h3 className="text-md font-bold text-white tracking-wide flex items-center gap-2">
                <span>⚙️</span> Panel de Administración - Pre-registrar Estudiante
              </h3>
              <form method="POST" action="/admin/add-dev" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
                <div className="w-full">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Usuario de GitHub *</label>
                  <input type="text" name="github_username" required placeholder="Ej. carlosmdev" className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 font-mono" />
                </div>
                <div className="w-full">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Nombre Completo</label>
                  <input type="text" name="nombre" placeholder="Ej. Carlos Mendoza" className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div className="w-full">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Carrera *</label>
                  <select name="carrera" className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50 font-semibold cursor-pointer">
                    <option value="ISC">ISC (Sistemas)</option>
                    <option value="IIAR">IIAR (Inteligencia Artificial)</option>
                  </select>
                </div>
                <div className="w-full">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Generación (Año)</label>
                  <input type="text" name="generacion" placeholder="Ej. 2023" className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 font-mono" />
                </div>
                <div className="w-full">
                  <button type="submit" className="w-full text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-4 rounded-xl transition-all shadow-md shadow-emerald-500/10">
                    Pre-registrar Alumno
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Real Live Leaderboard */}
          <section className="space-y-4">
            <Leaderboard
              devs={leaderboardDevs}
              currentDevId={currentDev?.id}
              isAdmin={currentDev?.is_admin || false}
              activeSort={sort}
              activeGen={genParam}
              availableGens={availableGens}
            />
          </section>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-650">
          <p>© 2026 Repo Rivals. Hecho con ❤️ para Ingeniería en Sistemas con Hono & Bun.</p>
        </footer>
      </body>
    </html>
  );
});

// GET Route: Renders the Academic Periods / Semester Dashboard (Docente)
app.get('/periodos', async (c) => {
  // Auth state
  let currentDev: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: dev } = await supabase.from('devs').select('*').eq('auth_id', user.id).single();
        if (dev) {
          currentDev = dev;
        }
      }
    } catch (e) {
      console.error('Failed to get user from token in /periodos:', e);
    }
  }

  // Academic Period and Sort parameters
  const periodParam = c.req.query('period');
  const activePeriod = getPeriodById(periodParam);
  const availablePeriods = getAvailablePeriods();
  const sort = c.req.query('sort') || 'contributions';
  const genParam = c.req.query('gen') || '';

  // Load and aggregate devs for the selected period
  let periodDevs: PeriodDevStats[] = [];
  let availableGens: string[] = [];
  let totalSemesterCommits = 0;
  let totalSemesterPRs = 0;
  let totalSemesterIssues = 0;
  let totalSemesterContributions = 0;
  let activeDevsCount = 0;

  if (supabase) {
    try {
      // 1. Fetch all registered devs
      const { data: devsData } = await supabase
        .from('devs')
        .select('id, nombre, github_username, avatar_url, metadata');

      // Extract unique generations from student metadata
      availableGens = Array.from(
        new Set(
          (devsData || [])
            .map((d: any) => d.metadata?.generacion)
            .filter((g: any) => typeof g === 'string' && g.trim() !== '')
        )
      ).sort().reverse();

      // 2. Fetch stats for the specific period range [startDate, endDate]
      const { data: statsData } = await supabase
        .from('github_stats')
        .select('dev_id, fecha, stats')
        .gte('fecha', activePeriod.startDate)
        .lte('fecha', activePeriod.endDate);

      // 3. Aggregate daily records per dev
      const statsByDev: Record<string, { commits: number; pull_requests: number; issues: number; stars_received: number; active_days: number }> = {};

      (statsData || []).forEach((row: any) => {
        const dId = row.dev_id;
        if (!statsByDev[dId]) {
          statsByDev[dId] = { commits: 0, pull_requests: 0, issues: 0, stars_received: 0, active_days: 0 };
        }
        const commits = row.stats?.commits || 0;
        const prs = row.stats?.pull_requests || 0;
        const issues = row.stats?.issues || 0;
        const stars = row.stats?.stars_received || 0;

        statsByDev[dId].commits += commits;
        statsByDev[dId].pull_requests += prs;
        statsByDev[dId].issues += issues;
        statsByDev[dId].stars_received += stars;

        if (commits > 0 || prs > 0 || issues > 0) {
          statsByDev[dId].active_days += 1;
        }
      });

      // 4. Map into period leaderboard data
      periodDevs = (devsData || []).map((dev: any) => {
        const agg = statsByDev[dev.id] || { commits: 0, pull_requests: 0, issues: 0, stars_received: 0, active_days: 0 };
        const contributions = agg.commits + agg.pull_requests + agg.issues;
        const score = agg.commits * POINTS_PER_COMMIT + agg.pull_requests * POINTS_PER_PR + agg.issues * POINTS_PER_ISSUE;
        const hasActivity = contributions > 0;

        return {
          id: dev.id,
          nombre: dev.nombre,
          github_username: dev.github_username,
          avatar_url: dev.avatar_url,
          commits: agg.commits,
          pull_requests: agg.pull_requests,
          issues: agg.issues,
          stars_received: agg.stars_received,
          total_contributions: contributions,
          period_score: score,
          active_days: agg.active_days,
          has_activity: hasActivity,
          generacion: dev.metadata?.generacion || undefined,
          numero_control: dev.metadata?.numero_control || undefined,
          carrera: dev.metadata?.carrera || 'ISC',
        };
      });

      // 5. Filter by generation if requested
      if (genParam) {
        periodDevs = periodDevs.filter((d) => d.generacion === genParam);
      }

      // 6. Aggregate metrics for active devs in current filter
      periodDevs.forEach((std) => {
        if (std.has_activity) {
          activeDevsCount++;
          totalSemesterCommits += std.commits;
          totalSemesterPRs += std.pull_requests;
          totalSemesterIssues += std.issues;
          totalSemesterContributions += std.total_contributions;
        }
      });

      // 7. Sort developers based on active parameter
      periodDevs.sort((a, b) => {
        // Students with activity come first
        if (a.has_activity && !b.has_activity) return -1;
        if (!a.has_activity && b.has_activity) return 1;

        if (sort === 'score') {
          return b.period_score - a.period_score || b.total_contributions - a.total_contributions;
        } else if (sort === 'commits') {
          return b.commits - a.commits || b.period_score - a.period_score;
        }
        return b.total_contributions - a.total_contributions || b.period_score - a.period_score;
      });
    } catch (e) {
      console.error('Failed to load period stats in /periodos:', e);
    }
  }

  const participationRate = periodDevs.length > 0
    ? Math.round((activeDevsCount / periodDevs.length) * 100)
    : 0;

  const avgContributionsPerActive = activeDevsCount > 0
    ? Math.round(totalSemesterContributions / activeDevsCount)
    : 0;

  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Periodos Escolares ({activePeriod.shortName}) - Repo Rivals Docente</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          dialog::backdrop {
            background: rgba(2, 6, 23, 0.85);
            backdrop-filter: blur(4px);
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Global Navigation Header */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <a href="/" className="hover:text-emerald-400 transition-colors">
                <h1 className="text-lg font-black tracking-wider text-white">REPO RIVALS</h1>
              </a>
              <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
                Ingeniería en Sistemas • Control Docente
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              🏆 Ranking Global
            </a>
            <a href="/periodos" className="text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5">
              <span>📅</span> Periodos Escolares
            </a>
            <a href="/duelo-vs" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              ⚔️ Duelo VS
            </a>
            <a href="/sobre-nosotros" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              Sobre Nosotros
            </a>
            {currentDev ? (
              <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/80 pl-2 pr-3 py-1.5 rounded-xl">
                {currentDev.avatar_url ? (
                  <img src={currentDev.avatar_url} className="w-8 h-8 rounded-full border border-slate-700" alt={currentDev.nombre} />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                    {currentDev.nombre.charAt(0)}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-tight">{currentDev.nombre}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">@{currentDev.github_username}</p>
                </div>
                <a href="/mi-perfil" className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1.5" title="Editar mis datos de estudiante">
                  <span>⚙️</span> Mi Perfil
                </a>
                <a href="/auth/logout" className="text-xs bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 hover:border-red-800/50 text-red-400 px-2.5 py-1 rounded-lg transition-colors font-medium">
                  Salir
                </a>
              </div>
            ) : (
              <a href="/auth/login" className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg font-bold transition-all shadow-md shadow-emerald-500/10 font-medium">
                Iniciar con GitHub
              </a>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
          {/* Teacher Header Banner */}
          <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/25 border border-slate-850 p-7 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-0.5 rounded-md">
                  Panel de Evaluación Semestral
                </span>
                {activePeriod.isCurrent && (
                  <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-900/40 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    Periodo Activo
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                {activePeriod.name}
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Rango evaluado: <span className="text-slate-200 font-mono font-medium">{activePeriod.startDate}</span> al{' '}
                <span className="text-slate-200 font-mono font-medium">{activePeriod.endDate}</span>.
                Las aportaciones mostradas corresponden estrictamente a este ciclo académico (Agosto - Enero o Febrero - Julio).
              </p>
            </div>

            {/* Quick Period Selector Dropdown */}
            <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl space-y-2 w-full md:w-auto min-w-[280px]">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Seleccionar Semestre Escolar
              </label>
              <select
                id="periodSelectorSelect"
                className="w-full text-xs font-semibold bg-slate-900 border border-slate-750 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:border-emerald-500"
                onchange="const params = new URLSearchParams(window.location.search); params.set('period', this.value); window.location.search = params.toString();"
              >
                {availablePeriods.map((p) => (
                  <option value={p.id} selected={p.id === activePeriod.id}>
                    {p.name} {p.isCurrent ? '(Actual)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 italic">
                Cambia entre semestres para auditar calificaciones pasadas.
              </p>
            </div>
          </section>

          {/* Quick Filter Pills (Agosto - Enero / Febrero - Julio) */}
          <section className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold mr-1">Periodos Recientes:</span>
            {availablePeriods.map((p) => {
              const isSelected = p.id === activePeriod.id;
              return (
                <a
                  href={`/periodos?period=${p.id}&sort=${sort}${genParam ? `&gen=${genParam}` : ''}`}
                  className={`text-xs px-3.5 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900/60 hover:bg-slate-850 border-slate-800 text-slate-300 hover:text-white'
                  }`}
                >
                  <span>{p.type === 'ago-ene' ? '🍂' : '🌸'}</span>
                  <span>{p.shortName}</span>
                  {p.isCurrent && (
                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono uppercase ${
                      isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-950 text-emerald-400'
                    }`}>
                      Actual
                    </span>
                  )}
                </a>
              );
            })}
          </section>

          {/* Semester Stats Summary Cards */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl">
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Alumnos con Actividad
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-white">{activeDevsCount}</span>
                <span className="text-xs text-slate-500">de {periodDevs.length} registrados</span>
              </div>
              <span className="text-[11px] text-emerald-400 font-mono mt-1 block">
                {participationRate}% de participación del grupo
              </span>
            </div>

            <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl">
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Aportaciones del Periodo
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-emerald-400">
                  {totalSemesterContributions.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">totales</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                Commits + PRs + Issues
              </span>
            </div>

            <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl">
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Commits en el Ciclo
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-cyan-400">
                  {totalSemesterCommits.toLocaleString()}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                {totalSemesterPRs} Pull Requests • {totalSemesterIssues} Issues
              </span>
            </div>

            <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl">
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Promedio por Alumno Activo
              </span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-black text-amber-400">
                  {avgContributionsPerActive}
                </span>
                <span className="text-xs text-slate-500">contrib/alumno</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono mt-1 block">
                Métrica de regularidad docente
              </span>
            </div>
          </section>

          {/* Period Leaderboard Table */}
          <section className="space-y-4">
            <PeriodLeaderboard
              devs={periodDevs}
              period={activePeriod}
              currentDevId={currentDev?.id}
              isAdmin={currentDev?.is_admin || false}
              activeSort={sort}
              activeGen={genParam}
              availableGens={availableGens}
            />
          </section>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-650">
          <p>© 2026 Repo Rivals. Hecho con ❤️ para Ingeniería en Sistemas con Hono & Bun.</p>
        </footer>
      </body>
    </html>
  );
});

// GET Route: Renders the About/Demo Section
app.get('/sobre-nosotros', async (c) => {
  // Auth state
  let currentDev: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: dev } = await supabase.from('devs').select('*').eq('auth_id', user.id).single();
        if (dev) {
          currentDev = dev;
        }
      }
    } catch (e) {}
  }

  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sobre Repo Rivals - Plataforma Gamificada para Sistemas</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          dialog::backdrop {
            background: rgba(2, 6, 23, 0.85);
            backdrop-filter: blur(4px);
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Navigation Header */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <a href="/" className="hover:text-emerald-400 transition-colors">
                <h1 className="text-lg font-black tracking-wider text-white">REPO RIVALS</h1>
              </a>
              <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
                Ingeniería en Sistemas Computacionales
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              🏆 Ranking Global
            </a>
            <a href="/periodos" className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1">
              <span>📅</span> Periodos Escolares
            </a>
            <a href="/duelo-vs" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              ⚔️ Duelo VS
            </a>
            <a href="/sobre-nosotros" className="text-xs bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-lg font-bold">
              Sobre Nosotros
            </a>
            {currentDev ? (
              <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/80 pl-2 pr-3 py-1.5 rounded-xl">
                {currentDev.avatar_url ? (
                  <img src={currentDev.avatar_url} className="w-8 h-8 rounded-full border border-slate-700" alt={currentDev.nombre} />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                    {currentDev.nombre.charAt(0)}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-tight">{currentDev.nombre}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">@{currentDev.github_username}</p>
                </div>
                <a href="/mi-perfil" className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1.5" title="Editar mis datos de estudiante">
                  <span>⚙️</span> Mi Perfil
                </a>
                <a href="/auth/logout" className="text-xs bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 hover:border-red-800/50 text-red-400 px-2.5 py-1 rounded-lg transition-colors font-medium">
                  Salir
                </a>
              </div>
            ) : (
              <a href="/auth/login" className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg font-bold transition-all shadow-md shadow-emerald-500/10 font-medium">
                Iniciar con GitHub
              </a>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-12">
          {/* Hero Section */}
          <section className="text-center space-y-4 py-12 px-6 bg-gradient-to-b from-slate-900/50 via-slate-900/20 to-transparent border border-slate-850 rounded-3xl relative overflow-hidden">
            <div className="inline-flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 px-3.5 py-1.5 rounded-full text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
              <span>🚀</span> Educación Técnica Gamificada
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-3xl mx-auto leading-tight">
              Aprender Programación Escribiendo Código Real
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
              <strong className="text-slate-200">Repo Rivals</strong> es la plataforma académica diseñada para estudiantes y docentes de <strong className="text-emerald-400">Ingeniería en Sistemas Computacionales</strong>. Transformamos la práctica del desarrollo de software conectando las asignaturas universitarias con la evidencia técnica real en <strong className="text-slate-200">GitHub</strong>.
            </p>
          </section>

          {/* 3 Pedagogical Pillars */}
          <section className="space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h3 className="text-2xl font-extrabold text-white">¿Por Qué Repo Rivals?</h3>
              <p className="text-xs text-slate-400">Tres principios fundamentales que guían el aprendizaje y la evaluación técnica.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl space-y-3 hover:border-slate-750 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-center text-2xl">
                  💻
                </div>
                <h4 className="text-lg font-bold text-white">Constancia Diaria</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  El software no se aprende estudiando horas antes del examen; se domina construyendo a diario. Repo Rivals incentiva el hábito del commit continuo y el versionado incremental frente a la procrastinación.
                </p>
              </div>

              <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl space-y-3 hover:border-slate-750 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-cyan-950/50 border border-cyan-800/40 flex items-center justify-center text-2xl">
                  🤝
                </div>
                <h4 className="text-lg font-bold text-white">Cultura de Industria</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Los equipos tech profesionales trabajan con Pull Requests, Issues, revisión de pares y ramas. Fomentamos que los estudiantes adquieran estas habilidades desde el aula para graduarse con un portafolio sólido.
                </p>
              </div>

              <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-2xl space-y-3 hover:border-slate-750 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-amber-950/50 border border-amber-800/40 flex items-center justify-center text-2xl">
                  ⚖️
                </div>
                <h4 className="text-lg font-bold text-white">Evaluación Objetiva</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Los docentes cuentan con métricas auditables y transparentes basadas en aportaciones comprobables, permitiendo un seguimiento justo y personalizado de cada estudiante y cada cohorte semestral.
                </p>
              </div>
            </div>
          </section>

          {/* Scoring Engine Rules */}
          <section className="bg-slate-900/30 border border-slate-850 p-8 rounded-3xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-5">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>💎</span> El Sistema de Puntuación
                </h3>
                <p className="text-xs text-slate-400 mt-1">Cómo se calculan los puntos y cómo ascienden los alumnos en el ranking.</p>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-3 py-1 rounded-lg self-start sm:self-auto">
                Puntaje Automatizado
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">💻</span>
                  <span className="text-lg font-black font-mono text-emerald-400">+10 pts</span>
                </div>
                <h4 className="text-sm font-bold text-white">Por Cada Commit</h4>
                <p className="text-xs text-slate-400">Premia el avance constante, la solución de ejercicios y el desarrollo de proyectos paso a paso.</p>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🔀</span>
                  <span className="text-lg font-black font-mono text-cyan-400">+20 pts</span>
                </div>
                <h4 className="text-sm font-bold text-white">Pull Request (PR)</h4>
                <p className="text-xs text-slate-400">Fomenta la colaboración en equipo, propuestas de cambio y trabajo en proyectos multi-autor.</p>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">📌</span>
                  <span className="text-lg font-black font-mono text-amber-400">+5 pts</span>
                </div>
                <h4 className="text-sm font-bold text-white">Issue Creado</h4>
                <p className="text-xs text-slate-400">Incentiva la planeación de software, documentación de tareas pendientes y reporte de bugs.</p>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl">⭐</span>
                  <span className="text-lg font-black font-mono text-yellow-400">+15 pts</span>
                </div>
                <h4 className="text-sm font-bold text-white">Star Recibida</h4>
                <p className="text-xs text-slate-400">Reconoce el impacto y calidad de los proyectos compartidos públicamente con la comunidad.</p>
              </div>
            </div>
          </section>

          {/* Academic Semester System */}
          <section className="bg-gradient-to-r from-slate-900/60 via-slate-900/30 to-emerald-950/20 border border-slate-850 p-8 rounded-3xl space-y-6">
            <div className="max-w-2xl space-y-2">
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/50 border border-emerald-900/40 px-2.5 py-0.5 rounded-md">
                Modelo Docente Exclusivo
              </span>
              <h3 className="text-2xl font-black text-white">Evaluación por Periodos Semestrales</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                En el ámbito universitario, cada semestre representa un nuevo grupo y un curso distinto. Repo Rivals separa las métricas en dos grandes vistas:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-950 border border-slate-850 p-6 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🍂</span>
                  <h4 className="text-base font-bold text-white">Semestre Agosto – Enero</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Inicia el <strong className="text-slate-300">1 de agosto</strong> y finaliza el <strong className="text-slate-300">31 de enero</strong> del año siguiente. Abarca el ciclo escolar de otoño/invierno de las materias del plan de estudios.
                </p>
                <div className="pt-2 text-[11px] font-mono text-emerald-400">
                  Rango: YYYY-08-01 → (YYYY+1)-01-31
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-6 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🌸</span>
                  <h4 className="text-base font-bold text-white">Semestre Febrero – Julio</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Inicia el <strong className="text-slate-300">1 de febrero</strong> y finaliza el <strong className="text-slate-300">31 de julio</strong> del mismo año. Abarca el ciclo escolar de primavera/verano.
                </p>
                <div className="pt-2 text-[11px] font-mono text-emerald-400">
                  Rango: YYYY-02-01 → YYYY-07-31
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-300">
                💡 <strong className="text-white">Para Docentes:</strong> En la sección <a href="/periodos" className="text-emerald-400 underline font-semibold">Periodos Escolares</a> puedes seleccionar cualquier ciclo anterior o vigente y usar el botón <strong>"📋 Copiar Concentrado"</strong> para transferir las notas directamente a tu Excel de calificaciones.
              </div>
              <a href="/periodos" className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl transition-all whitespace-nowrap shadow-md">
                Ir a Periodos Escolares
              </a>
            </div>
          </section>

          {/* FAQ Section */}
          <section className="space-y-6">
            <div className="text-center max-w-xl mx-auto space-y-2">
              <h3 className="text-2xl font-extrabold text-white">Preguntas Frecuentes</h3>
              <p className="text-xs text-slate-400">Respuestas rápidas para estudiantes y profesores sobre el funcionamiento de la plataforma.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="text-emerald-400">❓</span> ¿Cómo se sincronizan mis aportaciones?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Repo Rivals se conecta directamente a la API GraphQL oficial de GitHub. Consulta tu calendario de contribuciones oficial y actualiza automáticamente los commits, PRs e issues en la base de datos de Supabase.
                </p>
              </div>

              <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="text-emerald-400">❓</span> ¿Se cuentan los repositorios privados?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ¡Sí! GitHub permite incluir contribuciones privadas en tu historial público. Para activarlo en tu perfil de GitHub ve a: <strong className="text-slate-300">Settings → Public profile → Contribution settings → Include private contributions</strong>.
                </p>
              </div>

              <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="text-emerald-400">❓</span> ¿Qué son las rachas activas (🔥)?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Es el conteo de días consecutivos en los que has realizado al menos una aportación válida en GitHub. Mantener la racha activa ayuda a desbloquear insignias especiales de constancia.
                </p>
              </div>

              <div className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="text-emerald-400">❓</span> ¿Cómo se califica a los alumnos?
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  El docente puede establecer metas mínimas de commits o puntos durante el semestre escolar correspondiente, revisando tanto la posición en la tabla como la distribución del mapa de calor a lo largo de las semanas de clase.
                </p>
              </div>
            </div>
          </section>

          {/* Tech Stack Badges */}
          <section className="text-center space-y-4 pt-6 border-t border-slate-900">
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">Pila Tecnológica de Alto Rendimiento</h4>
            <div className="flex flex-wrap justify-center gap-3">
              <span className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3.5 py-1.5 rounded-xl font-medium">
                ⚡ <strong>Bun</strong> Runtime
              </span>
              <span className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3.5 py-1.5 rounded-xl font-medium">
                🔥 <strong>Hono</strong> JSX SSR Engine
              </span>
              <span className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3.5 py-1.5 rounded-xl font-medium">
                🐘 <strong>Supabase</strong> PostgreSQL + RLS
              </span>
              <span className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3.5 py-1.5 rounded-xl font-medium">
                🎨 <strong>Tailwind CSS</strong>
              </span>
              <span className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 text-xs px-3.5 py-1.5 rounded-xl font-medium">
                🐙 <strong>GitHub</strong> GraphQL API v4
              </span>
            </div>
          </section>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-8 mt-12 text-center text-xs text-slate-650 space-y-2">
          <p className="font-semibold text-slate-500">Repo Rivals • Plataforma Gamificada de Aprendizaje y Evaluación Docente</p>
          <p>© 2026 Hecho con ❤️ para la comunidad de Ingeniería en Sistemas Computacionales.</p>
        </footer>
      </body>
    </html>
  );
});

// GET Route: Renders the dynamic Dev profile page
app.get('/dev/:username', async (c) => {
  const username = c.req.param('username');
  let currentDev: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: dev } = await supabase.from('devs').select('*').eq('auth_id', user.id).single();
        if (dev) currentDev = dev;
      }
    } catch (e) {}
  }

  if (!supabase) {
    return c.text('Supabase is not configured', 500);
  }

  // Fetch the developer details from the database
  const { data: targetDev, error: devError } = await supabase
    .from('devs')
    .select('*')
    .eq('github_username', username)
    .single();

  if (devError || !targetDev) {
    return c.text(`Desarrollador @${username} no encontrado.`, 404);
  }

  // Fetch all dev's badges
  const { data: earnedBadges } = await supabase
    .from('dev_badges')
    .select('id, dev_id, badge_id, otorgado_en')
    .eq('dev_id', targetDev.id);

  // Fetch all global badges
  const { data: allBadges } = await supabase
    .from('badges')
    .select('*');

  // Period filter support for teachers
  const selectedPeriodId = c.req.query('period');
  const availablePeriods = getAvailablePeriods();
  const selectedPeriod = selectedPeriodId ? getPeriodById(selectedPeriodId) : null;

  // Fetch stats for the heatmap (selected period or last 365 days)
  let statsQuery = supabase
    .from('github_stats')
    .select('fecha, stats')
    .eq('dev_id', targetDev.id)
    .order('fecha', { ascending: true });

  if (selectedPeriod) {
    statsQuery = statsQuery
      .gte('fecha', selectedPeriod.startDate)
      .lte('fecha', selectedPeriod.endDate);
  } else {
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
    statsQuery = statsQuery.gte('fecha', oneYearAgoStr);
  }

  const { data: statsData } = await statsQuery;

  const currentDevStats = (statsData || []).map((row) => ({
    fecha: row.fecha,
    commits: row.stats?.commits || 0,
    pull_requests: row.stats?.pull_requests || 0,
    issues: row.stats?.issues || 0,
    stars_received: row.stats?.stars_received || 0,
  }));

  let periodContributions = 0;
  let periodCommits = 0;
  let periodScore = 0;
  if (selectedPeriod) {
    currentDevStats.forEach((day) => {
      periodCommits += day.commits;
      periodContributions += day.commits + day.pull_requests + day.issues;
      periodScore += day.commits * POINTS_PER_COMMIT + day.pull_requests * POINTS_PER_PR + day.issues * POINTS_PER_ISSUE;
    });
  }

  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Perfil de @{targetDev.github_username} - Repo Rivals</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          dialog::backdrop {
            background: rgba(2, 6, 23, 0.85);
            backdrop-filter: blur(4px);
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <a href="/" className="hover:text-emerald-400 transition-colors">
                <h1 className="text-lg font-black tracking-wider text-white">REPO RIVALS</h1>
              </a>
              <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
                Ingeniería en Sistemas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              🏆 Ranking Global
            </a>
            <a href="/periodos" className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1">
              📅 Periodos Escolares
            </a>
            <a href="/duelo-vs" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              ⚔️ Duelo VS
            </a>
            {currentDev ? (
              <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/80 pl-2 pr-3 py-1.5 rounded-xl">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-tight">{currentDev.nombre}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">@{currentDev.github_username}</p>
                </div>
                <a href="/mi-perfil" className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg transition-colors font-medium flex items-center gap-1.5" title="Editar mis datos de estudiante">
                  <span>⚙️</span> Mi Perfil
                </a>
                <a href="/auth/logout" className="text-xs bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 hover:border-red-800/50 text-red-400 px-2.5 py-1 rounded-lg transition-colors font-medium">
                  Salir
                </a>
              </div>
            ) : (
              <a href="/auth/login" className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-lg font-bold transition-all shadow-md shadow-emerald-500/10 font-medium">
                Iniciar con GitHub
              </a>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
          {/* Card Perfil */}
          <section className="bg-slate-900/40 border border-slate-850 p-8 rounded-2xl flex flex-col md:flex-row gap-8 items-center md:items-start">
            <img src={targetDev.avatar_url} className="w-24 h-24 rounded-full border border-slate-800 ring-4 ring-emerald-500/20" alt={targetDev.nombre} />
            <div className="space-y-4 flex-1 w-full text-center md:text-left">
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-white">{targetDev.nombre}</h2>
                <a
                  href={`https://github.com/${targetDev.github_username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-emerald-400 text-sm font-mono inline-flex items-center gap-1.5 hover:underline transition-colors group/gh"
                  title={`Abrir perfil de GitHub de @${targetDev.github_username}`}
                >
                  <span>@{targetDev.github_username}</span>
                  <svg className="w-3.5 h-3.5 opacity-60 group-hover/gh:opacity-100 transition-opacity inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              </div>
              
              <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                <span className="text-xs bg-emerald-500/15 text-emerald-400 px-3.5 py-1.5 rounded-xl border border-emerald-500/10 font-mono font-extrabold flex items-center gap-1">
                  🔥 {targetDev.total_contributions} Contribuciones
                </span>
                <span className="text-xs bg-cyan-500/15 text-cyan-400 px-3.5 py-1.5 rounded-xl border border-cyan-500/10 font-mono font-extrabold flex items-center gap-1">
                  💎 {targetDev.total_score} Puntos
                </span>
                <span className="text-xs bg-blue-500/15 text-blue-400 px-3.5 py-1.5 rounded-xl border border-blue-500/10 font-mono font-extrabold flex items-center gap-1">
                  📁 {targetDev.public_repos || targetDev.metadata?.public_repos || 0} Repos
                </span>
                {(targetDev.current_streak || targetDev.metadata?.current_streak) ? (
                  <span className="text-xs bg-amber-500/15 text-amber-400 px-3.5 py-1.5 rounded-xl border border-amber-500/10 font-mono font-extrabold flex items-center gap-1">
                    🔥 Racha: {targetDev.current_streak || targetDev.metadata?.current_streak} días
                  </span>
                ) : null}
              </div>

              {/* Languages Breakdown Visualizer */}
              {targetDev.metadata?.languages && targetDev.metadata.languages.length > 0 ? (
                <div className="space-y-2 pt-2 max-w-xl">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-left">Lenguajes Predominantes</h4>
                  
                  {/* Segmented bar */}
                  <div className="w-full h-3 rounded-full overflow-hidden bg-slate-950 border border-slate-850 flex">
                    {targetDev.metadata.languages.map((lang: any) => (
                      <div 
                        key={lang.name}
                        style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }}
                        className="h-full first:rounded-l-full last:rounded-r-full"
                        title={`${lang.name}: ${lang.percentage}%`}
                      />
                    ))}
                  </div>

                  {/* Legends */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center md:justify-start">
                    {targetDev.metadata.languages.map((lang: any) => (
                      <span key={lang.name} className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: lang.color }} />
                        <span>{lang.name}</span>
                        <span className="text-slate-500 font-mono text-[10px]">{lang.percentage}%</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* Heatmap Section with Period Filter */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-2xl border border-slate-850">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold pl-1">Filtrar Actividad:</span>
                <a
                  href={`/dev/${targetDev.github_username}`}
                  className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                    !selectedPeriod
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🌐 Últimos 365 Días
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {availablePeriods.slice(0, 4).map((p) => {
                  const isActive = selectedPeriod?.id === p.id;
                  return (
                    <a
                      href={`/dev/${targetDev.github_username}?period=${p.id}`}
                      className={`text-xs px-3 py-1.5 rounded-xl font-bold border transition-all flex items-center gap-1 ${
                        isActive
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                          : 'bg-slate-950/60 border-slate-850 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{p.type === 'ago-ene' ? '🍂' : '🌸'}</span>
                      <span>{p.shortName}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            {selectedPeriod ? (
              <PeriodHeatmap
                devName={targetDev.nombre}
                githubUsername={targetDev.github_username}
                period={selectedPeriod}
                stats={currentDevStats}
              />
            ) : (
              <DevHeatmap
                devName={targetDev.nombre}
                githubUsername={targetDev.github_username}
                stats={currentDevStats}
                daysToDisplay={365}
              />
            )}
          </section>

          {/* Badges Showcase */}
          <section>
            <BadgeShowcase
              allBadges={allBadges || []}
              devBadges={earnedBadges || []}
              devName={targetDev.nombre}
            />
          </section>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-650">
          <p>© 2026 Repo Rivals. Hecho con ❤️ para Ingeniería en Sistemas con Hono & Bun.</p>
        </footer>
      </body>
    </html>
  );
});

// GET Route: Renders the Duelo VS screen to compare 2 devs
app.get('/duelo-vs', async (c) => {
  let currentDev: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: dev } = await supabase.from('devs').select('*').eq('auth_id', user.id).single();
        if (dev) currentDev = dev;
      }
    } catch (e) {}
  }

  if (!supabase) {
    return c.text('Supabase is not configured', 500);
  }

  // Fetch all devs to populate select options
  const { data: allDevs } = await supabase
    .from('devs')
    .select('id, nombre, github_username')
    .order('nombre', { ascending: true });

  const devAId = c.req.query('devA');
  const devBId = c.req.query('devB');

  let devDataA: any = null;
  let devDataB: any = null;

  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

  if (devAId) {
    const { data: dev } = await supabase.from('devs').select('*').eq('id', devAId).single();
    const { data: stats } = await supabase.from('github_stats').select('fecha, stats').eq('dev_id', devAId).gte('fecha', oneYearAgoStr);
    if (dev) {
      devDataA = {
        dev,
        stats: (stats || []).map(row => ({
          fecha: row.fecha,
          commits: row.stats?.commits || 0,
          pull_requests: row.stats?.pull_requests || 0,
          issues: row.stats?.issues || 0,
          stars_received: row.stats?.stars_received || 0,
        }))
      };
    }
  }

  if (devBId) {
    const { data: dev } = await supabase.from('devs').select('*').eq('id', devBId).single();
    const { data: stats } = await supabase.from('github_stats').select('fecha, stats').eq('dev_id', devBId).gte('fecha', oneYearAgoStr);
    if (dev) {
      devDataB = {
        dev,
        stats: (stats || []).map(row => ({
          fecha: row.fecha,
          commits: row.stats?.commits || 0,
          pull_requests: row.stats?.pull_requests || 0,
          issues: row.stats?.issues || 0,
          stars_received: row.stats?.stars_received || 0,
        }))
      };
    }
  }

  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>⚔️ Duelo VS - Repo Rivals</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <a href="/" className="hover:text-emerald-400 transition-colors">
                <h1 className="text-lg font-black tracking-wider text-white">REPO RIVALS</h1>
              </a>
              <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
                Ingeniería en Sistemas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              🏆 Ranking Global
            </a>
            <a href="/periodos" className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1">
              📅 Periodos Escolares
            </a>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
          <section className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl text-center space-y-4">
            <h2 className="text-2xl font-black text-white">⚔️ Duelo Comparativo VS</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">Selecciona dos desarrolladores para comparar de frente su actividad, commits históricos e insignias obtenidas.</p>
            
            <form method="GET" action="/duelo-vs" className="flex flex-col sm:flex-row gap-4 justify-center items-end max-w-2xl mx-auto pt-2">
              <div className="flex-1 w-full text-left">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Dev A</label>
                <select name="devA" className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50">
                  <option value="">Selecciona Dev A...</option>
                  {(allDevs || []).map(d => (
                    <option value={d.id} selected={d.id === devAId}>{d.nombre} (@{d.github_username})</option>
                  ))}
                </select>
              </div>

              <div className="text-slate-500 font-bold self-center pb-2">VS</div>

              <div className="flex-1 w-full text-left">
                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Dev B</label>
                <select name="devB" className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50">
                  <option value="">Selecciona Dev B...</option>
                  {(allDevs || []).map(d => (
                    <option value={d.id} selected={d.id === devBId}>{d.nombre} (@{d.github_username})</option>
                  ))}
                </select>
              </div>

              <button type="submit" className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-450 hover:to-teal-450 text-slate-950 text-sm font-extrabold py-2 px-6 rounded-xl transition-all shadow-md">
                Comparar
              </button>
            </form>
          </section>

          {devDataA && devDataB ? (
            <HeatmapComparator devA={devDataA} devB={devDataB} daysToDisplay={120} />
          ) : (
            <div className="p-16 border border-dashed border-slate-850 rounded-2xl text-center text-slate-500">
              <p className="text-4xl">⚔️</p>
              <p className="text-sm font-medium mt-2">Selecciona a dos devs arriba para iniciar el versus.</p>
            </div>
          )}
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-650">
          <p>© 2026 Repo Rivals. Hecho con ❤️ para Ingeniería en Sistemas con Hono & Bun.</p>
        </footer>
      </body>
    </html>
  );
});

// Auth endpoints
app.get('/auth/login', async (c) => {
  if (!supabase) {
    return c.text('Supabase is not configured', 500);
  }
  let origin = process.env.APP_URL || '';
  if (!origin) {
    const proto = c.req.header('x-forwarded-proto') || 'http';
    const host = c.req.header('x-forwarded-host') || new URL(c.req.url).host;
    origin = `${proto}://${host}`;
  }
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${origin}/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data?.url) {
    return c.text('Error starting login flow: ' + (error?.message || 'No URL returned'), 500);
  }

  return c.redirect(data.url);
});

app.get('/auth/callback', async (c) => {
  if (!supabase) {
    return c.text('Supabase is not configured', 500);
  }

  const code = c.req.query('code');
  const error = c.req.query('error');
  const error_description = c.req.query('error_description');

  if (error) {
    return c.text(`Authentication error: ${error_description || error}`, 400);
  }

  if (!code) {
    return c.html(
      `<html>
        <head><title>Autenticando...</title></head>
        <body style="background:#020617;color:#f1f5f9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;">
            <p style="font-size:1.125rem;font-weight:600;">Autenticando con GitHub...</p>
            <p style="font-size:0.875rem;color:#94a3b8;">Por favor espera un momento.</p>
          </div>
          <script>
            const hash = window.location.hash;
            if (hash) {
              const params = new URLSearchParams(hash.substring(1));
              const accessToken = params.get('access_token');
              const refreshToken = params.get('refresh_token');
              if (accessToken && refreshToken) {
                const isSecure = !window.location.hostname.includes('localhost');
                const secureFlag = isSecure ? "; Secure" : "";
                document.cookie = "sb-access-token=" + accessToken + "; path=/; max-age=" + (60 * 60 * 24 * 7) + "; SameSite=Lax" + secureFlag;
                document.cookie = "sb-refresh-token=" + refreshToken + "; path=/; max-age=" + (60 * 60 * 24 * 7) + "; SameSite=Lax" + secureFlag;
                window.location.href = "/";
              } else {
                document.body.innerHTML = "<p style='color:#ef4444;'>Error: No se encontraron los tokens en la URL.</p>";
              }
            } else {
              document.body.innerHTML = "<p style='color:#ef4444;'>Error: No se proporcionó el código de autorización (code) ni el hash de acceso.</p>";
            }
          </script>
        </body>
      </html>`
    );
  }

  const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
  if (sessionError || !data.session) {
    return c.text('Failed to exchange code for session: ' + (sessionError?.message || 'No session'), 400);
  }

  const accessToken = data.session.access_token;
  const refreshToken = data.session.refresh_token;

  if (data.session.user) {
    const user = data.session.user;
    const ghUsername = user.user_metadata?.user_name || user.user_metadata?.preferred_username;
    if (ghUsername) {
      try {
        const { data: existingDev } = await supabase
          .from('devs')
          .select('id, auth_id')
          .ilike('github_username', ghUsername)
          .single();
        if (existingDev && !existingDev.auth_id) {
          await supabase.from('devs').update({ auth_id: user.id }).eq('id', existingDev.id);
        }
      } catch (err) {}
    }
  }

  // Set cookies (secure only in production / non-localhost environments)
  const isSecure = !c.req.url.includes('localhost');

  setCookie(c, 'sb-access-token', accessToken, {
    path: '/',
    secure: isSecure,
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'Lax',
  });
  
  setCookie(c, 'sb-refresh-token', refreshToken, {
    path: '/',
    secure: isSecure,
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'Lax',
  });

  return c.redirect('/');
});

app.get('/auth/logout', async (c) => {
  deleteCookie(c, 'sb-access-token', { path: '/' });
  deleteCookie(c, 'sb-refresh-token', { path: '/' });
  return c.redirect('/');
});

app.get('/auth/sync-profile', async (c) => {
  let currentDev: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: dev } = await supabase.from('devs').select('*').eq('auth_id', user.id).single();
        if (dev) {
          await syncDevStats(dev);
        }
      }
    } catch (e) {
      console.error("Manual sync failed:", e);
    }
  }
  return c.redirect('/');
});

// Helper to get authenticated dev from cookie
async function getAuthDev(c: any) {
  if (!supabase) return null;
  const accessToken = getCookie(c, 'sb-access-token');
  if (!accessToken) return null;
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (user && !userError) {
      const { data: dev } = await supabase.from('devs').select('*').eq('auth_id', user.id).single();
      return dev || null;
    }
  } catch (e) {}
  return null;
}

// Helper to check if requester is admin
async function getAdminUser(c: any) {
  const dev = await getAuthDev(c);
  if (dev && dev.is_admin) {
    return dev;
  }
  return null;
}

// GET /mi-perfil: Render Student Profile Settings
app.get('/mi-perfil', async (c) => {
  const currentDev = await getAuthDev(c);
  if (!currentDev) {
    return c.redirect('/auth/login');
  }

  // Fetch badges awarded to student
  let badges: any[] = [];
  if (supabase) {
    try {
      const { data: devBadgesData } = await supabase
        .from('dev_badges')
        .select('badge_id, badges(id, nombre, icon_url, descripcion)')
        .eq('dev_id', currentDev.id);

      badges = (devBadgesData || []).map((row: any) => row.badges).filter(Boolean);
    } catch (e) {
      console.error('Failed to load dev badges for profile:', e);
    }
  }

  const saved = c.req.query('saved') === '1';

  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Mi Perfil de Estudiante - Repo Rivals</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>{`
          dialog::backdrop {
            background: rgba(2, 6, 23, 0.85);
            backdrop-filter: blur(4px);
          }
        `}</style>
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Navigation Header */}
        <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <a href="/" className="hover:text-emerald-400 transition-colors">
                <h1 className="text-lg font-black tracking-wider text-white">REPO RIVALS</h1>
              </a>
              <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
                Ingeniería en Sistemas Computacionales
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              🏆 Ranking Global
            </a>
            <a href="/periodos" className="text-xs text-slate-400 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1">
              <span>📅</span> Periodos Escolares
            </a>
            <a href="/duelo-vs" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              ⚔️ Duelo VS
            </a>
            <a href="/sobre-nosotros" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              Sobre Nosotros
            </a>
            <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/80 pl-2 pr-3 py-1.5 rounded-xl">
              {currentDev.avatar_url ? (
                <img src={currentDev.avatar_url} className="w-8 h-8 rounded-full border border-slate-700" alt={currentDev.nombre} />
              ) : (
                <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                  {currentDev.nombre.charAt(0)}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{currentDev.nombre}</p>
                <p className="text-[10px] text-emerald-400 font-mono">@{currentDev.github_username}</p>
              </div>
              <a href="/mi-perfil" className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors font-bold flex items-center gap-1.5">
                <span>⚙️</span> Mi Perfil
              </a>
              <a href="/auth/logout" className="text-xs bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 hover:border-red-800/50 text-red-400 px-2.5 py-1 rounded-lg transition-colors font-medium">
                Salir
              </a>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
          <StudentProfile dev={currentDev} saved={saved} badges={badges} />
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-650">
          <p>© 2026 Repo Rivals. Hecho con ❤️ para Ingeniería en Sistemas con Hono & Bun.</p>
        </footer>
      </body>
    </html>
  );
});

// POST /mi-perfil: Handle saving student profile data
app.post('/mi-perfil', async (c) => {
  const currentDev = await getAuthDev(c);
  if (!currentDev) {
    return c.redirect('/auth/login');
  }

  const body = await c.req.parseBody();
  const nombre = (body.nombre as string || '').trim();
  const generacion = (body.generacion as string || '').trim();
  const numero_control = (body.numero_control as string || '').trim();
  const carreraRaw = (body.carrera as string || 'ISC').trim().toUpperCase();
  const carrera = carreraRaw === 'IIAR' ? 'IIAR' : 'ISC';

  if (supabase) {
    try {
      const currentMetadata = currentDev.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        generacion,
        numero_control,
        carrera,
      };

      await supabase
        .from('devs')
        .update({
          nombre: nombre || currentDev.nombre,
          metadata: updatedMetadata,
        })
        .eq('id', currentDev.id);
    } catch (e) {
      console.error('Failed to update student profile:', e);
      return c.text('Error saving profile changes', 500);
    }
  }

  return c.redirect('/mi-perfil?saved=1');
});

app.post('/admin/add-dev', async (c) => {
  const admin = await getAdminUser(c);
  if (!admin) {
    return c.text('Unauthorized: Access denied', 403);
  }

  const body = await c.req.parseBody();
  const github_username = (body.github_username as string || '').trim();
  const nombre = (body.nombre as string || github_username).trim();
  const generacion = (body.generacion as string || '').trim();
  const numero_control = (body.numero_control as string || '').trim();
  const carreraRaw = (body.carrera as string || 'ISC').trim().toUpperCase();
  const carrera = carreraRaw === 'IIAR' ? 'IIAR' : 'ISC';

  if (!github_username) {
    return c.text('Missing required fields', 400);
  }

  if (supabase) {
    try {
      const metadata: any = { carrera };
      if (generacion) metadata.generacion = generacion;
      if (numero_control) metadata.numero_control = numero_control;

      const { data: newDev, error } = await supabase
        .from('devs')
        .insert({
          nombre,
          github_username,
          metadata,
        })
        .select()
        .single();
      
      if (error) throw error;

      if (newDev) {
        await syncDevStats(newDev);
      }
    } catch (err: any) {
      return c.text('Error adding dev: ' + err.message, 500);
    }
  }

  return c.redirect('/');
});

app.get('/admin/delete-dev/:id', async (c) => {
  const admin = await getAdminUser(c);
  if (!admin) {
    return c.text('Unauthorized: Access denied', 403);
  }

  const id = c.req.param('id');
  if (supabase && id) {
    try {
      await supabase.from('devs').delete().eq('id', id);
    } catch (err: any) {
      return c.text('Error deleting dev: ' + err.message, 500);
    }
  }

  return c.redirect('/');
});

app.get('/admin/sync-dev/:id', async (c) => {
  const admin = await getAdminUser(c);
  if (!admin) {
    return c.text('Unauthorized: Access denied', 403);
  }

  const id = c.req.param('id');
  if (supabase && id) {
    try {
      const { data: dev } = await supabase.from('devs').select('*').eq('id', id).single();
      if (dev) {
        await syncDevStats(dev);
      }
    } catch (err: any) {
      return c.text('Error syncing dev: ' + err.message, 500);
    }
  }

  return c.redirect('/');
});

app.get('/admin/sync-all', async (c) => {
  const admin = await getAdminUser(c);
  if (!admin) {
    return c.text('Unauthorized: Access denied', 403);
  }

  if (supabase) {
    // Fetch developers to sync
    supabase.from('devs').select('*').then(({ data: devs }) => {
      if (devs && devs.length > 0) {
        console.log(`[SyncAll] Starting background sync for ${devs.length} devs...`);
        // Execute syncs in parallel to optimize DB connections and speed
        Promise.all(devs.map(dev => 
          syncDevStats(dev)
            .then(res => console.log(`[SyncAll] Finished syncing @${dev.github_username}: ${res} contributions`))
            .catch(err => console.error(`[SyncAll] Error syncing @${dev.github_username}:`, err))
        )).then(() => {
          console.log('[SyncAll] Background sync for all developers completed.');
        });
      }
    }).catch(err => {
      console.error('[SyncAll] Error fetching devs for background sync:', err);
    });
  }

  // Redirect immediately so the page does not freeze
  return c.redirect('/');
});

// 3. POST Route: Performs Github Stats Sync (adapted from Edge Function)
app.post('/api/sync', async (c) => {
  if (!supabase) {
    return c.json({ error: 'Supabase credentials are not configured in environment.' }, 500);
  }

  try {
    const { data: devs, error: devsError } = await supabase.from("devs").select("*");
    if (devsError) throw devsError;
    if (!devs || devs.length === 0) {
      return c.json({ message: "No devs to sync." }, 200);
    }

    const results = [];
    for (const dev of devs) {
      const newScore = await syncDevStats(dev);
      results.push({ dev: dev.github_username, new_score: newScore });
    }

    return c.json({ status: "success", results });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

const port = parseInt(process.env.PORT || '3000', 10);
console.log(`[Server] Hono server started on port ${port}`);

Bun.serve({
  port,
  fetch: app.fetch,
});
