CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  username text NOT NULL DEFAULT '',
  coins integer NOT NULL DEFAULT 100,
  points integer NOT NULL DEFAULT 0,
  vip_until timestamptz,
  blocked boolean NOT NULL DEFAULT false,
  block_reason text NOT NULL DEFAULT '',
  referral_code text NOT NULL UNIQUE DEFAULT ('WC-' || upper(substr(md5(random()::text), 1, 6))),
  referred_by uuid,
  referrals integer NOT NULL DEFAULT 0,
  last_checkin date,
  checkin_streak integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ad_frequency integer NOT NULL DEFAULT 20,
  notice text NOT NULL DEFAULT '',
  ad_unit_id text NOT NULL DEFAULT 'ca-app-pub-xxxxxxxx~yyyyyyyy',
  watch_seconds integer NOT NULL DEFAULT 10,
  watch_reward integer NOT NULL DEFAULT 1,
  uploads_enabled boolean NOT NULL DEFAULT true,
  pay_numbers jsonb NOT NULL DEFAULT '{"bKash":"01XXXXXXXXX","Nagad":"01XXXXXXXXX","Rocket":"01XXXXXXXXX"}'::jsonb,
  deposit_notice text NOT NULL DEFAULT '',
  vip_price integer NOT NULL DEFAULT 50,
  vip_days integer NOT NULL DEFAULT 30,
  vip_benefits text NOT NULL DEFAULT '',
  ad_price_per_day integer NOT NULL DEFAULT 100,
  rules text NOT NULL DEFAULT ''
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings public read" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.app_settings (id) VALUES (1);

CREATE OR REPLACE FUNCTION public.is_blocked(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT blocked FROM public.profiles WHERE id = _uid), false)
$$;

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  user_id uuid NOT NULL,
  username text NOT NULL,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 240),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.comments TO anon, authenticated;
GRANT INSERT ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments read" ON public.comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "comments insert own" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND NOT public.is_blocked(auth.uid()));

CREATE TABLE public.uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  caption text NOT NULL DEFAULT '',
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.uploads TO anon, authenticated;
GRANT INSERT ON public.uploads TO authenticated;
GRANT ALL ON public.uploads TO service_role;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uploads read approved or own" ON public.uploads FOR SELECT TO anon, authenticated
  USING (status = 'approved' OR user_id = auth.uid());
CREATE POLICY "uploads insert own" ON public.uploads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND NOT public.is_blocked(auth.uid()));

CREATE TABLE public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('coins','boost','ad','vip')),
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 100000),
  method text NOT NULL CHECK (method IN ('bKash','Nagad','Rocket')),
  trx_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposits read own" ON public.deposits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "deposits insert own" ON public.deposits FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending' AND decided_at IS NULL AND NOT public.is_blocked(auth.uid()));

CREATE TABLE public.gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  gift text NOT NULL,
  emoji text NOT NULL,
  coins integer NOT NULL,
  creator text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gifts TO authenticated;
GRANT ALL ON public.gifts TO service_role;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts read own" ON public.gifts FOR SELECT TO authenticated USING (sender_id = auth.uid());

CREATE TABLE public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text NOT NULL,
  phone text NOT NULL,
  method text NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals read own" ON public.withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.penalties TO authenticated;
GRANT ALL ON public.penalties TO service_role;
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "penalties read own" ON public.penalties FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.rewards (
  user_id uuid NOT NULL,
  item_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_key)
);
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- RPCs
CREATE OR REPLACE FUNCTION public.ensure_profile(_username text) RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  INSERT INTO public.profiles (id, username) VALUES (auth.uid(), left(coalesce(nullif(trim(_username), ''), 'user'), 40))
  ON CONFLICT (id) DO NOTHING;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.claim_reward(_key text, _kind text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE amt integer; vip boolean;
BEGIN
  IF auth.uid() IS NULL OR public.is_blocked(auth.uid()) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF _kind = 'ad' THEN amt := 5; ELSE SELECT watch_reward INTO amt FROM public.app_settings WHERE id = 1; END IF;
  SELECT coalesce(vip_until > now(), false) INTO vip FROM public.profiles WHERE id = auth.uid();
  IF vip THEN amt := amt * 2; END IF;
  INSERT INTO public.rewards (user_id, item_key) VALUES (auth.uid(), left(_kind || ':' || _key, 300))
  ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN 0; END IF;
  UPDATE public.profiles SET points = points + amt WHERE id = auth.uid();
  RETURN amt;
END $$;

CREATE OR REPLACE FUNCTION public.daily_checkin() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles; streak integer;
BEGIN
  IF auth.uid() IS NULL OR public.is_blocked(auth.uid()) THEN RAISE EXCEPTION 'blocked'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF p.last_checkin = current_date THEN RETURN -1; END IF;
  streak := CASE WHEN p.last_checkin = current_date - 1 THEN p.checkin_streak + 1 ELSE 1 END;
  UPDATE public.profiles SET last_checkin = current_date, checkin_streak = streak, points = points + 10 WHERE id = auth.uid();
  RETURN streak;
END $$;

CREATE OR REPLACE FUNCTION public.send_gift(_gift text, _emoji text, _coins integer, _creator text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_blocked(auth.uid()) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF _coins NOT IN (10, 30, 100) THEN RAISE EXCEPTION 'bad gift'; END IF;
  UPDATE public.profiles SET coins = coins - _coins WHERE id = auth.uid() AND coins >= _coins;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.gifts (sender_id, gift, emoji, coins, creator) VALUES (auth.uid(), left(_gift, 40), left(_emoji, 8), _coins, left(_creator, 60));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.request_withdraw(_phone text, _method text, _amount integer) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uname text;
BEGIN
  IF auth.uid() IS NULL OR public.is_blocked(auth.uid()) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF _amount < 50 OR _phone !~ '^01[3-9][0-9]{8}$' OR _method NOT IN ('bKash','Nagad') THEN RAISE EXCEPTION 'invalid'; END IF;
  UPDATE public.profiles SET points = points - _amount * 100 WHERE id = auth.uid() AND points >= _amount * 100
  RETURNING username INTO uname;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO public.withdrawals (user_id, username, phone, method, amount) VALUES (auth.uid(), uname, _phone, _method, _amount);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.apply_referral(_code text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT id INTO ref_id FROM public.profiles WHERE referral_code = upper(trim(_code)) AND id <> auth.uid();
  IF ref_id IS NULL THEN RETURN false; END IF;
  UPDATE public.profiles SET referred_by = ref_id, points = points + 50 WHERE id = auth.uid() AND referred_by IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.profiles SET referrals = referrals + 1, points = points + 50 WHERE id = ref_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.feed_promos() RETURNS TABLE (id uuid, kind text, username text, details jsonb, decided_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.kind, d.username, d.details - 'contact', d.decided_at FROM public.deposits d
  WHERE d.status = 'approved' AND d.kind IN ('boost','ad')
    AND (d.kind <> 'ad' OR d.decided_at + make_interval(days => coalesce((d.details->>'days')::int, 1)) > now())
  ORDER BY d.decided_at DESC LIMIT 50
$$;

CREATE OR REPLACE FUNCTION public.vip_usernames() RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT username FROM public.profiles WHERE vip_until > now()
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_profile(text), public.claim_reward(text, text), public.daily_checkin(), public.send_gift(text, text, integer, text), public.request_withdraw(text, text, integer), public.apply_referral(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text), public.claim_reward(text, text), public.daily_checkin(), public.send_gift(text, text, integer, text), public.request_withdraw(text, text, integer), public.apply_referral(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.feed_promos(), public.vip_usernames(), public.is_blocked(uuid) TO anon, authenticated;