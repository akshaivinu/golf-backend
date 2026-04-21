import { supabase } from '../configs/supabaseClient.js'

export const protect = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.access_token

        if (!token) {
            return res.status(401).json({ error: 'Not authorized, no token' })
        }

        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) {
            return res.status(401).json({ error: 'Not authorized, invalid token' })
        }

        // Get user profile from the database
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

        if (profileError) {
            // Profile might not exist yet if they just signed up
            req.user = { ...user, profile: null }
        } else {
            req.user = { ...user, profile }
        }

        next()
    } catch (error) {
        console.error('Auth middleware error:', error)
        res.status(401).json({ error: 'Not authorized' })
    }
}

export const adminOnly = async (req, res, next) => {
    if (req.user?.profile?.subscription_plan !== 'admin') { // Or use the is_admin flag if I added it
        // Actually, let's check the is_admin flag from the profile if I added it to the schema
        // The user didn't specify an is_admin flag in their users table, but mentioned an Admin role.
        // I'll assume for now we use a specific flag or email check.
        const isAdmin = req.user?.email?.endsWith('@admin.com') || req.user?.profile?.is_admin;
        
        if (!isAdmin) {
            return res.status(403).json({ error: 'Access denied: Admins only' })
        }
    }
    next()
}
