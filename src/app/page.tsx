"use client";

import React from "react";
import { HeatmapComparator, StudentWithStats } from "@/components/HeatmapComparator";
import { BadgeShowcase, Badge, StudentBadge } from "@/components/BadgeShowcase";

// 1. Generate realistic mock daily contribution stats over 120 days
const generateMockStats = (seed: number) => {
  const stats = [];
  const today = new Date();
  for (let i = 119; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    // Pseudo-random statistics based on index and seed
    const activeFactor = Math.sin((i + seed) * 0.1) + 1; // 0 to 2
    const commits = Math.random() > 0.4 ? Math.floor(Math.random() * 4 * activeFactor) : 0;
    const pull_requests = Math.random() > 0.85 ? 1 : 0;
    const issues = Math.random() > 0.9 ? 1 : 0;
    const stars_received = Math.random() > 0.95 ? Math.floor(Math.random() * 3) : 0;

    stats.push({
      fecha: dateStr,
      commits,
      pull_requests,
      issues,
      stars_received,
    });
  }
  return stats;
};

// Mock Students data
const studentA: StudentWithStats = {
  student: {
    id: "student-1",
    nombre: "Carlos Mendoza",
    github_username: "carlosmdev",
    avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
    total_score: 1250,
  },
  stats: generateMockStats(4),
};

const studentB: StudentWithStats = {
  student: {
    id: "student-2",
    nombre: "Sofía Rojas",
    github_username: "sofiarojas",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
    total_score: 1480,
  },
  stats: generateMockStats(9),
};

// Mock Badges definition
const allBadges: Badge[] = [
  {
    id: "badge-1",
    nombre: "Hola Mundo",
    descripcion: "Otorgado al realizar tu primera aportación al ranking.",
    icon_url: "🚀",
    criterio_desbloqueo: "primer_commit",
  },
  {
    id: "badge-2",
    nombre: "Ave Nocturna",
    descripcion: "Realizaste un commit o PR después de la medianoche (12:00 AM - 4:00 AM).",
    icon_url: "🦉",
    criterio_desbloqueo: "ave_nocturna",
  },
  {
    id: "badge-3",
    nombre: "Constancia Brutal",
    descripcion: "Mantén una racha de aportaciones durante 3 días seguidos.",
    icon_url: "🔥",
    criterio_desbloqueo: "racha_3_dias",
  },
  {
    id: "badge-4",
    nombre: "Colaborador Activo",
    descripcion: "Registra al menos 10 Pull Requests en la plataforma.",
    icon_url: "🤝",
    criterio_desbloqueo: "pull_requests_10",
  },
  {
    id: "badge-5",
    nombre: "Cazador de Bugs",
    descripcion: "Resuelve y cierra 5 issues reportados.",
    icon_url: "🐛",
    criterio_desbloqueo: "issues_resolved_5",
  },
];

// Mock earned badges
const studentABadges: StudentBadge[] = [
  { id: "sb-1", student_id: "student-1", badge_id: "badge-1", otorgado_en: "2026-05-15T10:00:00Z" },
  { id: "sb-2", student_id: "student-1", badge_id: "badge-3", otorgado_en: "2026-06-02T18:30:00Z" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎓</span>
          <div>
            <h1 className="text-lg font-black tracking-wider text-white">REPO RIVALS</h1>
            <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
              Ingeniería en Sistemas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-full font-mono">
            Demo Sandbox Active
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        
        {/* Intro Banner */}
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

        {/* 1. Heatmap Comparator Duelo Section */}
        <section className="space-y-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-white tracking-wide">🔥 Duelo Amistoso de Actividad</h3>
            <p className="text-xs text-slate-400">Compara el historial de aportaciones entre Carlos y Sofía</p>
          </div>
          <HeatmapComparator studentA={studentA} studentB={studentB} daysToDisplay={120} />
        </section>

        {/* 2. Badge Showcase Showcase Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-white tracking-wide">🎖️ Insignias de Carlos Mendoza</h3>
              <p className="text-xs text-slate-400">Insignias obtenidas e hitos restantes por desbloquear</p>
            </div>
            <BadgeShowcase 
              allBadges={allBadges} 
              studentBadges={studentABadges} 
              studentName="Carlos Mendoza" 
            />
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-white tracking-wide">🎓 Información del Proyecto</h3>
              <p className="text-xs text-slate-400">Detalles de despliegue y arquitectura gamificada</p>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-900 space-y-4 h-full flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="bg-slate-950 w-8 h-8 rounded-lg flex items-center justify-center text-sm border border-slate-850">⚡</span>
                  <p className="text-xs text-slate-300">
                    <strong className="text-white block">Next.js App Router</strong>
                    Estructura de enrutamiento y renderizado veloz híbrido (Server/Client).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-slate-950 w-8 h-8 rounded-lg flex items-center justify-center text-sm border border-slate-850">🔒</span>
                  <p className="text-xs text-slate-300">
                    <strong className="text-white block">Supabase + RLS</strong>
                    Seguridad integrada de Postgres Row Level Security para resguardar las aportaciones.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-slate-950 w-8 h-8 rounded-lg flex items-center justify-center text-sm border border-slate-850">☁️</span>
                  <p className="text-xs text-slate-300">
                    <strong className="text-white block">GitHub Actions</strong>
                    CI/CD configurado para despliegue instantáneo de Edge Functions y Frontend.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-900 pt-4 text-center">
                <p className="text-[11px] text-slate-500">
                  Ejecuta <code className="bg-slate-950 text-emerald-400 px-1.5 py-0.5 rounded border border-slate-850">npm run dev</code> para iniciar tu servidor de pruebas en local.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-6 mt-12 text-center text-xs text-slate-600">
        <p>© 2026 Repo Rivals. Hecho con ❤️ para Ingeniería en Sistemas.</p>
      </footer>
    </div>
  );
}

