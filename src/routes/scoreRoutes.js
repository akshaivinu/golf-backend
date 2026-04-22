import express from 'express'
import { addScore, getScores, updateScore, deleteScore } from '../controllers/scoreController.js'
import { protect } from '../middleware/authMiddleware.js'
import { subscriberOnly } from '../middleware/subscriptionMiddleware.js'

const router = express.Router()

router.use(protect) // All score routes require authentication

router.post('/', subscriberOnly, addScore)
router.get('/', getScores)
router.put('/:id', updateScore)
router.delete('/:id', deleteScore)

export default router
