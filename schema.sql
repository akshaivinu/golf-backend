-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES
-- Charities
CREATE TABLE IF NOT EXISTS public.charities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    images TEXT[] DEFAULT '{}',
    events JSONB DEFAULT '[]',
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Profiles linked to Auth.Users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    charity_id UUID REFERENCES public.charities(id),
    charity_percentage INTEGER DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    score_value INTEGER NOT NULL CHECK (score_value BETWEEN 1 AND 45),
    score_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, score_date)
);

-- Draws
CREATE TABLE IF NOT EXISTS public.draws (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_date DATE NOT NULL DEFAULT CURRENT_DATE,
    drawn_numbers INTEGER[] DEFAULT '{}',
    draw_type TEXT DEFAULT 'random', -- 'random', 'algorithmic'
    status TEXT DEFAULT 'draft',   -- 'draft', 'published'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(draw_date)
);

-- Prize Pools
CREATE TABLE IF NOT EXISTS public.prize_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_id UUID REFERENCES public.draws(id) ON DELETE CASCADE,
    total_pool FLOAT DEFAULT 0.0,
    five_match_pool FLOAT DEFAULT 0.0,
    four_match_pool FLOAT DEFAULT 0.0,
    three_match_pool FLOAT DEFAULT 0.0,
    jackpot_rollover BOOLEAN DEFAULT FALSE,
    jackpot_carried_forward FLOAT DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draw Results (Winners)
CREATE TABLE IF NOT EXISTS public.draw_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_id UUID REFERENCES public.draws(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    match_count INTEGER NOT NULL,
    prize_amount FLOAT DEFAULT 0.0,
    payment_status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'verified'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Winner Verifications
CREATE TABLE IF NOT EXISTS public.winner_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draw_result_id UUID REFERENCES public.draw_results(id) ON DELETE CASCADE,
    proof_file_url TEXT NOT NULL,
    admin_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    stripe_sub_id TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL,
    status TEXT NOT NULL,
    period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
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

-- Users: Users can view/update their own
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
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
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.draw_results
        WHERE id = draw_result_id AND user_id = auth.uid()
    ));
CREATE POLICY "Users can insert own verifications" ON public.winner_verifications
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.draw_results
        WHERE id = draw_result_id AND user_id = auth.uid()
    ));

-- subscriptions: Users can view their own
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- 5. SEED DATA
INSERT INTO public.charities (name, description, is_featured) VALUES 
('Green Fairways', 'Reforestation through golf engagement.', true),
('Water for All', 'Providing clean water to underserved communities.', false),
('Youth Links', 'Mentorship and education for urban youth.', true);

-- 6. MIGRATIONS
-- Add role column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'subscriber';

-- Set up RLS policies for admin access
-- Admins can read all users
CREATE POLICY "Admins can read all users" ON users FOR SELECT USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));
CREATE POLICY "Admins can update all users" ON users FOR UPDATE USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));

-- Subscriptions table policies
CREATE POLICY "Admins can read all subscriptions" ON subscriptions FOR SELECT USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));
CREATE POLICY "Admins can insert subscriptions" ON subscriptions FOR INSERT WITH CHECK ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));
CREATE POLICY "Admins can update all subscriptions" ON subscriptions FOR UPDATE USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));

-- Scores table policies
CREATE POLICY "Admins can read all scores" ON scores FOR SELECT USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));
CREATE POLICY "Admins can update all scores" ON scores FOR UPDATE USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));
CREATE POLICY "Admins can delete all scores" ON scores FOR DELETE USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));

-- Draws table policies (Admin only for write)
CREATE POLICY "Admins can manage draws" ON draws USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));

-- Charities table policies (Admin only for write, public for read)
CREATE POLICY "Admins can manage charities" ON charities USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));

-- Winner_verifications policies
CREATE POLICY "Admins can read all verifications" ON winner_verifications FOR SELECT USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));
CREATE POLICY "Admins can update verifications" ON winner_verifications FOR UPDATE USING ((auth.uid() IN (SELECT id FROM users WHERE role = 'admin')));

