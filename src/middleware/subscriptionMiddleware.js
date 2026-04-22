/**
 * Middleware: Active subscription required.
 * Admins bypass this check automatically.
 * Must be used AFTER protect.
 */
export const subscriberOnly = (req, res, next) => {
    // Admins are exempt from subscription requirements
    if (req.user?.profile?.role === 'admin') return next()

    const subscription = req.user?.subscription

    if (!subscription || subscription.status !== 'active') {
        return res.status(403).json({
            error: 'Subscription required',
            message: 'You must have an active subscription to access this feature.'
        })
    }

    next()
}
