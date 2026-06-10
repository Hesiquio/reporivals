import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createClient } from '@supabase/supabase-js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { HeatmapComparator, StudentWithStats } from './components/HeatmapComparator';
import { BadgeShowcase, Badge, StudentBadge } from './components/BadgeShowcase';
import { Leaderboard, LeaderboardStudent } from './components/Leaderboard';
import { StudentHeatmap } from './components/StudentHeatmap';
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

// 0. Helper function to sync a single student's GitHub stats historically using GraphQL API
async function syncStudentStats(student: { id: string; github_username: string }) {
  if (!supabase) return 0;

  const query = `
    query($username: String!) {
      user(login: $username) {
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
        variables: { username: student.github_username },
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
              student_id: student.id,
              fecha: dateStr,
              stats: { commits: count, pull_requests: 0, issues: 0, stars_received: 0 },
            }, { onConflict: "student_id,fecha" });
          }
        }

        // Calculate score from exact GraphQL aggregates
        const commits = collection.totalCommitContributions || 0;
        const prs = collection.totalPullRequestContributions || 0;
        const issues = collection.totalIssueContributions || 0;

        const newScore = commits * POINTS_PER_COMMIT + prs * POINTS_PER_PR + issues * POINTS_PER_ISSUE;

        const totalContributions = calendar.totalContributions || 0;
        await supabase.from("students").update({ total_score: newScore, total_contributions: totalContributions }).eq("id", student.id);

        // Evaluate badges
        const totalCommits = commits;
        const { data: dbBadges } = await supabase.from("badges").select("id, criterio_desbloqueo");
        for (const badge of dbBadges || []) {
          const criterion = (badge.criterio_desbloqueo as unknown as BadgeCriterion) || {};
          if (criterion.type === "first_commit") {
            if (totalCommits > 0) {
              try {
                await supabase.from("student_badges").insert({ student_id: student.id, badge_id: badge.id });
              } catch (e) {}
            }
          } else if (criterion.type === "streak") {
            const targetDays = criterion.target_days || 3;
            const metric = criterion.metric || "commits";

            const { data: history } = await supabase.from("github_stats").select("fecha, stats").eq("student_id", student.id).order("fecha", { ascending: true });
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
                  await supabase.from("student_badges").insert({ student_id: student.id, badge_id: badge.id });
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
  let currentStudent: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: student } = await supabase.from('students').select('*').eq('auth_id', user.id).single();
        if (student) {
          currentStudent = student;
        }
      }
    } catch (e) {
      console.error('Failed to get user from token:', e);
    }
  }

  // Load real students list for Leaderboard
  let leaderboardStudents: LeaderboardStudent[] = [];
  if (supabase) {
    try {
      const { data: studentsData } = await supabase.from('students').select('*').order('total_score', { ascending: false });
      const { data: studentBadgesData } = await supabase.from('student_badges').select('student_id, badges(id, nombre, icon_url)');
      
      const badgesByStudent: Record<string, any[]> = {};
      studentBadgesData?.forEach((row: any) => {
        const sId = row.student_id;
        const b = row.badges;
        if (sId && b) {
          if (!badgesByStudent[sId]) {
            badgesByStudent[sId] = [];
          }
          if (!badgesByStudent[sId].find(x => x.id === b.id)) {
            badgesByStudent[sId].push({
              id: b.id,
              nombre: b.nombre,
              icon_url: b.icon_url,
            });
          }
        }
      });

      leaderboardStudents = (studentsData || []).map((student: any) => ({
        id: student.id,
        nombre: student.nombre,
        github_username: student.github_username,
        avatar_url: student.avatar_url,
        total_score: student.total_score,
        total_contributions: student.total_contributions || 0,
        badges: badgesByStudent[student.id] || [],
      }));
    } catch (e) {
      console.error("Failed to load leaderboard data:", e);
    }
  }

  // Load logged-in student's yearly stats (365 days)
  let currentStudentStats: any[] = [];
  if (currentStudent && supabase) {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setDate(oneYearAgo.getDate() - 365);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
      
      let { data: statsData } = await supabase
        .from('github_stats')
        .select('fecha, stats')
        .eq('student_id', currentStudent.id)
        .gte('fecha', oneYearAgoStr)
        .order('fecha', { ascending: true });

      // Automatically run first-time sync in the background if no stats are loaded yet
      if (!statsData || statsData.length === 0) {
        await syncStudentStats(currentStudent);
        
        // Refetch stats
        const { data: refetched } = await supabase
          .from('github_stats')
          .select('fecha, stats')
          .eq('student_id', currentStudent.id)
          .gte('fecha', oneYearAgoStr)
          .order('fecha', { ascending: true });
        
        statsData = refetched;

        // Refresh student info (since total_score changes)
        const { data: updatedStudent } = await supabase.from('students').select('*').eq('id', currentStudent.id).single();
        if (updatedStudent) {
          currentStudent = updatedStudent;
        }

        // Also reload the leaderboard students list so the user sees their updated rank immediately!
        try {
          const { data: studentsData } = await supabase.from('students').select('*').order('total_score', { ascending: false });
          const { data: studentBadgesData } = await supabase.from('student_badges').select('student_id, badges(id, nombre, icon_url)');
          
          const badgesByStudent: Record<string, any[]> = {};
          studentBadgesData?.forEach((row: any) => {
            const sId = row.student_id;
            const b = row.badges;
            if (sId && b) {
              if (!badgesByStudent[sId]) {
                badgesByStudent[sId] = [];
              }
              if (!badgesByStudent[sId].find(x => x.id === b.id)) {
                badgesByStudent[sId].push({
                  id: b.id,
                  nombre: b.nombre,
                  icon_url: b.icon_url,
                });
              }
            }
          });

          leaderboardStudents = (studentsData || []).map((student: any) => ({
            id: student.id,
            nombre: student.nombre,
            github_username: student.github_username,
            avatar_url: student.avatar_url,
            total_score: student.total_score,
            total_contributions: student.total_contributions || 0,
            badges: badgesByStudent[student.id] || [],
          }));
        } catch(err){}
      }

      if (statsData) {
        currentStudentStats = statsData.map((row) => ({
          fecha: row.fecha,
          commits: row.stats?.commits || 0,
          pull_requests: row.stats?.pull_requests || 0,
          issues: row.stats?.issues || 0,
          stars_received: row.stats?.stars_received || 0,
        }));
      }
    } catch (e) {
      console.error("Failed to load student stats:", e);
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
            <a href="/sobre-nosotros" className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
              Sobre Nosotros
            </a>
            {currentStudent ? (
              <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/80 pl-2 pr-3 py-1.5 rounded-xl">
                {currentStudent.avatar_url ? (
                  <img src={currentStudent.avatar_url} className="w-8 h-8 rounded-full border border-slate-700" alt={currentStudent.nombre} />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                    {currentStudent.nombre.charAt(0)}
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-tight">{currentStudent.nombre}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">@{currentStudent.github_username}</p>
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
                Compara tu actividad en GitHub con la de tus compañeros de clase. Consigue insignias, supera desafíos en tiempo real y asciende en la tabla de posiciones.
              </p>
            </div>
            <div className="flex gap-3">
              <div className="bg-slate-950 border border-slate-850 px-4 py-3 rounded-xl text-center">
                <span className="block text-2xl font-bold text-white">42</span>
                <span className="text-[10px] uppercase text-slate-500 font-semibold">Alumnos</span>
              </div>
              <div className="bg-slate-950 border border-slate-850 px-4 py-3 rounded-xl text-center">
                <span className="block text-2xl font-bold text-emerald-400">12.5k</span>
                <span className="text-[10px] uppercase text-slate-500 font-semibold">Commits</span>
              </div>
            </div>
          </section>

          {/* Admin Panel Form if Admin */}
          {currentStudent?.is_admin && (
            <section className="bg-slate-900/35 border border-slate-850 p-6 rounded-2xl space-y-4">
              <h3 className="text-md font-bold text-white tracking-wide flex items-center gap-2">
                <span>⚙️</span> Panel de Administración - Pre-registrar Alumno
              </h3>
              <form method="POST" action="/admin/add-student" className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Nombre Completo</label>
                  <input type="text" name="nombre" required placeholder="Ej. Carlos Mendoza" className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Usuario de GitHub</label>
                  <input type="text" name="github_username" required placeholder="Ej. carlosmdev" className="w-full text-sm bg-slate-950 border border-slate-850 rounded-xl px-3.5 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50" />
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 rounded-xl transition-all shadow-md shadow-emerald-500/10">
                    Registrar en Ranking
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* Real Live Leaderboard */}
          <section className="space-y-4">
            <Leaderboard students={leaderboardStudents} currentStudentId={currentStudent?.id} isAdmin={currentStudent?.is_admin || false} />
          </section>

          {/* Yearly Heatmap if logged in */}
          {currentStudent && (
            <section className="space-y-4">
              <StudentHeatmap
                studentName={currentStudent.nombre}
                githubUsername={currentStudent.github_username}
                stats={currentStudentStats}
                daysToDisplay={365}
              />
            </section>
          )}
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
  let currentStudent: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: student } = await supabase.from('students').select('*').eq('auth_id', user.id).single();
        if (student) {
          currentStudent = student;
        }
      }
    } catch (e) {}
  }

  // Load static demo datasets
  const studentDataA = {
    student: { id: "s-1", nombre: "Carlos Mendoza", github_username: "carlosmdev", avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80", total_score: 1250 },
    stats: generateMockStats(4),
  };
  const studentDataB = {
    student: { id: "s-2", nombre: "Sofía Rojas", github_username: "sofiarojas", avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", total_score: 1480 },
    stats: generateMockStats(9),
  };
  const badgesList = [
    { id: "b-1", nombre: "Hola Mundo", descripcion: "Primera aportación en el ranking.", icon_url: "🚀", criterio_desbloqueo: "primer_commit" },
    { id: "b-2", nombre: "Ave Nocturna", descripcion: "Commit realizado después de la medianoche.", icon_url: "🦉", criterio_desbloqueo: "ave_nocturna" },
    { id: "b-3", nombre: "Constancia Brutal", descripcion: "Racha activa de aportaciones por 3 días seguidos.", icon_url: "🔥", criterio_desbloqueo: "racha_3_dias" },
  ];
  const studentBadgesList = [
    { id: "sb-1", student_id: "s-1", badge_id: "b-1", otorgado_en: "2026-06-01T12:00:00Z" },
    { id: "sb-2", student_id: "s-1", badge_id: "b-3", otorgado_en: "2026-06-08T15:00:00Z" },
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
            {currentStudent ? (
              <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800/80 pl-2 pr-3 py-1.5 rounded-xl">
                {currentStudent.avatar_url ? (
                  <img src={currentStudent.avatar_url} className="w-8 h-8 rounded-full border border-slate-700" alt={currentStudent.nombre} />
                ) : (
                  <div className="w-8 h-8 rounded-full border border-slate-700 bg-slate-800 flex items-center justify-center font-bold text-xs text-white">
                    {currentStudent.nombre.charAt(0)}
                  </div>
                )}
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-white leading-tight">{currentStudent.nombre}</p>
                  <p className="text-[10px] text-emerald-400 font-mono">@{currentStudent.github_username}</p>
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
            <HeatmapComparator studentA={studentDataA} studentB={studentDataB} daysToDisplay={120} />
          </section>

          {/* Static Badges Demo */}
          <section className="space-y-4">
            <h3 className="text-lg font-bold text-white tracking-wide">🎖️ Vitrina de Insignias Interactiva (Demostración)</h3>
            <BadgeShowcase
              allBadges={badgesList}
              studentBadges={studentBadgesList}
              studentName={studentDataA.student.nombre}
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
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'Lax',
  });
  
  setCookie(c, 'sb-refresh-token', refreshToken, {
    path: '/',
    secure: isSecure,
    httpOnly: true,
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
  let currentStudent: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: student } = await supabase.from('students').select('*').eq('auth_id', user.id).single();
        if (student) {
          await syncStudentStats(student);
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
      const { data: student } = await supabase.from('students').select('*').eq('auth_id', user.id).single();
      if (student && student.is_admin) {
        return student;
      }
    }
  } catch (e) {}
  return null;
}

app.post('/admin/add-student', async (c) => {
  const admin = await getAdminUser(c);
  if (!admin) {
    return c.text('Unauthorized: Access denied', 403);
  }

  const body = await c.req.parseBody();
  const nombre = body.nombre as string;
  const github_username = (body.github_username as string).trim();

  if (!nombre || !github_username) {
    return c.text('Missing required fields', 400);
  }

  if (supabase) {
    try {
      const { data: newStudent, error } = await supabase
        .from('students')
        .insert({ nombre, github_username })
        .select()
        .single();
      
      if (error) throw error;

      if (newStudent) {
        await syncStudentStats(newStudent);
      }
    } catch (err: any) {
      return c.text('Error adding student: ' + err.message, 500);
    }
  }

  return c.redirect('/');
});

app.get('/admin/delete-student/:id', async (c) => {
  const admin = await getAdminUser(c);
  if (!admin) {
    return c.text('Unauthorized: Access denied', 403);
  }

  const id = c.req.param('id');
  if (supabase && id) {
    try {
      await supabase.from('students').delete().eq('id', id);
    } catch (err: any) {
      return c.text('Error deleting student: ' + err.message, 500);
    }
  }

  return c.redirect('/');
});

app.get('/admin/sync-student/:id', async (c) => {
  const admin = await getAdminUser(c);
  if (!admin) {
    return c.text('Unauthorized: Access denied', 403);
  }

  const id = c.req.param('id');
  if (supabase && id) {
    try {
      const { data: student } = await supabase.from('students').select('*').eq('id', id).single();
      if (student) {
        await syncStudentStats(student);
      }
    } catch (err: any) {
      return c.text('Error syncing student: ' + err.message, 500);
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
      const { data: students } = await supabase.from('students').select('*');
      if (students) {
        for (const student of students) {
          await syncStudentStats(student);
        }
      }
    } catch (err: any) {
      return c.text('Error syncing all students: ' + err.message, 500);
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
    const { data: students, error: studentsError } = await supabase.from("students").select("*");
    if (studentsError) throw studentsError;
    if (!students || students.length === 0) {
      return c.json({ message: "No students to sync." }, 200);
    }

    const results = [];
    for (const student of students) {
      const newScore = await syncStudentStats(student);
      results.push({ student: student.github_username, new_score: newScore });
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
