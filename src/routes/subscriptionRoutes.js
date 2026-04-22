import express from 'express'
import {
    createCheckoutSession,
    getSubscriptionStatus,
    cancelSubscription,
    stripeWebhook
} from '../controllers/subscriptionController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/create-checkout', protect, createCheckoutSession)
router.get('/status', protect, getSubscriptionStatus)
router.post('/cancel', protect, cancelSubscription)

// Webhook route is handled separately in server.js for raw body access
export default router
export { stripeWebhook }
