# 📘 Memoria Técnica y Documento de Contexto Integral: Repo Rivals

> **Documento de Respaldo y Continuidad del Proyecto**  
> **Fecha de creación:** Septiembre 2026  
> **Repositorio Oficial:** [`https://github.com/Hesiquio/reporivals`](https://github.com/Hesiquio/reporivals)  
> **Autor y Administrador:** Hesiquio Zárate Olvera (`@hesiquiozarate`)  
> **Propósito de este documento:** Preservar la totalidad de decisiones técnicas, arquitectura, historial de requerimientos, modelo de datos y procedimientos de restauración para continuar el desarrollo sin pérdida de información tras formatear o reinstalar el sistema operativo.

---

## 📑 Índice de Contenidos

1. [Visión General del Proyecto](#1-visión-general-del-proyecto)
2. [Historial y Bitácora Cronológica de la Charla / Desarrollo](#2-historial-y-bitácora-cronológica-de-la-charla--desarrollo)
3. [Arquitectura y Stack Tecnológico](#3-arquitectura-y-stack-tecnológico)
4. [Esquema de Base de Datos y Modelo de Datos](#4-esquema-de-base-de-datos-y-modelo-de-datos)
5. [Rutas y Endpoints del Sistema](#5-rutas-y-endpoints-del-sistema)
6. [Guía Paso a Paso para Restaurar el Proyecto en un Sistema Operativo Limpio](#6-guía-paso-a-paso-para-restaurar-el-proyecto-en-un-sistema-operativo-limpio)
7. [Credenciales, Variables de Entorno y Configuración de Git](#7-credenciales-variables-de-entorno-y-configuración-de-git)

---

## 1. Visión General del Proyecto

**Repo Rivals** es una plataforma web full-stack de alto rendimiento construida con **Bun**, **Hono** y **Supabase (PostgreSQL)**, diseñada para docentes y estudiantes de educación superior en ingeniería (específicamente en el **Instituto Tecnológico**, cubriendo los programas de **Ingeniería en Sistemas Computacionales - ISC** e **Ingeniería en Inteligencia Artificial - IIAR**).

### Propósito y Valor Académico
* **Evaluación Continua Basada en Hechos:** Permite al docente auditar y calificar el trabajo práctico real de los estudiantes mediante la extracción y análisis automatizado de su actividad en **GitHub** (commits, pull requests, issues y lenguajes de programación).
* **Gamificación y Motivación:** Los alumnos compiten en un ranking en tiempo real, acumulan puntos, mantienen rachas de días activos y desbloquean insignias dinámicas.
* **Separación Institucional:** Diferenciación estricta entre estudiantes evaluados y docentes evaluadores, garantizando que los commits del profesor no inflen promedios ni distorsionen las estadísticas de aprobación del grupo.

---

## 2. Historial y Bitácora Cronológica de la Charla / Desarrollo

A continuación se detalla cada requerimiento solicitado por el usuario y la solución exacta que se implementó:

### 1. Documentación Exhaustiva y Módulo "Sobre Nosotros"
* **Petición:** *"puedes actualizar el readme del proyecto con toooooodo lo que le pueda faltar? el modulo de sobre nosotros siento que deberia ser actualizado no?"*
* **Implementación:**
  * Se redactó un `README.md` exhaustivo con arquitectura, esquemas SQL, sistema de puntuación, flujo docente y guías de despliegue.
  * Se renovó la vista `/sobre-nosotros` reflejando el enfoque del Instituto Tecnológico para ISC e IIAR.

### 2. Enlaces Directos a Perfiles de GitHub
* **Petición:** *"en cualquiera de las listas sale el @usuario pero no te linkea a github, se puede?"*
* **Implementación:**
  * Se actualizaron todos los componentes (`Leaderboard.tsx`, `PeriodLeaderboard.tsx`, `StudentProfile.tsx`, `src/index.tsx`) para que cada mención de `@usuario` sea un enlace directo y clicable hacia `https://github.com/:username` con icono de apertura externa y target seguro (`rel="noopener noreferrer"`).

### 3. Módulo de Periodos Escolares Semestrales (`/periodos`)
* **Petición:** Necesidad de evaluar a los alumnos por semestre académico oficial en lugar de solo por el acumulado histórico de años.
* **Implementación:**
  * Se creó la utilidad `src/utils/periods.ts` con soporte para los semestres escolares oficiales:
    * **Agosto – Enero** (Semestre de otoño/invierno)
    * **Febrero – Julio** (Semestre de primavera/verano)
  * Detección automática del periodo activo y selector interactivo de semestres históricos.
  * Reporte semestral con métricas de alumnos con actividad, tasa de participación del grupo y promedio de aportaciones.
  * Botón *"📋 Copiar Concentrado (Docente)"* que exporta los datos directamente tabulados para pegar en Excel o Google Sheets.

### 4. Agrupación por Generación Escolar (Sin Alterar Tablas de BD)
* **Petición:** *"como podriamos agrupar por grupos valga la redundancia? tendriamos que cambiar la bd? realmente se agruparian por generación, por tanto el año de ingreso al tecnologico seria la data importante..."*
* **Implementación:**
  * Se aprovechó la columna nativa `metadata` (`JSONB`) de la tabla `devs` en Supabase para almacenar la generación escolar (`2018` a `2027`) y número de control sin necesidad de alterar el esquema ni ejecutar migraciones destructivas.
  * Se agregó el selector de generación en el filtro del ranking global y de periodos.

### 5. Panel de Perfil de Usuario (`/mi-perfil`) y Validación Git
* **Petición:** *"que te parece si les hacemos un panel de perfil, donde los estudiantes puedan tener para cambiar sus datos? es dificil validar la sesión con git?"*
* **Implementación:**
  * Se creó el componente `StudentProfile.tsx` y las rutas `GET /mi-perfil` y `POST /mi-perfil`.
  * Validación segura con Git mediante OAuth 2.0 de GitHub y tokens de Supabase Auth almacenados en cookies HTTP. Si no hay sesión activa, se redirige a `/auth/login`.
  * El usuario de GitHub queda sellado e inmutable, garantizando que ningún alumno suplante la identidad de otro.

### 6. Restricción Estricta de Carreras a ISC e IIAR
* **Petición:** *"Los usuarios son capaces de poner cientos de veces mal un dato, asi que agrega tu en un desplegado de opciones las carreras ISC e IIAR"*
* **Implementación:**
  * Se eliminó el campo de texto libre y se reemplazó por un `<select>` obligatorio con:
    * `ISC` — Ingeniería en Sistemas Computacionales
    * `IIAR` — Ingeniería en Inteligencia Artificial
  * Se aplicó en el perfil del alumno, en el formulario de pre-registro de administradores y en la sanitización del backend.

### 7. Auto-Capitalización y Mayúsculas en Nombre Completo Oficial
* **Petición:** *"el Nombre Completo Oficial debe ir capitalizado o de plano en mayusculas, me ayudas con eso? digo, nunca falta el que lo pone en minusculas...."*
* **Implementación:**
  * **Frontend:**
    * Auto-capitalización automática al salir del campo (`blur`) si se ingresó en minúsculas.
    * Botón **`[Aa Capitalizar]`**: Formatea a tipo título con inicial mayúscula respetando partículas como `de`, `del`, `la`, `san`.
    * Botón **`[AA MAYÚSCULAS]`**: Convierte el texto completo a mayúsculas institucionales (estándar de actas de examen).
  * **Backend:** Función `formatOfficialName(raw: string)` en `src/index.tsx` que garantiza el formato correcto antes de guardar en la base de datos.

### 8. Diferenciación Integral de Docentes vs. Estudiantes
* **Petición:** *"...tambien debemos hacer la diferenciación con docentes, en mi caso no deberia llenar como estudiante o si? generacion y lo demas no seria lo q se le deberia pedir a un docente, como hacemos esa diferenciación?"*
* **Implementación:**
  * **Perfil Adaptativo:** Si el dev es admin o tiene `rol: "docente"`, `/mi-perfil` muestra **Datos del Docente / Catedrático** (Departamento Académico, Cargo o Nombramiento, Carreras que Imparte, Clave Docente/RFC), omitiendo Generación y No. de Control.
  * **Insignia en Ranking:** Distintivo destacado `👨‍🏫 Docente` en lugar de `🎓 Gen YYYY`.
  * **Métricas Académicas Protegidas:** En `/periodos`, los commits del profesor se excluyen del cálculo de la tasa de participación y del promedio grupal, evitando alterar las notas de los alumnos.
  * **Podio Respetado:** Los alumnos conservan sus puestos ordinales 1, 2 y 3 (🥇, 🥈, 🥉) sin que el docente les reste posiciones.

### 9. Asignación y Cambio de Rol por el Administrador con 1 Clic
* **Petición:** *"aja pero como sabe el sistema quienes son docentes? se lo puedo asignar yo como admin de la plataforma?"*
* **Implementación:**
  * Se agregó la ruta `GET /admin/toggle-role/:id?role=docente|estudiante`.
  * En la tabla del Ranking Global, en la columna de **Acciones Admin**, aparece el botón:
    * **`👨‍🏫`** (*Asignar Rol Docente*) para convertir a un alumno en docente.
    * **`🎓`** (*Cambiar a Rol Estudiante*) para revertir a un docente a alumno.
  * En el panel de pre-registro administrativo superior se agregó el selector de **Rol (`🎓 Estudiante` / `👨‍🏫 Docente`)**.

---

## 3. Arquitectura y Stack Tecnológico

```
┌────────────────────────────────────────────────────────┐
│                   Cliente Web (Navegador)             │
│   Tailwind CSS (Dark Mode) • Vanilla JS • HTML SSR     │
└───────────────────────────▲────────────────────────────┘
                            │ HTTP / Cookies
┌───────────────────────────▼────────────────────────────┐
│                    Servidor Bun + Hono                 │
│   src/index.tsx • Hono JSX SSR • OAuth Middleware      │
│   Cálculo de Periodos Semestrales (src/utils/periods) │
└─────────────▲──────────────────────────────▲───────────┘
              │                              │
              │ GraphQL API v4               │ REST / SDK
┌─────────────▼──────────────┐ ┌─────────────▼───────────┐
│         GitHub API         │ │         Supabase        │
│  - Calendario contribución │ │  - Auth (OAuth GitHub)  │
│  - Commits, PRs, Issues    │ │  - Postgres Database    │
│  - Detección de lenguajes  │ │  - JSONB Metadata       │
└────────────────────────────┘ └─────────────────────────┘
```

| Capa | Herramienta | Versión | Rol |
|---|---|---|---|
| **Runtime** | Bun | latest | Ejecución de TypeScript y servidor HTTP de alto rendimiento. |
| **Framework Web** | Hono | `^4.4.2` | Ruteo rápido, middlewares y Server-Side Rendering con JSX. |
| **Base de Datos** | Supabase | `@supabase/supabase-js ^2.43.4` | PostgreSQL administrado con soporte JSONB. |
| **Estilos** | Tailwind CSS | v3 (CDN) | Paleta oscura (slate/emerald/amber/cyan). |
| **Integración Git** | GitHub GraphQL API | v4 | Consulta masiva de métricas y aportaciones. |

---

## 4. Esquema de Base de Datos y Modelo de Datos

### Tabla Principal: `devs`
Almacena el registro de cada desarrollador (estudiante o docente):

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Identificador único del dev en Repo Rivals. |
| `auth_id` | `uuid` (FK) | Vinculación con `auth.users` de Supabase cuando inicia sesión. |
| `nombre` | `text` | Nombre Completo Oficial (capitalizado o mayúsculas). |
| `github_username`| `text` (Unique)| Usuario de GitHub (ej. `hesiquiozarate`). |
| `avatar_url` | `text` | Foto de perfil de GitHub. |
| `total_score` | `numeric` | Puntuación global acumulada. |
| `total_contributions` | `integer` | Suma histórica de commits, PRs e issues. |
| `public_repos` | `integer` | Conteo de repositorios públicos. |
| `current_streak` | `integer` | Racha actual de días continuos con aportaciones. |
| `is_admin` | `boolean` | `true` para administradores con privilegios de gestión. |
| `metadata` | `jsonb` | **Datos flexibles sin alterar esquemas**. |

### Estructura del JSONB `devs.metadata`:

#### Caso 1: Estudiante
```json
{
  "rol": "estudiante",
  "generacion": "2023",
  "numero_control": "22080045",
  "carrera": "ISC"
}
```

#### Caso 2: Docente / Catedrático
```json
{
  "rol": "docente",
  "departamento": "Departamento de Sistemas y Computación",
  "cargo": "Profesor de Asignatura",
  "carrera": "ISC",
  "clave_docente": "ZAOH850212"
}
```

### Tabla de Historial Diario: `github_stats`
| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Identificador del registro diario. |
| `dev_id` | `uuid` (FK) | Referencia a `devs.id`. |
| `fecha` | `date` | Fecha de la aportación (`YYYY-MM-DD`). |
| `stats` | `jsonb` | `{ commits: 4, pull_requests: 1, issues: 0, stars_received: 2 }` |

### Tablas de Gamificación: `badges` y `dev_badges`
* `badges`: Catálogo de insignias (`id`, `nombre`, `descripcion`, `icon_url`, `criterio`).
* `dev_badges`: Relación muchos a muchos de insignias desbloqueadas por cada dev.

---

## 5. Rutas y Endpoints del Sistema

### 🌐 Vistas Públicas y del Usuario
* `GET /` — Ranking Global de Devs, estadísticas del ecosistema y panel de pre-registro (si es admin).
* `GET /periodos` — Concentrado Semestral para Docentes (filtrado por ciclos escolares oficiales, tabla de calificaciones y exportación a Excel).
* `GET /duelo-vs` — Comparador visual cara a cara de 2 estudiantes.
* `GET /sobre-nosotros` — Misión, visión e identidad institucional para Sistemas e IA.
* `GET /dev/:username` — Perfil individual con mapa de calor (anual y semestral) e insignias.

### 👤 Perfil y Sesión
* `GET /auth/login` — Inicia el flujo OAuth de GitHub vía Supabase.
* `GET /auth/callback` — Recibe el token de GitHub, crea o vincula al dev y guarda cookies de sesión.
* `GET /auth/logout` — Destruye las cookies de sesión y redirige al inicio.
* `GET /auth/sync-profile` — Fuerza la sincronización inmediata de commits del usuario con GitHub.
* `GET /mi-perfil` — Formulario de perfil institucional (adapta sus campos según si es Estudiante o Docente).
* `POST /mi-perfil` — Procesa y guarda los datos institucionales sanitizados y capitalizados.

### ⚙️ Rutas de Administración (Requieren `is_admin: true`)
* `POST /admin/add-dev` — Pre-registra un estudiante o docente usando su usuario de GitHub.
* `GET /admin/toggle-role/:id` — Alterna con 1 clic el rol de un usuario entre `docente` y `estudiante`.
* `GET /admin/sync-dev/:id` — Sincroniza individualmente a un dev con la API de GitHub.
* `GET /admin/delete-dev/:id` — Elimina a un dev del sistema.
* `GET /admin/sync-all` — Sincronización masiva de todos los alumnos en segundo plano.

---

## 6. Guía Paso a Paso para Restaurar el Proyecto en un Sistema Operativo Limpio

Sigue estos sencillos pasos una vez que hayas reinstalado tu nuevo sistema operativo:

### Paso 1: Instalar Herramientas Básicas
Abre una terminal y ejecuta:

```bash
# 1. Instalar Git y Curl (en Ubuntu/Debian)
sudo apt update && sudo apt install -y git curl

# 2. Instalar Bun (Runtime oficial de Repo Rivals)
curl -fsSL https://bun.sh/install | bash

# 3. Recargar tu terminal para que reconozca Bun
source ~/.bashrc   # o source ~/.zshrc
```

Verifica la instalación:
```bash
bun --version
git --version
```

### Paso 2: Clonar el Repositorio de GitHub
El repositorio contiene el 100% de los archivos y cambios más recientes:

```bash
# Navega al directorio donde desees guardar el proyecto
mkdir -p ~/dev/var
cd ~/dev/var

# Clona el repositorio
git clone https://github.com/Hesiquio/reporivals.git
cd reporivals
```

### Paso 3: Configurar las Variables de Entorno
Copia la plantilla de variables de entorno:

```bash
cp .env.example .env.local
```

Edita `.env.local` con tu editor preferido (`nano .env.local` o VSCode):
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_de_supabase
GITHUB_PAT=tu_github_personal_access_token
APP_URL=http://localhost:3000
PORT=3000
```

> **¿Dónde obtengo estos valores?**
> * `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`: En tu panel de Supabase en **Project Settings → API**.
> * `GITHUB_PAT`: En GitHub en **Settings → Developer Settings → Personal access tokens (classic)** con permisos `read:user` y `repo`.

### Paso 4: Instalar Dependencias
Dentro de la carpeta `reporivals`:

```bash
bun install
```

### Paso 5: Ejecutar el Proyecto
Para desarrollo local con recarga en caliente (*hot-reload*):

```bash
bun run dev
```

Para producción:
```bash
bun run start
```

Abre tu navegador en: [`http://localhost:3000`](http://localhost:3000).

---

## 7. Credenciales, Variables de Entorno y Configuración de Git

### Configurar tus Credenciales de Git para Hacer Push
Para poder seguir enviando commits a GitHub desde tu nuevo sistema operativo:

```bash
git config --global user.name "Hesiquio Zárate"
git config --global user.email "tu_email_de_github@example.com"
```

Para autenticarte con GitHub sin tener que escribir tu contraseña cada vez, puedes usar tu Personal Access Token (PAT) en la URL remota:

```bash
git remote set-url origin https://Hesiquio:TU_PERSONAL_ACCESS_TOKEN@github.com/Hesiquio/reporivals.git
```

### Tu Cuenta Administradora Principal
* **Usuario:** `hesiquiozarate`
* **Permisos:** En `src/index.tsx`, el sistema reconoce automáticamente a `@hesiquiozarate` con `is_admin = true` y `metadata.rol = 'docente'`. Al iniciar sesión con tu cuenta de GitHub, tendrás acceso inmediato a las funciones de administración y al perfil de profesor.

---

## 8. Resumen de Commits Recientes Pushed a GitHub

| Commit | Mensaje |
|---|---|
| `6fe2fcd` | `feat: permitir a administradores alternar rol docente y estudiante con un clic desde el ranking` |
| `dd9ce24` | `feat: diferenciar formulario y métricas de docentes vs estudiantes y auto-capitalizar nombres` |
| `82291d7` | `feat: restringir seleccion de carrera a ISC e IIAR mediante selector desplegable` |
| `466f58d` | `feat: agregar panel de perfil de estudiante (/mi-perfil) y agrupacion por generacion` |
| `4dbb60a` | `feat: agregar enlaces directos a los perfiles de GitHub en todas las listas y componentes` |

---

> ✅ **Nota de Tranquilidad:** Todo el código fuente, componentes, lógica de negocio y este documento están respaldados y sincronizados en la nube de GitHub. Tu trabajo está completamente a salvo.
