import { supabase } from '../configs/supabaseClient.js'

export const getCharities = async (req, res) => {
    try {
        const { search, featured } = req.query
        let query = supabase.from('charities').select('*')

        if (featured === 'true') {
            query = query.eq('is_featured', true)
        }

        if (search) {
            query = query.ilike('name', `%${search}%`)
        }

        const { data, error } = await query

        if (error) throw error

        res.status(200).json(data)
    } catch (error) {
        console.error('Get charities error:', error)
        res.status(500).json({ error: 'Failed to fetch charities.' })
    }
}

export const updateUserCharity = async (req, res) => {
    try {
        const { charity_id, charity_percentage } = req.body
        const userId = req.user.id

        // Validate percentage (Base 10% + voluntary extra)
        // User input should be the TOTAL percentage including the minimum 10%
        if (charity_percentage < 10) {
            return res.status(400).json({ error: 'Charity percentage must be at least 10%.' })
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({
                selected_charity_id: charity_id
            })
            .eq('id', userId)
            .select()
            .single()

        if (error) throw error

        res.status(200).json({
            message: 'Charity preference updated successfully.',
            profile: data
        })

    } catch (error) {
        console.error('Update charity error:', error)
        res.status(500).json({ error: 'Failed to update charity preference.' })
    }
}

export const getCharityStats = async (req, res) => {
    // Aggregated stats for the global charity dashboard
    try {
        const { id } = req.params
        const { data, error } = await supabase
            .from('charities')
            .select('*, total_contributions')
            .eq('id', id)
            .single()

        if (error) throw error
        res.status(200).json(data)
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch charity stats.' })
    }
}
