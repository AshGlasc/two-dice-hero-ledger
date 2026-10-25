ALTER TABLE public.battle_map ADD COLUMN tile_images jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.battle_map ADD COLUMN fog jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.characters ADD COLUMN money integer NOT NULL DEFAULT 0;
ALTER TABLE public.monsters ADD COLUMN money integer NOT NULL DEFAULT 0;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  from_name text NOT NULL DEFAULT '',
  to_character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'text' CHECK (kind IN ('text','pix')),
  amount integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_created_idx ON public.messages (created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Mesa aberta: ler mensagens" ON public.messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Mesa aberta: enviar mensagens" ON public.messages FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Mesa aberta: apagar mensagens" ON public.messages FOR DELETE TO anon, authenticated USING (true);
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

CREATE OR REPLACE FUNCTION public.transfer_money(_from uuid, _to uuid, _amount integer, _note text DEFAULT '')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal integer;
  sender text;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF _from = _to THEN RAISE EXCEPTION 'Não dá para enviar para si mesmo'; END IF;
  SELECT money, name INTO bal, sender FROM public.characters WHERE id = _from FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Personagem não encontrado'; END IF;
  IF bal < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  PERFORM 1 FROM public.characters WHERE id = _to FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destinatário não encontrado'; END IF;
  UPDATE public.characters SET money = money - _amount WHERE id = _from;
  UPDATE public.characters SET money = money + _amount WHERE id = _to;
  INSERT INTO public.messages (from_character_id, from_name, to_character_id, body, kind, amount)
  VALUES (_from, sender, _to, coalesce(_note, ''), 'pix', _amount);
  RETURN bal - _amount;
END;
$$;
GRANT EXECUTE ON FUNCTION public.transfer_money(uuid, uuid, integer, text) TO anon, authenticated;