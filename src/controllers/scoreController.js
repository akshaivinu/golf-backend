import { supabase } from '../configs/supabaseClient.js'

export const addScore = async (req, res) => {
    try {
        const { score_value, score_date } = req.body
        const userId = req.user.id

        // 1. Validation
        if (!score_value || score_value < 1 || score_value > 45) {
            return res.status(400).json({ error: 'Score must be between 1 and 45.' })
        }

        if (!score_date) {
            return res.status(400).json({ error: 'Date is required.' })
        }

        // 2. Insert new score (The DB Trigger handles deactivating old ones)
        const { data: newScore, error: insertError } = await supabase
            .from('scores')
            .insert({
                user_id: userId,
                score_value,
                score_date
            })
            .select()
            .single()

        if (insertError) {
            if (insertError.code === '23505') { // Unique violation
                return res.status(400).json({ error: 'A score for this date already exists.' })
            }
            throw insertError
        }

        res.status(201).json({ 
            message: 'Score added successfully.', 
            score: newScore
        })

    } catch (error) {
        console.error('Add score error:', error)
        res.status(500).json({ error: 'Failed to add score.' })
    }
}

export const getScores = async (req, res) => {
    try {
        const userId = req.user.id
        const { data, error } = await supabase
            .from('scores')
            .select('*')
            .eq('user_id', userId)
            .order('score_date', { ascending: false })

        if (error) throw error

        res.status(200).json(data)
    } catch (error) {
        console.error('Get scores error:', error)
        res.status(500).json({ error: 'Failed to fetch scores.' })
    }
}
