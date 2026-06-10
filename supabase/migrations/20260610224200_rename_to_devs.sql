-- Migration: Rename students to devs in database schema and triggers

-- 1. Drop old tables referencing students
DROP TABLE IF EXISTS public.student_badges CASCADE;
DROP TABLE IF EXISTS public.student_challenges CASCADE;
DROP TABLE IF EXISTS public.github_stats CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;

-- 2. Create Devs table (replaces students)
CREATE TABLE public.devs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    nombre VARCHAR(255) NOT NULL,
    github_username VARCHAR(100) UNIQUE NOT NULL,
    avatar_url TEXT,
    total_score INTEGER DEFAULT 0 CHECK (total_score >= 0),
    total_contributions INTEGER DEFAULT 0 NOT NULL,
    is_admin BOOLEAN DEFAULT false NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Github Stats table referencing devs(id)
CREATE TABLE public.github_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dev_id UUID NOT NULL REFERENCES public.devs(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    stats JSONB DEFAULT '{"commits": 0, "pull_requests": 0, "issues": 0, "stars_received": 0}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_dev_date UNIQUE (dev_id, fecha)
);

-- 4. Create Dev Challenges table (replaces student_challenges)
CREATE TABLE public.dev_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dev_id UUID NOT NULL REFERENCES public.devs(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    completado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_dev_challenge UNIQUE (dev_id, challenge_id)
);

-- 5. Create Dev Badges table (replaces student_badges)
CREATE TABLE public.dev_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dev_id UUID NOT NULL REFERENCES public.devs(id) ON DELETE CASCADE,
    badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    otorgado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_dev_badge UNIQUE (dev_id, badge_id)
);

-- 6. Indexes for performance
CREATE INDEX idx_devs_auth_id ON public.devs(auth_id);
CREATE INDEX idx_github_stats_dev_date ON public.github_stats(dev_id, fecha);
CREATE INDEX idx_github_stats_jsonb ON public.github_stats USING gin (stats);
CREATE INDEX idx_dev_badges_dev ON public.dev_badges(dev_id);
CREATE INDEX idx_dev_challenges_dev ON public.dev_challenges(dev_id);

-- 7. RLS Policies
ALTER TABLE public.devs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_badges ENABLE ROW LEVEL SECURITY;

-- Select policies (Public read)
CREATE POLICY "Allow public read access to devs" ON public.devs FOR SELECT USING (true);
CREATE POLICY "Allow public read access to github_stats" ON public.github_stats FOR SELECT USING (true);
CREATE POLICY "Allow public read access to dev_challenges" ON public.dev_challenges FOR SELECT USING (true);
CREATE POLICY "Allow public read access to dev_badges" ON public.dev_badges FOR SELECT USING (true);

-- Update profile policy: Devs can only update their own record mapped by auth_id
CREATE POLICY "Allow devs to update their own profile" ON public.devs 
    FOR UPDATE USING (auth.uid() = auth_id) WITH CHECK (auth.uid() = auth_id);

-- Admin write policies
CREATE POLICY "Allow admin write access to devs" ON public.devs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to github_stats" ON public.github_stats FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to dev_challenges" ON public.dev_challenges FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow admin write access to dev_badges" ON public.dev_badges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Trigger to automatically link or create dev records when GitHub users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_id UUID;
  username VARCHAR;
BEGIN
  username := COALESCE(new.raw_user_meta_data->>'user_name', new.raw_user_meta_data->>'preferred_username');
  
  -- Check if dev already exists by github_username (case-insensitive)
  SELECT id INTO existing_id FROM public.devs WHERE LOWER(github_username) = LOWER(username);
  
  IF existing_id IS NOT NULL THEN
    -- Link authentication to the existing dev record
    UPDATE public.devs 
    SET auth_id = new.id,
        avatar_url = COALESCE(devs.avatar_url, new.raw_user_meta_data->>'avatar_url'),
        nombre = COALESCE(devs.nombre, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
    WHERE id = existing_id;
  ELSE
    -- Insert a new dev record
    INSERT INTO public.devs (auth_id, nombre, github_username, avatar_url)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'Developer'),
      COALESCE(username, 'github_user_' || substr(new.id::text, 1, 8)),
      new.raw_user_meta_data->>'avatar_url'
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed default badges again (since student_badges/dev_badges drop didn't affect badges, but it's safe to ensure they remain)
INSERT INTO public.badges (nombre, descripcion, icon_url, criterio_desbloqueo)
VALUES 
  ('Hola Mundo', 'Primera aportación en el ranking.', '🚀', '{"type": "first_commit"}'),
  ('Constancia Brutal', 'Racha activa de aportaciones por 3 días seguidos.', '🔥', '{"type": "streak", "target_days": 3, "metric": "commits"}')
ON CONFLICT (nombre) DO UPDATE 
SET descripcion = EXCLUDED.descripcion,
    icon_url = EXCLUDED.icon_url,
    criterio_desbloqueo = EXCLUDED.criterio_desbloqueo;
