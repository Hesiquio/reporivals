import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { createClient } from '@supabase/supabase-js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { HeatmapComparator, StudentWithStats } from './components/HeatmapComparator';
import { BadgeShowcase, Badge, StudentBadge } from './components/BadgeShowcase';
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
  let studentDataA: StudentWithStats;
  let studentDataB: StudentWithStats;
  let badgesList: Badge[] = [];
  let studentBadgesList: StudentBadge[] = [];

  // Auth state
  let currentStudent: any = null;
  const accessToken = getCookie(c, 'sb-access-token');

  if (supabase && accessToken) {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
      if (user && !userError) {
        const { data: student } = await supabase.from('students').select('*').eq('id', user.id).single();
        if (student) {
          currentStudent = student;
        }
      }
    } catch (e) {
      console.error('Failed to get user from token:', e);
    }
  }

  // Try to load real data from Supabase if connected
  if (supabase) {
    try {
      const { data: students } = await supabase.from('students').select('*').limit(2);
      const { data: badges } = await supabase.from('badges').select('*');

      if (students && students.length >= 2) {
        const { data: statsA } = await supabase.from('github_stats').select('fecha, stats').eq('student_id', students[0].id);
        const { data: statsB } = await supabase.from('github_stats').select('fecha, stats').eq('student_id', students[1].id);
        const { data: sBadges } = await supabase.from('student_badges').select('*').eq('student_id', students[0].id);

        studentDataA = {
          student: students[0],
          stats: (statsA || []).map((row) => ({
            fecha: row.fecha,
            commits: row.stats?.commits || 0,
            pull_requests: row.stats?.pull_requests || 0,
            issues: row.stats?.issues || 0,
            stars_received: row.stats?.stars_received || 0,
          })),
        };

        studentDataB = {
          student: students[1],
          stats: (statsB || []).map((row) => ({
            fecha: row.fecha,
            commits: row.stats?.commits || 0,
            pull_requests: row.stats?.pull_requests || 0,
            issues: row.stats?.issues || 0,
            stars_received: row.stats?.stars_received || 0,
          })),
        };

        badgesList = badges || [];
        studentBadgesList = sBadges || [];
      } else {
        throw new Error('Fallback to sandbox');
      }
    } catch (e) {
      // Fallback sandbox variables if DB is not configured yet
      studentDataA = {
        student: { id: "s-1", nombre: "Carlos Mendoza", github_username: "carlosmdev", avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80", total_score: 1250 },
        stats: generateMockStats(4),
      };
      studentDataB = {
        student: { id: "s-2", nombre: "Sofía Rojas", github_username: "sofiarojas", avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", total_score: 1480 },
        stats: generateMockStats(9),
      };
      badgesList = [
        { id: "b-1", nombre: "Hola Mundo", descripcion: "Primera aportación en el ranking.", icon_url: "🚀", criterio_desbloqueo: "primer_commit" },
        { id: "b-2", nombre: "Ave Nocturna", descripcion: "Commit realizado después de la medianoche.", icon_url: "🦉", criterio_desbloqueo: "ave_nocturna" },
        { id: "b-3", nombre: "Constancia Brutal", descripcion: "Racha activa de aportaciones por 3 días seguidos.", icon_url: "🔥", criterio_desbloqueo: "racha_3_dias" },
      ];
      studentBadgesList = [
        { id: "sb-1", student_id: "s-1", badge_id: "b-1", otorgado_en: "2026-06-01T12:00:00Z" },
        { id: "sb-2", student_id: "s-1", badge_id: "b-3", otorgado_en: "2026-06-08T15:00:00Z" },
      ];
    }
  } else {
    // Sandbox defaults
    studentDataA = {
      student: { id: "s-1", nombre: "Carlos Mendoza", github_username: "carlosmdev", avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80", total_score: 1250 },
      stats: generateMockStats(4),
    };
    studentDataB = {
      student: { id: "s-2", nombre: "Sofía Rojas", github_username: "sofiarojas", avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", total_score: 1480 },
      stats: generateMockStats(9),
    };
    badgesList = [
      { id: "b-1", nombre: "Hola Mundo", descripcion: "Primera aportación en el ranking.", icon_url: "🚀", criterio_desbloqueo: "primer_commit" },
      { id: "b-2", nombre: "Ave Nocturna", descripcion: "Commit realizado después de la medianoche.", icon_url: "🦉", criterio_desbloqueo: "ave_nocturna" },
      { id: "b-3", nombre: "Constancia Brutal", descripcion: "Racha activa de aportaciones por 3 días seguidos.", icon_url: "🔥", criterio_desbloqueo: "racha_3_dias" },
    ];
    studentBadgesList = [
      { id: "sb-1", student_id: "s-1", badge_id: "b-1", otorgado_en: "2026-06-01T12:00:00Z" },
      { id: "sb-2", student_id: "s-1", badge_id: "b-3", otorgado_en: "2026-06-08T15:00:00Z" },
    ];
  }

  // If there's a logged-in student, let's load their real stats/badges for custom display
  let mainStudentName = studentDataA.student.nombre;
  let mainBadgesList = badgesList;
  let mainStudentBadgesList = studentBadgesList;

  if (currentStudent && supabase) {
    try {
      const { data: sBadges } = await supabase.from('student_badges').select('*').eq('student_id', currentStudent.id);
      if (sBadges) {
        mainStudentBadgesList = sBadges;
        mainStudentName = currentStudent.nombre;
      }
    } catch(e){}
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

          {/* Heatmap Section */}
          <section className="space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-white tracking-wide">🔥 Duelo Amistoso de Actividad</h3>
              <p className="text-xs text-slate-400">Compara el historial de aportaciones entre Carlos y Sofía</p>
            </div>
            <HeatmapComparator studentA={studentDataA} studentB={studentDataB} daysToDisplay={120} />
          </section>

          {/* Badges Section */}
          <section className="space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-white tracking-wide">🎖️ Insignias de {mainStudentName}</h3>
              <p className="text-xs text-slate-400">Insignias obtenidas e hitos restantes por desbloquear</p>
            </div>
            <BadgeShowcase
              allBadges={mainBadgesList}
              studentBadges={mainStudentBadgesList}
              studentName={mainStudentName}
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
    return c.text('Authorization code not provided', 400);
  }

  const { data, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
  if (sessionError || !data.session) {
    return c.text('Failed to exchange code for session: ' + (sessionError?.message || 'No session'), 400);
  }

  // Set cookies
  const accessToken = data.session.access_token;
  const refreshToken = data.session.refresh_token;

  setCookie(c, 'sb-access-token', accessToken, {
    path: '/',
    secure: true,
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'Lax',
  });
  
  setCookie(c, 'sb-refresh-token', refreshToken, {
    path: '/',
    secure: true,
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

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    const { data: dbBadges, error: badgesError } = await supabase.from("badges").select("id, criterio_desbloqueo");
    if (badgesError) throw badgesError;

    const results = [];

    for (const student of students) {
      let commits = 0;
      let pull_requests = 0;
      let issues = 0;
      let stars_received = 0;

      // Query GitHub API
      try {
        const headers: HeadersInit = { "Accept": "application/vnd.github.v3+json" };
        if (GITHUB_PAT) {
          headers["Authorization"] = `Bearer ${GITHUB_PAT}`;
        }

        const response = await fetch(`https://api.github.com/users/${student.github_username}/events`, { headers });
        if (response.ok) {
          const events = await response.json();
          events.forEach((event: any) => {
            const eventDate = event.created_at ? event.created_at.split("T")[0] : "";
            if (eventDate === dateStr) {
              if (event.type === "PushEvent") {
                commits += event.payload?.commits?.length || 1;
              } else if (event.type === "PullRequestEvent" && event.payload?.action === "opened") {
                pull_requests += 1;
              } else if (event.type === "IssuesEvent" && event.payload?.action === "opened") {
                issues += 1;
              } else if (event.type === "WatchEvent" && event.payload?.action === "started") {
                stars_received += 1;
              }
            }
          });
        }
      } catch (err) {
        console.error(`Error querying GitHub API for ${student.github_username}:`, err);
      }

      // Upsert stats
      await supabase.from("github_stats").upsert({
        student_id: student.id,
        fecha: dateStr,
        stats: { commits, pull_requests, issues, stars_received },
      }, { onConflict: "student_id,fecha" });

      // Recalculate score
      const { data: allStats } = await supabase.from("github_stats").select("stats").eq("student_id", student.id);
      let newScore = 0;
      let totalCommits = 0;

      allStats?.forEach((row) => {
        const s = row.stats || {};
        const c = s.commits || 0;
        totalCommits += c;
        newScore += c * POINTS_PER_COMMIT + (s.pull_requests || 0) * POINTS_PER_PR + (s.issues || 0) * POINTS_PER_ISSUE + (s.stars_received || 0) * POINTS_PER_STAR;
      });

      await supabase.from("students").update({ total_score: newScore }).eq("id", student.id);

      // Evaluate badges
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

      results.push({ student: student.github_username, new_score: newScore });
    }

    return c.json({ status: "success", results });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Serve locally using Bun if run directly (development)
if (typeof Bun !== 'undefined') {
  const port = 3000;
  console.log(`Hono server started locally on port ${port}`);
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
