ALTER TABLE public.monsters
  ADD COLUMN IF NOT EXISTS body_type text NOT NULL DEFAULT 'human',
  ADD COLUMN IF NOT EXISTS body_parts text[] NOT NULL
    DEFAULT ARRAY['Cabeça', 'Tronco', 'Braço esquerdo', 'Braço direito', 'Perna esquerda', 'Perna direita'];
