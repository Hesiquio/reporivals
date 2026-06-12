import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createClient } from '@supabase/supabase-js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { HeatmapComparator, DevWithStats } from './components/HeatmapComparator';
import { BadgeShowcase, Badge, DevBadge } from './components/BadgeShowcase';
import { Leaderboard, LeaderboardDev } from './components/Leaderboard';
import { DevHeatmap } from './components/DevHeatmap';
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
    };
    if (GITHUB_PAT) {
      headers["Authorization"] = `Bearer ${GITHUB_PAT}`;
    }

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
      const userObj = result.data?.user;
      if (userObj) {
        const collection = userObj.contributionsCollection;
        const calendar = collection.contributionCalendar;

        const weeks = calendar.weeks || [];
        for (const week of weeks) {
          const days = week.contributionDays || [];
          for (const day of days) {
            const dateStr = day.date;
            const count = day.contributionCount || 0;

            // Map the daily contribution count as commits in stats (so colors and counts match)
            await supabase.from("github_stats").upsert({
              dev_id: dev.id,
              fecha: dateStr,
              stats: { commits: count, pull_requests: 0, issues: 0, stars_received: 0 },
            }, { onConflict: "dev_id,fecha" });
          }
        }

        // Calculate score from exact GraphQL aggregates
        const commits = collection.totalCommitContributions || 0;
        const prs = collection.totalPullRequestContributions || 0;
        const issues = collection.totalIssueContributions || 0;

        const newScore = commits * POINTS_PER_COMMIT + prs * POINTS_PER_PR + issues * POINTS_PER_ISSUE;

        const totalContributions = calendar.totalContributions || 0;
        
        // Auto-fill avatar and name if not already set or updated from GitHub
        const updateData: any = { 
          total_score: newScore, 
          total_contributions: totalContributions 
        };
        if (userObj.avatarUrl) {
          updateData.avatar_url = userObj.avatarUrl;
        }
        if (userObj.name) {
          updateData.nombre = userObj.name;
        }

        await supabase.from("devs").update(updateData).eq("id", dev.id);

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

// 1. Mock Data Generator for Sandbox / Fallbacks
const generateMockStats = (seed: number) => {
  const stats = [];
  const today = new Date();
  for (let i = 119; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    stats.push({
      fecha: d.toISOString().split("T")[0],
      commits: Math.random() > 0.4 ? Math.floor(Math.random() * 4 * (Math.sin((i + seed) * 0.1) + 1)) : 0,
      pull_requests: Math.random() > 0.85 ? 1 : 0,
      issues: Math.random() > 0.9 ? 1 : 0,
      stars_received: Math.random() > 0.95 ? Math.floor(Math.random() * 3) : 0,
    });
  }
  return stats;
};

// 2. GET Route: Renders the Dashboard
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

  // Sort parameter
  const sort = c.req.query('sort') || 'contributions'; // default to contributions like github

  // Load real devs list for Leaderboard
  let leaderboardDevs: LeaderboardDev[] = [];
  if (supabase) {
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
        badges: badgesByDev[dev.id] || [],
      }));
    } catch (e) {
      console.error("Failed to load leaderboard data:", e);
    }
  }

  // Calculate interactive banner stats
  const totalDevsCount = leaderboardDevs.length;
  const totalGlobalContributions = leaderboardDevs.reduce((sum, d) => sum + d.total_contributions, 0);

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
            badges: badgesByDev[dev.id] || [],
          }));
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
          <section className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/20 border border-slate-900 p-8 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="max-w-xl">
              <h2 className="text-2xl md:text-3xl font-black text-white">
                Plataforma Gamificada de Aprendizaje
              </h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Compara tu actividad en GitHub con la de tus compañeros devs. Consigue insignias, supera desafíos en tiempo real y asciende en la tabla de posiciones.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="bg-slate-950 border border-slate-850 px-5 py-3 rounded-xl text-center min-w-[90px]">
                <span className="block text-2xl font-bold text-white">{totalDevsCount}</span>
                <span className="text-[10px] uppercase text-slate-500 font-semibold">Devs</span>
              </div>
              <div className="bg-slate-950 border border-slate-850 px-5 py-3 rounded-xl text-center min-w-[120px]">
                <span className="block text-2xl font-bold text-emerald-400">
                  {totalGlobalContributions >= 1000 
                    ? `${(totalGlobalContributions / 1000).toFixed(1)}k` 
                    : totalGlobalContributions}
                </span>
                <span className="text-[10px] uppercase text-slate-500 font-semibold">Contribuciones</span>
              </div>
            </div>
          </section>

          {/* Admin Panel Form if Admin */}
          {currentDev?.is_admin && (
            <section className="bg-slate-900/35 border border-slate-850 p-6 rounded-2xl space-y-4">
              <h3 className="text-md font-bold text-white tracking-wide flex items-center gap-2">
                <span>⚙️</span> Panel de Administración - Pre-registrar Dev
              </h3>
              <form method="POST" action="/admin/add-dev" className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Usuario de GitHub</label>
                  <input type="text" name="github_username" required placeholder="Ej. carlosmdev" className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div className="w-full sm:w-auto">
                  <button type="submit" className="w-full text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-6 rounded-xl transition-all shadow-md shadow-emerald-500/10">
                    Registrar en Ranking
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Real Live Leaderboard */}
          <section className="space-y-4">
            <Leaderboard devs={leaderboardDevs} currentDevId={currentDev?.id} isAdmin={currentDev?.is_admin || false} activeSort={sort} />
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

  // Load static demo datasets
  const devDataA = {
    dev: { id: "s-1", nombre: "Carlos Mendoza", github_username: "carlosmdev", avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80", total_score: 1250 },
    stats: generateMockStats(4),
  };
  const devDataB = {
    dev: { id: "s-2", nombre: "Sofía Rojas", github_username: "sofiarojas", avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", total_score: 1480 },
    stats: generateMockStats(9),
  };
  const badgesList = [
    { id: "b-1", nombre: "Hola Mundo", descripcion: "Primera aportación en el ranking.", icon_url: "🚀", criterio_desbloqueo: "primer_commit" },
    { id: "b-2", nombre: "Ave Nocturna", descripcion: "Commit realizado después de la medianoche.", icon_url: "🦉", criterio_desbloqueo: "ave_nocturna" },
    { id: "b-3", nombre: "Constancia Brutal", descripcion: "Racha activa de aportaciones por 3 días seguidos.", icon_url: "🔥", criterio_desbloqueo: "racha_3_dias" },
  ];
  const devBadgesList = [
    { id: "sb-1", dev_id: "s-1", badge_id: "b-1", otorgado_en: "2026-06-01T12:00:00Z" },
    { id: "sb-2", dev_id: "s-1", badge_id: "b-3", otorgado_en: "2026-06-08T15:00:00Z" },
  ];

  return c.html(
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Sobre Repo Rivals - Demostración de Funciones</title>
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
              Volver al Ranking
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
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-tight">{currentDev.nombre}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">@{currentDev.github_username}</p>
                </div>
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

        <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-10">
          <section className="text-center space-y-3 py-6 bg-slate-900/20 border border-slate-900/80 rounded-2xl p-6">
            <h2 className="text-3xl font-black text-white tracking-wide">Sobre Repo Rivals</h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-sm leading-relaxed">
              Esta sección demuestra cómo se comparan las contribuciones de GitHub y cómo funciona el gabinete interactivo de insignias del sistema.
            </p>
          </section>

          {/* Static Heatmap Demo */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-wide">🔥 Comparador de Actividad (Demostración)</h3>
            <HeatmapComparator devA={devDataA} devB={devDataB} daysToDisplay={120} />
          </section>

          {/* Static Badges Demo */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-wide">🎖️ Vitrina de Insignias Interactiva (Demostración)</h3>
            <BadgeShowcase
              allBadges={badgesList}
              devBadges={devBadgesList}
              devName={devDataA.dev.nombre}
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

  // Fetch stats for the heatmap (last 365 days)
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

  const { data: statsData } = await supabase
    .from('github_stats')
    .select('fecha, stats')
    .eq('dev_id', targetDev.id)
    .gte('fecha', oneYearAgoStr)
    .order('fecha', { ascending: true });

  const currentDevStats = (statsData || []).map((row) => ({
    fecha: row.fecha,
    commits: row.stats?.commits || 0,
    pull_requests: row.stats?.pull_requests || 0,
    issues: row.stats?.issues || 0,
    stars_received: row.stats?.stars_received || 0,
  }));

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
              Volver al Ranking
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
          <section className="bg-slate-900/40 border border-slate-850 p-8 rounded-2xl flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <img src={targetDev.avatar_url} className="w-24 h-24 rounded-full border border-slate-800 ring-4 ring-emerald-500/20" alt={targetDev.nombre} />
            <div className="text-center sm:text-left space-y-2 flex-1">
              <h2 className="text-2xl font-black text-white">{targetDev.nombre}</h2>
              <p className="text-slate-400 text-sm font-mono">@{targetDev.github_username}</p>
              
              <div className="flex flex-wrap gap-4 mt-2 justify-center sm:justify-start">
                <span className="text-xs bg-emerald-500/15 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/10 font-mono font-bold">
                  🔥 Contribuciones: {targetDev.total_contributions}
                </span>
                <span className="text-xs bg-cyan-500/15 text-cyan-400 px-3 py-1 rounded-full border border-cyan-500/10 font-mono font-bold">
                  💎 Puntos: {targetDev.total_score} pts
                </span>
              </div>
            </div>
          </section>

          {/* Heatmap */}
          <section>
            <DevHeatmap
              devName={targetDev.nombre}
              githubUsername={targetDev.github_username}
              stats={currentDevStats}
              daysToDisplay={365}
            />
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
              Volver al Ranking
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
  const origin = new URL(c.req.url).origin;
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

// Helper to check if requester is admin
async function getAdminUser(c: any) {
  if (!supabase) return null;
  const accessToken = getCookie(c, 'sb-access-token');
  if (!accessToken) return null;
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (user && !userError) {
      const { data: dev } = await supabase.from('devs').select('*').eq('auth_id', user.id).single();
      if (dev && dev.is_admin) {
        return dev;
      }
    }
  } catch (e) {}
  return null;
}

app.post('/admin/add-dev', async (c) => {
  const admin = await getAdminUser(c);
  if (!admin) {
    return c.text('Unauthorized: Access denied', 403);
  }

  const body = await c.req.parseBody();
  const github_username = (body.github_username as string || '').trim();

  if (!github_username) {
    return c.text('Missing required fields', 400);
  }

  if (supabase) {
    try {
      const { data: newDev, error } = await supabase
        .from('devs')
        .insert({ nombre: github_username, github_username })
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
    try {
      const { data: devs } = await supabase.from('devs').select('*');
      if (devs) {
        for (const dev of devs) {
          await syncDevStats(dev);
        }
      }
    } catch (err: any) {
      return c.text('Error syncing all devs: ' + err.message, 500);
    }
  }

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

// Serve locally using Bun if run directly (development / Render)
if (typeof Bun !== 'undefined') {
  const port = parseInt(process.env.PORT || '3000', 10);
  console.log(`Hono server started on port ${port}`);
  Bun.serve({
    port,
    fetch: app.fetch,
  });
}

// Export for Vercel Serverless (Node.js Runtime)
export const config = {
  runtime: 'nodejs',
};

export default handle(app);
