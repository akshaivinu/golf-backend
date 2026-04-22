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
        if (charity_percentage < 10) {
            return res.status(400).json({ error: 'Charity percentage must be at least 10%.' })
        }

        const { data, error } = await supabase
            .from('users')
            .update({
                charity_id: charity_id,
                charity_percentage: charity_percentage
            })
            .eq('id', userId)
            .select()
            .single()

        if (error) throw error

        res.status(200).json({
            message: 'Charity preference updated successfully.',
            user: data
        })

    } catch (error) {
        console.error('Update charity error:', error)
        res.status(500).json({ error: 'Failed to update charity preference.' })
    }
}

import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ... existing exports (getCharities, updateUserCharity) ...

export const getCharityStats = async (req, res) => {
    try {
        const { id } = req.params
        const { data, error } = await supabase
            .from('charities')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error
        res.status(200).json(data)
    } catch (error) {
        console.error('Fetch charity stats error:', error)
        res.status(500).json({ error: 'Failed to fetch charity profile.' })
    }
}

export const createDonationSession = async (req, res) => {
    try {
        const { charity_id, amount } = req.body
        const userId = req.user?.id
        
        // 1. Get charity info
        const { data: charity } = await supabase
            .from('charities')
            .select('name')
            .eq('id', charity_id)
            .single()

        // 2. Create Stripe Checkout Session (One-time)
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Direct Donation to ${charity?.name || 'Charity Partner'}`,
                    },
                    unit_amount: amount * 100, // cents
                },
                quantity: 1,
            }],
            mode: 'payment', // One-time payment
            success_url: `${process.env.FRONTEND_URL}/charities/${charity_id}?success=true`,
            cancel_url: `${process.env.FRONTEND_URL}/charities/${charity_id}`,
            metadata: {
                charity_id,
                userId: userId || 'anonymous',
                type: 'direct_donation'
            }
        })

        res.status(200).json({ url: session.url })
    } catch (error) {
        console.error('Create donation error:', error)
        res.status(500).json({ error: 'Failed to initiate donation.' })
    }
}

// ADMIN CRUD
export const addCharity = async (req, res) => {
    try {
        const { name, description, is_featured } = req.body
        const { data, error } = await supabase
            .from('charities')
            .insert({ name, description, is_featured })
            .select()
            .single()

        if (error) throw error
        res.status(201).json(data)
    } catch (error) {
        res.status(500).json({ error: 'Failed to add charity.' })
    }
}

export const updateCharity = async (req, res) => {
    try {
        const { id } = req.params
        const updates = req.body
        const { data, error } = await supabase
            .from('charities')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        res.status(200).json(data)
    } catch (error) {
        res.status(500).json({ error: 'Failed to update charity.' })
    }
}

export const deleteCharity = async (req, res) => {
    try {
        const { id } = req.params
        const { error } = await supabase
            .from('charities')
            .delete()
            .eq('id', id)

        if (error) throw error
        res.status(200).json({ message: 'Charity deleted successfully.' })
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete charity.' })
    }
}
