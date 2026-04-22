import express from 'express'
import { getCharities, updateUserCharity, getCharityStats, addCharity, updateCharity, deleteCharity, createDonationSession } from '../controllers/charityController.js'
import { protect, adminOnly } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', getCharities)
router.get('/:id', getCharityStats)
router.put('/me/preference', protect, updateUserCharity)
router.post('/donate', createDonationSession)

// ADMIN CRUD
router.post('/', protect, adminOnly, addCharity)
router.put('/:id', protect, adminOnly, updateCharity)
router.delete('/:id', protect, adminOnly, deleteCharity)

export default router
