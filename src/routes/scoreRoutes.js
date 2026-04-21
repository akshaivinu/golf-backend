import express from 'express'
import { addScore, getScores } from '../controllers/scoreController.js'
import { protect } from '../middleware/authMiddleware.js'
import { subscriberOnly } from '../middleware/subscriptionMiddleware.js'

const router = express.Router()

router.use(protect) // All score routes require authentication

router.post('/', subscriberOnly, addScore)
router.get('/', getScores)

export default router
