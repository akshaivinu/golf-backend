export const subscriberOnly = (req, res, next) => {
    const profile = req.user?.profile;
    
    if (!profile || profile.subscription_status !== 'active') {
        return res.status(403).json({ 
            error: 'Subscription required', 
            message: 'You must have an active subscription to perform this action.' 
        })
    }
    
    next()
}
