-- =====================================================================
-- POKÉMON BOX RANDOMIZER - ESQUEMA DE BASE DE DATOS (SUPABASE)
-- =====================================================================
-- Copia y pega este script en el "SQL Editor" de tu panel de Supabase.
-- =====================================================================

-- 1. Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  total_boxes INTEGER NOT NULL DEFAULT 1 CHECK (total_boxes >= 1),
  total_special_boxes INTEGER NOT NULL DEFAULT 1 CHECK (total_special_boxes >= 1),
  special_box_names JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================================
-- MIGRACIÓN PARA BASES DE DATOS EXISTENTES:
-- Si ya creaste la tabla profiles, ejecuta estas líneas para añadir las nuevas columnas:
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS total_special_boxes INTEGER NOT NULL DEFAULT 1 CHECK (total_special_boxes >= 1);
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS special_box_names JSONB NOT NULL DEFAULT '{}'::jsonb;
-- =====================================================================

-- 2. Tabla de posiciones bloqueadas
CREATE TABLE IF NOT EXISTS public.blocked_positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  box INTEGER NOT NULL CHECK (box >= 1),
  row INTEGER NOT NULL CHECK (row >= 0 AND row <= 4),
  col INTEGER NOT NULL CHECK (col >= 0 AND col <= 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, box, row, col)
);

-- 3. Tabla de historial de tiradas
CREATE TABLE IF NOT EXISTS public.roll_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  box INTEGER NOT NULL,
  row INTEGER NOT NULL,
  col INTEGER NOT NULL,
  rolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar Seguridad a Nivel de Fila (Row Level Security - RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roll_results ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS para public.profiles
CREATE POLICY "Los usuarios pueden ver su propio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 6. Políticas RLS para public.blocked_positions
CREATE POLICY "Los usuarios pueden ver sus propios bloqueos" ON public.blocked_positions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar sus propios bloqueos" ON public.blocked_positions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios bloqueos" ON public.blocked_positions
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Políticas RLS para public.roll_results
CREATE POLICY "Los usuarios pueden ver su propio historial de tiradas" ON public.roll_results
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden registrar sus propias tiradas" ON public.roll_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, updated_at)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'username', 'πrola'), 
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. RPC (Database Function) para calcular la tirada aleatoria libre
CREATE OR REPLACE FUNCTION public.roll_position(total_boxes INT)
RETURNS TABLE(out_box INT, out_row INT, out_col INT, out_pos_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta como definer para escribir en roll_results si RLS restringe
AS $$
DECLARE
  v_user_id UUID;
  v_result RECORD;
BEGIN
  -- Obtener el ID del usuario autenticado de forma segura
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  -- Generar todas las combinaciones posibles de celdas para las cajas indicadas,
  -- excluir las celdas actualmente bloqueadas del usuario, y ordenar de manera aleatoria.
  WITH all_positions AS (
    SELECT 
      b AS box_num, 
      r AS row_num, 
      c AS col_num, 
      (b || '-' || r || '-' || c) AS p_id
    FROM 
      generate_series(1, total_boxes) b,
      generate_series(0, 4) r,
      generate_series(0, 5) c
  ),
  available_positions AS (
    SELECT * FROM all_positions
    WHERE p_id NOT IN (
      SELECT (bp.box || '-' || bp.row || '-' || bp.col)
      FROM public.blocked_positions bp
      WHERE bp.user_id = v_user_id
    )
  )
  SELECT box_num, row_num, col_num, p_id 
  INTO v_result
  FROM available_positions
  ORDER BY random()
  LIMIT 1;

  -- Validar si quedan celdas libres
  IF v_result IS NULL THEN
    RAISE EXCEPTION 'No quedan posiciones disponibles. ¡Desbloquea alguna!';
  END IF;

  -- Registrar el resultado en la tabla de historial
  INSERT INTO public.roll_results (user_id, box, row, col)
  VALUES (v_user_id, v_result.box_num, v_result.row_num, v_result.col_num);

  -- Retornar la celda seleccionada
  RETURN QUERY SELECT v_result.box_num, v_result.row_num, v_result.col_num, v_result.p_id;
END;
$$;
