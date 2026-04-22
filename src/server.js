import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { supabase } from './configs/supabaseClient.js'

// Import Routes
import scoreRoutes from './routes/scoreRoutes.js'
import drawRoutes from './routes/drawRoutes.js'
import charityRoutes from './routes/charityRoutes.js'
import subscriptionRoutes, { stripeWebhook } from './routes/subscriptionRoutes.js'
import verificationRoutes from './routes/verificationRoutes.js'
import adminRoutes from './routes/adminRoutes.js'


const app = express()

// Middleware
app.use(helmet())
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}))

// Stripe Webhook (MUST come before express.json() for raw body)
app.post('/api/subscriptions/webhook', express.raw({ type: 'application/json' }), stripeWebhook)

app.use(express.json())
app.use(cookieParser())

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Routes
app.use('/api/scores', scoreRoutes)
app.use('/api/draws', drawRoutes)
app.use('/api/charities', charityRoutes)
app.use('/api/subscriptions', subscriptionRoutes)
app.use('/api/verify', verificationRoutes)
app.use('/api/admin', adminRoutes)

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})

export default app