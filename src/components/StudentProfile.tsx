import React from 'react';

export interface StudentProfileProps {
  dev: {
    id: string;
    nombre: string;
    github_username: string;
    avatar_url?: string;
    total_score: number;
    total_contributions: number;
    public_repos?: number;
    current_streak?: number;
    is_admin?: boolean;
    metadata?: {
      generacion?: string;
      numero_control?: string;
      carrera?: string;
      [key: string]: any;
    };
  };
  saved?: boolean;
  badges?: Array<{
    id: string;
    nombre: string;
    icon_url: string;
    descripcion?: string;
  }>;
}

const GENERATION_OPTIONS = [
  '2027',
  '2026',
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
  '2019',
  '2018',
];

export const StudentProfile: React.FC<StudentProfileProps> = ({ dev, saved, badges = [] }) => {
  const currentGen = dev.metadata?.generacion || '';
  const currentNumControl = dev.metadata?.numero_control || '';
  const currentCarrera = dev.metadata?.carrera || 'Ingeniería en Sistemas Computacionales';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Success Notification */}
      {saved && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-950/30 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-sm font-bold text-white">¡Cambios guardados con éxito!</p>
              <p className="text-xs text-emerald-400/90">
                Tu información académica y generación se han actualizado. Ya se reflejan en el ranking y en los reportes semestrales del docente.
              </p>
            </div>
          </div>
          <a
            href="/"
            className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Ver en Ranking →
          </a>
        </div>
      )}

      {/* Main Student Card Header */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-850 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
          {/* Avatar */}
          <div className="relative">
            {dev.avatar_url ? (
              <img
                src={dev.avatar_url}
                alt={dev.nombre}
                className="w-24 h-24 md:w-28 md:h-28 rounded-2xl border-2 border-emerald-500/40 shadow-xl object-cover"
              />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl border-2 border-slate-700 bg-slate-800 flex items-center justify-center font-black text-3xl text-emerald-400">
                {dev.nombre.charAt(0)}
              </div>
            )}
            <div
              className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1 rounded-lg shadow-md"
              title="Cuenta de GitHub Verificada"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          </div>

          {/* Identity & Status */}
          <div className="flex-1 text-center md:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h2 className="text-2xl font-black text-white">{dev.nombre}</h2>
              {dev.is_admin && (
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Docente / Admin
                </span>
              )}
              {currentGen && (
                <span className="text-[11px] font-mono font-bold bg-cyan-950/50 text-cyan-400 border border-cyan-800/40 px-2 py-0.5 rounded-full">
                  🎓 Gen {currentGen}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs">
              <a
                href={`https://github.com/${dev.github_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-emerald-400 font-mono inline-flex items-center gap-1.5 transition-colors group"
                title="Abrir perfil oficial de GitHub"
              >
                <svg className="w-4 h-4 opacity-70 group-hover:opacity-100 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>@{dev.github_username}</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700">Verificado</span>
              </a>

              {currentNumControl && (
                <span className="text-slate-400 font-mono">
                  Control: <strong className="text-slate-200">{currentNumControl}</strong>
                </span>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="pt-3 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-mono">
              <div className="bg-slate-950/60 border border-slate-850 px-3 py-1.5 rounded-xl">
                <span className="text-slate-400">Puntos: </span>
                <span className="text-emerald-400 font-bold">{dev.total_score.toLocaleString()}</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-850 px-3 py-1.5 rounded-xl">
                <span className="text-slate-400">Contribuciones: </span>
                <span className="text-white font-bold">{dev.total_contributions.toLocaleString()}</span>
              </div>
              <div className="bg-slate-950/60 border border-slate-850 px-3 py-1.5 rounded-xl">
                <span className="text-slate-400">Racha: </span>
                <span className="text-amber-400 font-bold">🔥 {dev.current_streak || 0} días</span>
              </div>
            </div>
          </div>

          {/* Secondary Actions */}
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <a
              href="/auth/sync-profile"
              className="text-xs bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-900/40 hover:border-emerald-800/50 text-emerald-400 px-4 py-2.5 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 shadow-sm shadow-emerald-950/20"
              title="Sincronizar commits con GitHub"
            >
              <span>🔄</span> Sincronizar GitHub
            </a>
            <a
              href={`/dev/${dev.github_username}`}
              className="text-xs bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-white px-4 py-2 rounded-xl font-semibold transition-all text-center"
            >
              Ver Mi Perfil Público
            </a>
          </div>
        </div>
      </div>

      {/* Edit Form Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl">
            <div className="border-b border-slate-850 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📝</span> Datos de Estudiante
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Completa tu información institucional. Estos datos permiten a tu docente identificarte en las listas de evaluación y agruparte con tus compañeros de semestre.
              </p>
            </div>

            <form method="POST" action="/mi-perfil" className="space-y-5">
              {/* Nombre Completo */}
              <div className="space-y-1.5">
                <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                  Nombre Completo Oficial <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  name="nombre"
                  required
                  defaultValue={dev.nombre}
                  placeholder="Ej. Carlos Mendoza Domínguez"
                  className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                />
                <p className="text-[11px] text-slate-500">
                  Tal como aparece en las actas de calificación institucional del Tecnológico.
                </p>
              </div>

              {/* GitHub Handle (Read-only) */}
              <div className="space-y-1.5">
                <label className="block text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                  <span>Usuario de GitHub (Vinculado)</span>
                  <span className="text-[10px] text-emerald-400 font-mono lowercase">protegido por oauth</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={`@${dev.github_username}`}
                    className="w-full text-sm bg-slate-950/50 border border-slate-850 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed font-mono"
                  />
                  <div className="absolute right-3.5 top-3.5 text-slate-500">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Este usuario proviene directamente de tu sesión de GitHub y garantiza la autenticidad de tus aportaciones.
                </p>
              </div>

              {/* Two columns: Generación + No. Control */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Generación (Año de Ingreso) */}
                <div className="space-y-1.5">
                  <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                    Generación (Año de Ingreso) <span className="text-emerald-400">*</span>
                  </label>
                  <select
                    name="generacion"
                    defaultValue={currentGen}
                    className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium cursor-pointer"
                  >
                    <option value="">Selecciona tu Generación...</option>
                    {GENERATION_OPTIONS.map((year) => (
                      <option key={year} value={year}>
                        Generación {year} (Ingreso {year})
                      </option>
                    ))}
                    {currentGen && !GENERATION_OPTIONS.includes(currentGen) && (
                      <option value={currentGen}>Generación {currentGen}</option>
                    )}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Año en el que ingresaste al Instituto Tecnológico.
                  </p>
                </div>

                {/* Número de Control */}
                <div className="space-y-1.5">
                  <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                    Número de Control (Matrícula)
                  </label>
                  <input
                    type="text"
                    name="numero_control"
                    defaultValue={currentNumControl}
                    placeholder="Ej. 22080045"
                    className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-mono font-medium"
                  />
                  <p className="text-[11px] text-slate-500">
                    Facilita al docente registrar tus puntos en el sistema escolar.
                  </p>
                </div>
              </div>

              {/* Carrera */}
              <div className="space-y-1.5">
                <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                  Carrera o Especialidad
                </label>
                <input
                  type="text"
                  name="carrera"
                  defaultValue={currentCarrera}
                  placeholder="Ej. Ingeniería en Sistemas Computacionales"
                  className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-slate-500">
                  Los cambios se aplican de inmediato en todas las vistas públicas.
                </span>
                <button
                  type="submit"
                  className="w-full sm:w-auto text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-8 py-3 rounded-xl transition-all shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-2"
                >
                  <span>💾</span> Guardar Información
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Info & FAQ */}
        <div className="space-y-6">
          {/* Security & Validation Note */}
          <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
              <span>🔒</span> Validación de Sesión con Git
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tu cuenta está directamente autenticada mediante el protocolo OAuth 2.0 de GitHub y tokens criptográficos emitidos por Supabase Auth.
            </p>
            <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
              <li>Nadie más puede editar tus datos ni fingir ser tú.</li>
              <li>Tus aportaciones provienen de la API oficial de GitHub.</li>
              <li>Puedes sincronizar tus commits en cualquier momento.</li>
            </ul>
          </div>

          {/* Academic Evaluation Explanatory Card */}
          <div className="bg-gradient-to-br from-slate-900/60 to-cyan-950/20 border border-slate-850 rounded-3xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 text-sm font-bold">
              <span>🎓</span> Para qué sirve tu Generación
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              En Repo Rivals, los docentes organizan los rankings por semestre (Agosto - Enero y Febrero - Julio) y filtran por <strong className="text-slate-200">Generación</strong> para evaluar a cada grupo de forma equitativa.
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Al indicar tu año de ingreso y número de control, te aseguras de que tus aportaciones cuenten en la rúbrica de tu materia.
            </p>
            <div className="pt-2">
              <a
                href="/periodos"
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold inline-flex items-center gap-1 hover:underline"
              >
                Explorar periodos escolares →
              </a>
            </div>
          </div>

          {/* Badges Preview */}
          {badges.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 space-y-3">
              <div className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                <span>Tus Insignias ({badges.length})</span>
                <a href="/#insignias" className="text-emerald-400 hover:underline">Ver todas</a>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {badges.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-300"
                    title={b.descripcion || b.nombre}
                  >
                    <span>{b.icon_url || '🏅'}</span>
                    <span>{b.nombre}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
