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

        // Map plans to Stripe Price IDs (These should be in .env)
        const priceId = plan === 'yearly' ? process.env.STRIPE_YEARLY_PRICE_ID : process.env.STRIPE_MONTHLY_PRICE_ID

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
            metadata: {
                userId: userId,
                plan: plan
            },
            subscription_data: {
                metadata: {
                    userId: userId
                }
            }
        })

        res.status(200).json({ url: session.url })
    } catch (error) {
        console.error('Create checkout session error:', error)
        res.status(500).json({ error: 'Failed to create checkout session.' })
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

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object
                const userId = session.metadata.userId
                const subscriptionId = session.subscription

                // Update user profile
                await supabase
                    .from('profiles')
                    .update({ 
                        subscription_status: 'active'
                        // plan: session.metadata.plan (Added if needed in schema)
                    })
                    .eq('id', userId)

                // Create subscription record
                const subscription = await stripe.subscriptions.retrieve(subscriptionId)
                await supabase
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        stripe_subscription_id: subscriptionId,
                        plan: session.metadata.plan,
                        status: 'active',
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
                    })
                break
            }
            case 'invoice.paid': {
                const invoice = event.data.object
                if (invoice.subscription) {
                    await supabase
                        .from('subscriptions')
                        .update({ status: 'active' })
                        .eq('stripe_subscription_id', invoice.subscription)
                }
                break
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object
                await supabase
                    .from('profiles')
                    .update({ subscription_status: 'inactive' })
                    .eq('stripe_customer_id', subscription.customer) 
                
                await supabase
                    .from('subscriptions')
                    .update({ status: 'canceled' })
                    .eq('stripe_subscription_id', subscription.id)
                break
            }
        }
        res.json({ received: true })
    } catch (error) {
        console.error('Webhook handling error:', error)
        res.status(500).json({ error: 'Webhook handler failed' })
    }
}
