import express from 'express'
import { uploadProof, reviewProof } from '../controllers/verificationController.js'
import { protect, adminOnly } from '../middleware/authMiddleware.js'

const router = express.Router()

router.post('/upload', protect, uploadProof)
router.put('/review/:id', protect, adminOnly, reviewProof)

export default router
