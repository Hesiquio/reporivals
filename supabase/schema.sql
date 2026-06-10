-- PostgreSQL Schema for GitHub Gamified Education Platform (Flexible JSONB Version)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Students Table
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) NOT NULL,
    github_username VARCHAR(100) UNIQUE NOT NULL,
    avatar_url TEXT,
    total_score INTEGER DEFAULT 0 CHECK (total_score >= 0),
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL, -- For custom UI themes, social links, preferences
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. GitHub Stats Table
CREATE TABLE public.github_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    stats JSONB DEFAULT '{"commits": 0, "pull_requests": 0, "issues": 0, "stars_received": 0}'::jsonb NOT NULL, -- Flexible metrics (allows adding reviews, comments, releases, etc. dynamically)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_date UNIQUE (student_id, fecha)
);

-- 3. Challenges Table
CREATE TABLE public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    config JSONB DEFAULT '{}'::jsonb NOT NULL, -- Flexible points, duration, target metrics
    activo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Student Challenges (M2M)
CREATE TABLE public.student_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    completado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_challenge UNIQUE (student_id, challenge_id)
);

-- 5. Badges Table
CREATE TABLE public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(255) UNIQUE NOT NULL,
    descripcion TEXT NOT NULL,
    icon_url TEXT NOT NULL,
    criterio_desbloqueo JSONB NOT NULL, -- Flexible rule engine configuration (e.g. {"type": "streak", "target": 3, "metric": "commits"})
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Student Badges Table (M2M)
CREATE TABLE public.student_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    otorgado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_badge UNIQUE (student_id, badge_id)
);

-- Indexes for performance
CREATE INDEX idx_github_stats_student_date ON public.github_stats(student_id, fecha);
CREATE INDEX idx_github_stats_jsonb ON public.github_stats USING gin (stats);
CREATE INDEX idx_student_badges_student ON public.student_badges(student_id);
CREATE INDEX idx_student_challenges_student ON public.student_challenges(student_id);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

-- Create policies for Public Read Access
CREATE POLICY "Allow public read access to students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public read access to github_stats" ON public.github_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read access to challenges" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Allow public read access to student_challenges" ON public.student_challenges FOR SELECT USING (true);
CREATE POLICY "Allow public read access to badges" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Allow public read access to student_badges" ON public.student_badges FOR SELECT USING (true);

-- Create policies for service role / admin write access
CREATE POLICY "Allow admin write access to students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to github_stats" ON public.github_stats FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to challenges" ON public.challenges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to student_challenges" ON public.student_challenges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to badges" ON public.badges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to student_badges" ON public.student_badges FOR ALL TO authenticated USING (true) WITH CHECK (true);
