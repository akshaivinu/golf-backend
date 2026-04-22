import { supabase } from '../configs/supabaseClient.js'

export const uploadProof = async (req, res) => {
    try {
        const { draw_result_id, proof_file_url } = req.body
        const userId = req.user.id

        if (!draw_result_id || !proof_file_url) {
            return res.status(400).json({ error: 'Draw result ID and proof URL are required.' })
        }

        // Verify the draw result belongs to the user
        const { data: drawResult, error: resultError } = await supabase
            .from('draw_results')
            .select('*')
            .eq('id', draw_result_id)
            .eq('user_id', userId)
            .single()

        if (resultError || !drawResult) {
            return res.status(403).json({ error: 'Invalid draw result or access denied.' })
        }

        const { data, error } = await supabase
            .from('winner_verifications')
            .insert({
                draw_result_id,
                proof_file_url,
                admin_status: 'pending'
            })
            .select()
            .single()

        if (error) throw error

        res.status(201).json({
            message: 'Proof uploaded successfully. Admin will review it soon.',
            verification: data
        })

    } catch (error) {
        console.error('Upload proof error:', error)
        res.status(500).json({ error: 'Failed to upload proof.' })
    }
}

export const reviewProof = async (req, res) => {
    try {
        const { id } = req.params // verification id
        const { status, remarks } = req.body // status: 'approved' | 'rejected'
        const adminId = req.user.id

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be approved or rejected.' })
        }

        // Start transaction-like update
        const { data: verification, error: verifyError } = await supabase
            .from('winner_verifications')
            .update({
                admin_status: status,
                reviewed_by: adminId,
                reviewed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single()

        if (verifyError) throw verifyError

        if (status === 'approved') {
            // Update the draw result status
            const { error: resultUpdateError } = await supabase
                .from('draw_results')
                .update({ payment_status: 'paid' }) // Or 'verified', then 'paid' later
                .eq('id', verification.draw_result_id)

            if (resultUpdateError) throw resultUpdateError
        }

        res.status(200).json({
            message: `Proof ${status} successfully.`,
            verification
        })

    } catch (error) {
        console.error('Review proof error:', error)
        res.status(500).json({ error: 'Failed to review proof.' })
    }
}

export const getPendingVerifications = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('winner_verifications')
            .select(`
                *,
                draw_results (
                    user_id,
                    match_count,
                    prize_amount
                )
            `)
            .eq('admin_status', 'pending')
            .order('created_at', { ascending: true })

        if (error) throw error

        res.status(200).json(data)
    } catch (error) {
        console.error('Get pending verifications error:', error)
        res.status(500).json({ error: 'Failed to fetch pending claims.' })
    }
}
