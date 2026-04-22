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

        // 2. Count existing scores
        const { count, error: countError } = await supabase
            .from('scores')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)

        if (countError) throw countError

        // 3. If >= 5, delete the oldest one
        if (count >= 5) {
            const { data: oldest, error: findOldestError } = await supabase
                .from('scores')
                .select('id')
                .eq('user_id', userId)
                .order('score_date', { ascending: true })
                .limit(1)
                .single()

            if (findOldestError) throw findOldestError

            const { error: deleteError } = await supabase
                .from('scores')
                .delete()
                .eq('id', oldest.id)

            if (deleteError) throw deleteError
        }

        // 4. Insert new score
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

export const updateScore = async (req, res) => {
    try {
        const { id } = req.params
        const { score_value } = req.body
        const userId = req.user.id

        if (!score_value || score_value < 1 || score_value > 45) {
            return res.status(400).json({ error: 'Score must be between 1 and 45.' })
        }

        const { data, error } = await supabase
            .from('scores')
            .update({ score_value })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw error

        res.status(200).json({ message: 'Score updated successfully.', score: data })
    } catch (error) {
        console.error('Update score error:', error)
        res.status(500).json({ error: 'Failed to update score.' })
    }
}

export const deleteScore = async (req, res) => {
    try {
        const { id } = req.params
        const userId = req.user.id

        const { error } = await supabase
            .from('scores')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)

        if (error) throw error

        res.status(200).json({ message: 'Score deleted successfully.' })
    } catch (error) {
        console.error('Delete score error:', error)
        res.status(500).json({ error: 'Failed to delete score.' })
    }
}
