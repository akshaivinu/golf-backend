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
            req.user = { ...user, profile: null, subscription: null }
        } else {
            // Check subscription status
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .eq('status', 'active')
                .single()

            req.user = { ...user, profile, subscription }
        }

        next()
    } catch (error) {
        console.error('Auth middleware error:', error)
        res.status(401).json({ error: 'Not authorized' })
    }
}

/**
 * Middleware: Admins only.
 * Checks req.user.profile.role === 'admin'.
 * Must be used AFTER protect.
 */
export const adminOnly = (req, res, next) => {
    if (req.user?.profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Admins only' })
    }
    next()
}

/**
 * Middleware: Subscribers OR Admins.
 * Admins bypass subscription check entirely.
 * Must be used AFTER protect.
 */
export const subscriberOrAdmin = (req, res, next) => {
    const role = req.user?.profile?.role

    // Admins always pass
    if (role === 'admin') return next()

    // Subscribers need an active subscription
    const subscription = req.user?.subscription
    if (!subscription || subscription.status !== 'active') {
        return res.status(403).json({
            error: 'Subscription required',
            message: 'You must have an active subscription to access this feature.'
        })
    }

    next()
}
