/**
 * Centralized input validation/sanitization helpers.
 * These middleware functions validate specific request bodies
 * and prevent arbitrary field injection on sensitive routes.
 */

/**
 * Validate score submission body.
 * Allowed: score_value (1–45), score_date (YYYY-MM-DD)
 */
export const validateScore = (req, res, next) => {
    const { score_value, score_date } = req.body

    if (score_value === undefined || score_value === null) {
        return res.status(400).json({ error: 'score_value is required.' })
    }

    const val = Number(score_value)
    if (!Number.isInteger(val) || val < 1 || val > 45) {
        return res.status(400).json({ error: 'score_value must be an integer between 1 and 45.' })
    }

    if (!score_date) {
        return res.status(400).json({ error: 'score_date is required.' })
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(score_date) || isNaN(Date.parse(score_date))) {
        return res.status(400).json({ error: 'score_date must be a valid date in YYYY-MM-DD format.' })
    }

    // Sanitize body — only pass through allowed fields
    req.body = { score_value: val, score_date }

    next()
}

/**
 * Validate charity body.
 * Allowed: name, description, tagline, imageUrl, is_featured
 */
export const validateCharity = (req, res, next) => {
    const { name, description, tagline, imageUrl, is_featured } = req.body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Charity name is required.' })
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ error: 'Charity description is required.' })
    }

    // Sanitize body
    req.body = {
        name: name.trim(),
        description: description.trim(),
        ...(tagline && { tagline: String(tagline).trim() }),
        ...(imageUrl && { images: [String(imageUrl).trim()] }),
        ...(is_featured !== undefined && { is_featured: is_featured === 'true' || is_featured === true })
    }

    next()
}

/**
 * Validate role assignment body.
 * Allowed roles: 'subscriber', 'admin', 'suspended'
 */
export const validateRole = (req, res, next) => {
    const { role } = req.body
    const VALID_ROLES = ['subscriber', 'admin', 'suspended']

    if (!role || !VALID_ROLES.includes(role)) {
        return res.status(400).json({
            error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
        })
    }

    req.body = { role }
    next()
}
