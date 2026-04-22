-- Add role column to users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'subscriber';

-- Set up RLS policies for admin access
-- Enable RLS on all relevant tables if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE winner_verifications ENABLE ROW LEVEL SECURITY;

-- Admins can do everything on all tables
-- Replace 'admin' with the actual role value if you change it

-- Users table policies
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

-- Important: Update an initial user to be an admin so you can access the admin panel
-- UPDATE users SET role = 'admin' WHERE email = 'your_admin_email@example.com';
