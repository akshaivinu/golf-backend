import express from 'express'
import { simulateDraw, publishDraw, getActiveDraw, getAllDraws } from '../controllers/drawController.js'
import { protect, adminOnly } from '../middleware/authMiddleware.js'

const router = express.Router()

router.get('/', protect, getAllDraws)
router.get('/active', protect, getActiveDraw)
router.post('/simulate', protect, adminOnly, simulateDraw)
router.post('/publish', protect, adminOnly, publishDraw)

export default router
