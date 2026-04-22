import { supabase } from '../configs/supabaseClient.js'

export const getDashboardStats = async (req, res) => {
    try {
        // 1. Total Users
        const { count: totalUsers, error: usersError } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })

        if (usersError) throw usersError

        // 2. Active Subscribers (real count from subscriptions table)
        const { count: activeSubscribers, error: subsError } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')

        if (subsError) throw subsError

        // 3. Total Prize Pool (sum of all prize_pool entries)
        const { data: pools, error: poolsError } = await supabase
            .from('prize_pool')
            .select('total_pool')

        if (poolsError) throw poolsError
        const totalPrizePool = pools.reduce((acc, p) => acc + (p.total_pool || 0), 0)

        // 4. Total Charity Impact (sum of donations across all draw_results)
        const { data: users, error: impactError } = await supabase
            .from('users')
            .select('total_impact')

        if (impactError) throw impactError
        const totalCharityImpact = users.reduce((acc, u) => acc + (u.total_impact || 0), 0)

        res.status(200).json({
            totalUsers,
            activeSubscribers,
            totalPrizePool,
            totalCharityImpact,
        })
    } catch (error) {
        console.error('Admin stats error:', error)
        res.status(500).json({ error: 'Failed to fetch admin statistics.' })
    }
}

export const getRevenueMetrics = async (req, res) => {
    try {
        // Monthly vs Yearly breakdown
        const { data: subs, error: subsError } = await supabase
            .from('subscriptions')
            .select('plan, status, created_at')

        if (subsError) throw subsError

        const monthly = subs.filter(s => s.plan === 'monthly' && s.status === 'active').length
        const yearly = subs.filter(s => s.plan === 'yearly' && s.status === 'active').length
        const pastDue = subs.filter(s => s.status === 'past_due').length
        const canceled = subs.filter(s => s.status === 'canceled').length

        // Total draws conducted
        const { count: totalDraws, error: drawsError } = await supabase
            .from('draws')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'published')

        if (drawsError) throw drawsError

        // Total payouts made
        const { data: payouts, error: payoutsError } = await supabase
            .from('draw_results')
            .select('prize_amount')
            .eq('payment_status', 'paid')

        if (payoutsError) throw payoutsError
        const totalPaid = payouts.reduce((acc, p) => acc + (p.prize_amount || 0), 0)

        res.status(200).json({
            subscriptions: { monthly, yearly, pastDue, canceled },
            totalDraws,
            totalPaid,
        })
    } catch (error) {
        console.error('Revenue metrics error:', error)
        res.status(500).json({ error: 'Failed to fetch revenue metrics.' })
    }
}

export const getAllUsers = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select(`
                *,
                subscriptions (status, plan, period_end),
                scores (score_value, score_date)
            `)
            .order('created_at', { ascending: false })

        if (error) throw error
        res.status(200).json(data)
    } catch (error) {
        console.error('Admin get users error:', error)
        res.status(500).json({ error: 'Failed to fetch users.' })
    }
}

export const assignRole = async (req, res) => {
    try {
        const { id } = req.params
        const { role } = req.body // Already validated by validateRole middleware

        const { data, error } = await supabase
            .from('users')
            .update({ role })
            .eq('id', id)
            .select('id, email, name, role')
            .single()

        if (error) throw error
        res.status(200).json({ message: `User role updated to '${role}'.`, user: data })
    } catch (error) {
        console.error('Assign role error:', error)
        res.status(500).json({ error: 'Failed to assign role.' })
    }
}

export const suspendUser = async (req, res) => {
    try {
        const { id } = req.params

        const { data, error } = await supabase
            .from('users')
            .update({ role: 'suspended' })
            .eq('id', id)
            .select('id, email, name, role')
            .single()

        if (error) throw error
        res.status(200).json({ message: 'User suspended.', user: data })
    } catch (error) {
        console.error('Suspend user error:', error)
        res.status(500).json({ error: 'Failed to suspend user.' })
    }
}

export const updateUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params
        // Only allow safe fields — prevent arbitrary injection
        const { name, charity_id, charity_percentage } = req.body
        const updates = {}
        if (name !== undefined) updates.name = String(name).trim()
        if (charity_id !== undefined) updates.charity_id = charity_id
        if (charity_percentage !== undefined) {
            const pct = Number(charity_percentage)
            if (pct >= 10 && pct <= 100) updates.charity_percentage = pct
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update.' })
        }

        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        res.status(200).json(data)
    } catch (error) {
        console.error('Admin update user error:', error)
        res.status(500).json({ error: 'Failed to update user.' })
    }
}

export const updateUserScoreByAdmin = async (req, res) => {
    try {
        const { scoreId } = req.params
        const { score_value } = req.body

        if (score_value < 1 || score_value > 45) {
            return res.status(400).json({ error: 'Invalid score value (1-45).' })
        }

        const { data, error } = await supabase
            .from('scores')
            .update({ score_value })
            .eq('id', scoreId)
            .select()
            .single()

        if (error) throw error
        res.status(200).json({ message: 'Score updated by Admin.', score: data })
    } catch (error) {
        console.error('Admin score update error:', error)
        res.status(500).json({ error: 'Failed to update score.' })
    }
}
