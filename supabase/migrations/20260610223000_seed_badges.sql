-- Seed default badges
INSERT INTO public.badges (nombre, descripcion, icon_url, criterio_desbloqueo)
VALUES 
  ('Hola Mundo', 'Primera aportación en el ranking.', '🚀', '{"type": "first_commit"}'),
  ('Constancia Brutal', 'Racha activa de aportaciones por 3 días seguidos.', '🔥', '{"type": "streak", "target_days": 3, "metric": "commits"}')
ON CONFLICT (nombre) DO UPDATE 
SET descripcion = EXCLUDED.descripcion,
    icon_url = EXCLUDED.icon_url,
    criterio_desbloqueo = EXCLUDED.criterio_desbloqueo;
