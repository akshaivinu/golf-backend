-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES
-- Charities
CREATE TABLE IF NOT EXISTS public.charities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    logo_url TEXT,
    total_raised DECIMAL(12,2) DEFAULT 0.00,
    total_contributions DECIMAL(12,2) DEFAULT 0.00,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (Linked to Auth.Users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    selected_charity_id UUID REFERENCES public.charities(id),
    subscription_status TEXT DEFAULT 'inactive',
    stripe_customer_id TEXT,
    total_impact DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    score_value INTEGER NOT NULL CHECK (score_value > 0),
    score_date TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draws
CREATE TABLE IF NOT EXISTS public.draws (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_month INTEGER NOT NULL,
    draw_year INTEGER NOT NULL,
    drawn_numbers INTEGER[] DEFAULT '{}',
    total_pool DECIMAL(12,2) DEFAULT 0.00,
    status TEXT DEFAULT 'draft', -- 'draft', 'published'
    draw_type TEXT DEFAULT 'random',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(draw_month, draw_year)
);

-- Prize Pools
CREATE TABLE IF NOT EXISTS public.prize_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_id UUID REFERENCES public.draws(id) ON DELETE CASCADE,
    total_pool DECIMAL(12,2) DEFAULT 0.00,
    five_match_pool DECIMAL(12,2) DEFAULT 0.00,
    four_match_pool DECIMAL(12,2) DEFAULT 0.00,
    three_match_pool DECIMAL(12,2) DEFAULT 0.00,
    jackpot_carried_forward BOOLEAN DEFAULT FALSE,
    jackpot_amount DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draw Results (Winners)
CREATE TABLE IF NOT EXISTS public.draw_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_id UUID REFERENCES public.draws(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    match_count INTEGER NOT NULL,
    prize_amount DECIMAL(12,2) DEFAULT 0.00,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'verified'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Winner Verifications
CREATE TABLE IF NOT EXISTS public.winner_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_result_id UUID REFERENCES public.draw_results(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    proof_file_url TEXT NOT NULL,
    admin_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions (Stripe sync)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL,
    status TEXT NOT NULL,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prize_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winner_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES
-- Charities: Public read
CREATE POLICY "Public charities are viewable by everyone" ON public.charities
    FOR SELECT USING (true);

-- Profiles: Users can view/update their own
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Scores: Users can view/insert their own
CREATE POLICY "Users can view own scores" ON public.scores
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scores" ON public.scores
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Draws: Authenticated read
CREATE POLICY "Authenticated users can view draws" ON public.draws
    FOR SELECT USING (auth.role() = 'authenticated');

-- Prize Pool: Authenticated read
CREATE POLICY "Authenticated users can view prize pools" ON public.prize_pool
    FOR SELECT USING (auth.role() = 'authenticated');

-- Draw Results: Users can view their own
CREATE POLICY "Users can view own draw results" ON public.draw_results
    FOR SELECT USING (auth.uid() = user_id);

-- winner_verifications: Users can view/insert their own
CREATE POLICY "Users can view own verifications" ON public.winner_verifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own verifications" ON public.winner_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- subscriptions: Users can view their own
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- 5. TRIGGERS & FUNCTIONS
-- Handle Rolling Scores (Keep only latest 5 active)
CREATE OR REPLACE FUNCTION public.handle_rolling_scores()
RETURNS TRIGGER AS $$
BEGIN
    -- Deactivate all scores for this user except the latest 4 + this one
    UPDATE public.scores
    SET is_active = FALSE
    WHERE user_id = NEW.user_id
    AND id NOT IN (
        SELECT id FROM public.scores
        WHERE user_id = NEW.user_id
        ORDER BY score_date DESC, created_at DESC
        LIMIT 4
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_score_inserted
    AFTER INSERT ON public.scores
    FOR EACH ROW EXECUTE FUNCTION public.handle_rolling_scores();

-- Seed Data (Initial Charities)
INSERT INTO public.charities (name, description, logo_url, is_featured) VALUES 
('Green Fairways', 'Reforestation through golf engagement.', '🌳', true),
('Water for All', 'Providing clean water to underserved communities.', '💧', false),
('Youth Links', 'Mentorship and education for urban youth.', '🎓', true);
