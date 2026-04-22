import express from 'express'
import {
    getDashboardStats,
    getRevenueMetrics,
    getAllUsers,
    assignRole,
    suspendUser,
    updateUserByAdmin,
    updateUserScoreByAdmin
} from '../controllers/adminController.js'
import { protect, adminOnly } from '../middleware/authMiddleware.js'
import { validateRole } from '../middleware/validationMiddleware.js'

const router = express.Router()

// All admin routes require authentication AND admin role
router.use(protect)
router.use(adminOnly)

// Analytics
router.get('/stats', getDashboardStats)
router.get('/analytics/revenue', getRevenueMetrics)

// User management
router.get('/users', getAllUsers)
router.put('/users/:id', updateUserByAdmin)
router.put('/users/:id/role', validateRole, assignRole)
router.put('/users/:id/suspend', suspendUser)

// Score overrides
router.put('/scores/:scoreId', updateUserScoreByAdmin)

export default router
