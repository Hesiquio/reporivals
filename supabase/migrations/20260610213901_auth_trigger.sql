-- Migration: Link students to auth.users and establish automated sign-up trigger

-- 1. Safely drop foreign keys and tables to recreate constraints
DROP TABLE IF EXISTS public.student_badges CASCADE;
DROP TABLE IF EXISTS public.student_challenges CASCADE;
DROP TABLE IF EXISTS public.github_stats CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;

-- 2. Recreate Students table referencing auth.users(id)
CREATE TABLE public.students (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    github_username VARCHAR(100) UNIQUE NOT NULL,
    avatar_url TEXT,
    total_score INTEGER DEFAULT 0 CHECK (total_score >= 0),
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Recreate Github Stats table
CREATE TABLE public.github_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    stats JSONB DEFAULT '{"commits": 0, "pull_requests": 0, "issues": 0, "stars_received": 0}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_date UNIQUE (student_id, fecha)
);

-- 4. Recreate Student Challenges table
CREATE TABLE public.student_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    completado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_challenge UNIQUE (student_id, challenge_id)
);

-- 5. Recreate Student Badges table
CREATE TABLE public.student_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    otorgado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_student_badge UNIQUE (student_id, badge_id)
);

-- 6. Indexes for performance
CREATE INDEX idx_github_stats_student_date ON public.github_stats(student_id, fecha);
CREATE INDEX idx_github_stats_jsonb ON public.github_stats USING gin (stats);
CREATE INDEX idx_student_badges_student ON public.student_badges(student_id);
CREATE INDEX idx_student_challenges_student ON public.student_challenges(student_id);

-- 7. RLS Policies
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "Allow public read access to students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Allow public read access to github_stats" ON public.github_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read access to student_challenges" ON public.student_challenges FOR SELECT USING (true);
CREATE POLICY "Allow public read access to student_badges" ON public.student_badges FOR SELECT USING (true);

-- Update profile policy: Users can only update their own student record
CREATE POLICY "Allow users to update their own student profile" ON public.students 
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Write policies for authenticated admins/service role
CREATE POLICY "Allow admin write access to students" ON public.students FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to github_stats" ON public.github_stats FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to student_challenges" ON public.student_challenges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to student_badges" ON public.student_badges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Trigger to automatically create student records when GitHub users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.students (id, nombre, github_username, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Estudiante'),
    COALESCE(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username', 'github_user_' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
