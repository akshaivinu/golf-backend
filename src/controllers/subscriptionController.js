import Stripe from 'stripe'
import { supabase } from '../configs/supabaseClient.js'
import dotenv from 'dotenv'

dotenv.config()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const createCheckoutSession = async (req, res) => {
    try {
        const { plan } = req.body // 'monthly' or 'yearly'
        const userId = req.user.id
        const userEmail = req.user.email

        const priceId = plan === 'yearly'
            ? process.env.STRIPE_YEARLY_PRICE_ID
            : process.env.STRIPE_MONTHLY_PRICE_ID

        if (!priceId) {
            return res.status(400).json({ error: 'Invalid plan or missing price ID in configuration.' })
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/subscribe`,
            customer_email: userEmail,
            metadata: { userId, plan },
            subscription_data: { metadata: { userId } }
        })

        res.status(200).json({ url: session.url })
    } catch (error) {
        console.error('Create checkout session error:', error)
        res.status(500).json({ error: 'Failed to create checkout session.' })
    }
}

export const getSubscriptionStatus = async (req, res) => {
    try {
        const userId = req.user.id

        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

        if (!data) {
            return res.status(200).json({ status: 'none', subscription: null })
        }

        res.status(200).json({
            status: data.status,
            subscription: data
        })
    } catch (error) {
        console.error('Get subscription status error:', error)
        res.status(500).json({ error: 'Failed to fetch subscription status.' })
    }
}

export const cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.id

        // Fetch the active subscription record
        const { data: sub, error: fetchError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()

        if (fetchError || !sub) {
            return res.status(404).json({ error: 'No active subscription found.' })
        }

        // Cancel at period end via Stripe (graceful — user keeps access until period_end)
        await stripe.subscriptions.update(sub.stripe_sub_id, {
            cancel_at_period_end: true
        })

        // Update local record
        const { error: updateError } = await supabase
            .from('subscriptions')
            .update({ status: 'canceling' })
            .eq('id', sub.id)

        if (updateError) throw updateError

        res.status(200).json({
            message: 'Subscription will be canceled at the end of the current billing period.',
            period_end: sub.period_end
        })
    } catch (error) {
        console.error('Cancel subscription error:', error)
        res.status(500).json({ error: 'Failed to cancel subscription.' })
    }
}

export const stripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature']
    let event

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET)
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message)
        return res.status(400).send(`Webhook Error: ${err.message}`)
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object
                const userId = session.metadata.userId
                const subscriptionId = session.subscription

                const subscription = await stripe.subscriptions.retrieve(subscriptionId)
                await supabase
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        stripe_sub_id: subscriptionId,
                        plan: session.metadata.plan,
                        status: 'active',
                        period_end: new Date(subscription.current_period_end * 1000).toISOString()
                    })
                break
            }
            case 'invoice.paid': {
                const invoice = event.data.object
                if (invoice.subscription) {
                    await supabase
                        .from('subscriptions')
                        .update({
                            status: 'active',
                            period_end: new Date(invoice.lines.data[0].period.end * 1000).toISOString()
                        })
                        .eq('stripe_sub_id', invoice.subscription)
                }
                break
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object
                if (invoice.subscription) {
                    await supabase
                        .from('subscriptions')
                        .update({ status: 'past_due' })
                        .eq('stripe_sub_id', invoice.subscription)
                }
                break
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object
                await supabase
                    .from('subscriptions')
                    .update({ status: 'canceled' })
                    .eq('stripe_sub_id', subscription.id)
                break
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object
                // Handle cancel_at_period_end becoming true
                if (subscription.cancel_at_period_end) {
                    await supabase
                        .from('subscriptions')
                        .update({ status: 'canceling' })
                        .eq('stripe_sub_id', subscription.id)
                }
                break
            }
        }
        res.json({ received: true })
    } catch (error) {
        console.error('Webhook handling error:', error)
        res.status(500).json({ error: 'Webhook handler failed' })
    }
}
