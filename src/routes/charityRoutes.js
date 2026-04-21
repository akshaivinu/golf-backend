import express from 'express'
import { getCharities, updateUserCharity, getCharityStats } from '../controllers/charityController.js'
import { protect } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', getCharities)
router.get('/:id', getCharityStats)
router.put('/select', protect, updateUserCharity)

export default router
