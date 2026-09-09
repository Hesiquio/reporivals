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
      rol?: 'estudiante' | 'docente' | string;
      generacion?: string;
      numero_control?: string;
      carrera?: string;
      departamento?: string;
      cargo?: string;
      clave_docente?: string;
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

const CAREER_OPTIONS = [
  { value: 'ISC', label: 'ISC - Ingeniería en Sistemas Computacionales' },
  { value: 'IIAR', label: 'IIAR - Ingeniería en Inteligencia Artificial' },
];

const DOCENTE_CAREER_OPTIONS = [
  { value: 'ISC', label: 'ISC - Ingeniería en Sistemas Computacionales' },
  { value: 'IIAR', label: 'IIAR - Ingeniería en Inteligencia Artificial' },
  { value: 'Ambas (ISC e IIAR)', label: 'Ambas Carreras (ISC e IIAR)' },
  { value: 'Tronco Común / Ciencias Básicas', label: 'Tronco Común / Ciencias Básicas' },
];

const DEPARTMENT_OPTIONS = [
  'Departamento de Sistemas y Computación',
  'Departamento de Ciencias Básicas',
  'División de Estudios Profesionales',
  'División de Estudios de Posgrado e Investigación',
  'Departamento de Ingeniería Eléctrica y Electrónica',
  'Departamento de Ingeniería Industrial',
  'Dirección / Subdirección Académica',
  'Otro Departamento Académico',
];

const DOCENTE_CARGO_OPTIONS = [
  'Profesor de Asignatura',
  'Profesor de Tiempo Completo (PTC)',
  'Jefe de Departamento Académico',
  'Coordinador de Carrera',
  'Presidente de Academia',
  'Investigador / Catedrático',
  'Docente / Asesor de Proyectos',
];

export const StudentProfile: React.FC<StudentProfileProps> = ({ dev, saved, badges = [] }) => {
  const isDocente = Boolean(dev.is_admin || dev.metadata?.rol === 'docente');
  const currentGen = dev.metadata?.generacion || '';
  const currentNumControl = dev.metadata?.numero_control || '';
  const rawCarrera = (dev.metadata?.carrera || '').trim();
  const currentCarrera = isDocente
    ? (rawCarrera || 'ISC')
    : (rawCarrera.toUpperCase().includes('IIAR') || rawCarrera.toUpperCase().includes('ARTIFICIAL') ? 'IIAR' : 'ISC');
  const currentDepto = dev.metadata?.departamento || (isDocente ? 'Departamento de Sistemas y Computación' : '');
  const currentCargo = dev.metadata?.cargo || (isDocente ? 'Profesor de Asignatura' : '');
  const currentClaveDocente = dev.metadata?.clave_docente || '';

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
                {isDocente
                  ? 'Tu perfil institucional de docente y adscripción académica han sido actualizados satisfactoriamente.'
                  : 'Tu información académica y generación se han actualizado. Ya se reflejan en el ranking y en los reportes semestrales del docente.'}
              </p>
            </div>
          </div>
          <a
            href={isDocente ? "/periodos" : "/"}
            className="text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            {isDocente ? "Ver Concentrado Semestral →" : "Ver en Ranking →"}
          </a>
        </div>
      )}

      {/* Main Profile Card Header */}
      <div className="bg-slate-900/50 backdrop-blur-md border border-slate-850 p-6 md:p-8 rounded-3xl relative overflow-hidden shadow-2xl">
        <div className={`absolute top-0 right-0 w-80 h-80 ${isDocente ? 'bg-amber-500/5' : 'bg-emerald-500/5'} rounded-full blur-3xl pointer-events-none`}></div>

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
          {/* Avatar */}
          <div className="relative">
            {dev.avatar_url ? (
              <img
                src={dev.avatar_url}
                alt={dev.nombre}
                className={`w-24 h-24 md:w-28 md:h-28 rounded-2xl border-2 ${isDocente ? 'border-amber-500/40' : 'border-emerald-500/40'} shadow-xl object-cover`}
              />
            ) : (
              <div className={`w-24 h-24 md:w-28 md:h-28 rounded-2xl border-2 border-slate-700 bg-slate-800 flex items-center justify-center font-black text-3xl ${isDocente ? 'text-amber-400' : 'text-emerald-400'}`}>
                {dev.nombre.charAt(0)}
              </div>
            )}
            <div
              className={`absolute -bottom-1 -right-1 ${isDocente ? 'bg-amber-500' : 'bg-emerald-500'} text-slate-950 p-1 rounded-lg shadow-md`}
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
              {isDocente ? (
                <span className="text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <span>👨‍🏫</span> Docente / Evaluador
                </span>
              ) : (
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  🎓 Estudiante
                </span>
              )}
              {!isDocente && currentGen && (
                <span className="text-[11px] font-mono font-bold bg-cyan-950/50 text-cyan-400 border border-cyan-800/40 px-2 py-0.5 rounded-full">
                  🎓 Gen {currentGen}
                </span>
              )}
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                currentCarrera === 'IIAR'
                  ? 'bg-purple-950/50 text-purple-400 border-purple-800/40'
                  : 'bg-emerald-950/50 text-emerald-400 border-emerald-800/40'
              }`}>
                💻 {currentCarrera}
              </span>
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

              {isDocente ? (
                <>
                  {currentDepto && (
                    <span className="text-slate-400 text-xs">
                      🏛️ <strong className="text-slate-200">{currentDepto}</strong>
                    </span>
                  )}
                  {currentCargo && (
                    <span className="text-slate-400 text-xs">
                      💼 <strong className="text-slate-200">{currentCargo}</strong>
                    </span>
                  )}
                </>
              ) : (
                currentNumControl && (
                  <span className="text-slate-400 font-mono">
                    Control: <strong className="text-slate-200">{currentNumControl}</strong>
                  </span>
                )
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
            {isDocente && (
              <a
                href="/periodos"
                className="text-xs bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 px-4 py-2.5 rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 shadow-sm"
                title="Ir al Concentrado Semestral de Calificaciones"
              >
                <span>📅</span> Concentrado Semestral
              </a>
            )}
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
                <span>{isDocente ? '👨‍🏫' : '📝'}</span>{' '}
                {isDocente ? 'Datos del Docente / Catedrático' : 'Datos de Estudiante'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isDocente
                  ? 'Información institucional como docente del Tecnológico. Estos datos te identifican como profesor o evaluador de la materia y te diferencian de las listas de alumnos a calificar.'
                  : 'Completa tu información institucional. Estos datos permiten a tu docente identificarte en las listas de evaluación y agruparte con tus compañeros de semestre.'}
              </p>
            </div>

            <form method="POST" action="/mi-perfil" className="space-y-5">
              <input type="hidden" name="rol" value={isDocente ? 'docente' : 'estudiante'} />

              {/* Nombre Completo Oficial with Auto-Capitalization & Formatting Actions */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label htmlFor="nombreInput" className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                    Nombre Completo Oficial <span className="text-emerald-400">*</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      id="btnCapitalize"
                      className="text-[11px] font-semibold bg-slate-800 hover:bg-slate-750 text-emerald-400 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors shadow-sm cursor-pointer"
                      title="Formatear automáticamente en Nombre Propio (Ej. Carlos Mendoza Domínguez)"
                    >
                      Aa Capitalizar
                    </button>
                    <button
                      type="button"
                      id="btnUppercase"
                      className="text-[11px] font-semibold bg-slate-800 hover:bg-slate-750 text-cyan-400 px-2.5 py-1 rounded-lg border border-slate-700 transition-colors shadow-sm cursor-pointer"
                      title="Convertir a MAYÚSCULAS COMPLETAS (Ej. CARLOS MENDOZA DOMÍNGUEZ)"
                    >
                      AA MAYÚSCULAS
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  id="nombreInput"
                  name="nombre"
                  required
                  defaultValue={dev.nombre}
                  placeholder={isDocente ? "Ej. Hesiquio Zárate Olvera" : "Ej. Carlos Mendoza Domínguez"}
                  className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-1">
                  <span>Tal como aparece en las actas de calificación institucional del Tecnológico.</span>
                  <span className="text-emerald-400/90 font-medium">✨ Se auto-capitaliza al salir del campo</span>
                </div>
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

              {/* Conditional Fields: Docente vs Estudiante */}
              {isDocente ? (
                <>
                  {/* Two columns: Departamento + Cargo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Departamento Académico */}
                    <div className="space-y-1.5">
                      <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                        Departamento Académico <span className="text-amber-400">*</span>
                      </label>
                      <select
                        name="departamento"
                        defaultValue={currentDepto}
                        className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium cursor-pointer"
                      >
                        {DEPARTMENT_OPTIONS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                        {currentDepto && !DEPARTMENT_OPTIONS.includes(currentDepto) && (
                          <option value={currentDepto}>{currentDepto}</option>
                        )}
                      </select>
                      <p className="text-[11px] text-slate-500">
                        Departamento al que estás adscrito en el Instituto Tecnológico.
                      </p>
                    </div>

                    {/* Cargo o Nombramiento */}
                    <div className="space-y-1.5">
                      <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                        Cargo o Nombramiento <span className="text-amber-400">*</span>
                      </label>
                      <select
                        name="cargo"
                        defaultValue={currentCargo}
                        className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium cursor-pointer"
                      >
                        {DOCENTE_CARGO_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        {currentCargo && !DOCENTE_CARGO_OPTIONS.includes(currentCargo) && (
                          <option value={currentCargo}>{currentCargo}</option>
                        )}
                      </select>
                      <p className="text-[11px] text-slate-500">
                        Tu rol dentro de la plantilla académica del Tecnológico.
                      </p>
                    </div>
                  </div>

                  {/* Two columns: Carrera que Imparte + Clave Docente */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Carrera que Imparte */}
                    <div className="space-y-1.5">
                      <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                        Carrera(s) que Imparte / Coordina <span className="text-amber-400">*</span>
                      </label>
                      <select
                        name="carrera"
                        defaultValue={currentCarrera}
                        className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-medium cursor-pointer"
                      >
                        {DOCENTE_CAREER_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-slate-500">
                        Programas de estudio en los que impartes materias o proyectos.
                      </p>
                    </div>

                    {/* Clave Docente o RFC */}
                    <div className="space-y-1.5">
                      <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                        Clave Docente / RFC (Opcional)
                      </label>
                      <input
                        type="text"
                        name="clave_docente"
                        defaultValue={currentClaveDocente}
                        placeholder="Ej. ZAOH850212 o No. Empleado"
                        className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all font-mono font-medium"
                      />
                      <p className="text-[11px] text-slate-500">
                        Dato interno para membretes o exportación de actas docentes.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                        required
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

                  {/* Carrera Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-xs uppercase font-bold text-slate-300 tracking-wider">
                      Carrera <span className="text-emerald-400">*</span>
                    </label>
                    <select
                      name="carrera"
                      defaultValue={currentCarrera}
                      className="w-full text-sm bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium cursor-pointer"
                    >
                      {CAREER_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Selecciona tu programa educativo oficial (ISC o IIAR) para evitar errores de captura en las evaluaciones docentes.
                    </p>
                  </div>
                </>
              )}

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-850 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-xs text-slate-500">
                  Los cambios se aplican de inmediato en todas las vistas públicas.
                </span>
                <button
                  type="submit"
                  className={`w-full sm:w-auto text-sm ${
                    isDocente
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/15'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/15'
                  } font-extrabold px-8 py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer`}
                >
                  <span>💾</span> {isDocente ? 'Guardar Datos de Docente' : 'Guardar Información'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Info & FAQ */}
        <div className="space-y-6">
          {isDocente ? (
            /* Teacher Portal Card */
            <div className="bg-gradient-to-br from-slate-900/80 to-amber-950/20 border border-amber-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold">
                <span>👨‍🏫</span> Panel de Gestión Docente
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Como docente de Repo Rivals, tu perfil está diferenciado del alumnado:
              </p>
              <ul className="text-xs text-slate-400 space-y-2.5 list-disc list-inside">
                <li>
                  <strong className="text-slate-200">No alteras el ranking estudiantil:</strong> Tus contribuciones se destacan con insignia docente y no desplazan el lugar de tus alumnos.
                </li>
                <li>
                  <strong className="text-slate-200">Reportes limpios:</strong> En el concentrado semestral tus métricas no alteran los promedios ni la tasa de aprobación de las materias.
                </li>
                <li>
                  <strong className="text-slate-200">Copiar para Actas:</strong> Puedes exportar el concentrado del semestre directamente a Excel con un clic.
                </li>
              </ul>
              <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
                <a
                  href="/periodos"
                  className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold px-3 py-2 rounded-xl border border-amber-500/40 text-center transition-all flex items-center justify-center gap-1.5"
                >
                  <span>📋</span> Concentrado de Calificaciones →
                </a>
                <a
                  href="/"
                  className="text-xs bg-slate-950 hover:bg-slate-900 text-slate-300 hover:text-white font-medium px-3 py-2 rounded-xl border border-slate-800 text-center transition-all"
                >
                  Ver Ranking Global de Estudiantes
                </a>
              </div>
            </div>
          ) : (
            /* Academic Evaluation Explanatory Card for Students */
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
          )}

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

          {/* Badges Preview */}
          {badges.length > 0 && (
            <div className="bg-slate-900/40 border border-slate-850 rounded-3xl p-6 space-y-3">
              <div className="text-xs uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
                <span>Insignias Obtenidas ({badges.length})</span>
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

      {/* Client-side script for Auto-Capitalization and Case formatting */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const input = document.getElementById('nombreInput');
              const btnCap = document.getElementById('btnCapitalize');
              const btnUpper = document.getElementById('btnUppercase');
              const particles = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'san']);

              function toTitleCase(str) {
                const trimmed = str.trim().replace(/\\s+/g, ' ');
                if (!trimmed) return '';
                return trimmed.split(' ').map(function(word, index) {
                  const lower = word.toLowerCase();
                  if (index > 0 && particles.has(lower)) {
                    return lower;
                  }
                  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                }).join(' ');
              }

              function toUpper(str) {
                return str.trim().replace(/\\s+/g, ' ').toUpperCase();
              }

              if (input) {
                // Auto-capitalize on blur if user typed in lowercase
                input.addEventListener('blur', function() {
                  const val = input.value.trim();
                  if (val && val === val.toLowerCase()) {
                    input.value = toTitleCase(val);
                  }
                });

                if (btnCap) {
                  btnCap.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (input.value) {
                      input.value = toTitleCase(input.value);
                      input.focus();
                    }
                  });
                }

                if (btnUpper) {
                  btnUpper.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (input.value) {
                      input.value = toUpper(input.value);
                      input.focus();
                    }
                  });
                }
              }
            })();
          `,
        }}
      />
    </div>
  );
};
