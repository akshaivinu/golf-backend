import express from 'express'
import { createCheckoutSession, stripeWebhook } from '../controllers/subscriptionController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/create-checkout', protect, createCheckoutSession)
// Webhook route is handled separately in server.js for raw body access

export default router
export { stripeWebhook }
