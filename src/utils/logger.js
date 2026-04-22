/**
 * UX-Friendly Backend Logger
 * Purpose: Categorize platform errors and provide user-friendly masks 
 * for frontend display while maintaining detailed server-side logs.
 */

const LOG_LEVELS = {
    INFO: '🔵 INFO',
    WARN: '🟡 WARN',
    ERROR: '🔴 ERROR',
    IMPACT: '💎 IMPACT',
    SIMULATION: '🧪 SIM'
};

const logger = {
    format: (level, message, context = {}) => {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] ${level}: ${message} ${Object.keys(context).length ? JSON.stringify(context) : ''}`;
    },

    info: (msg, ctx) => console.log(logger.format(LOG_LEVELS.INFO, msg, ctx)),
    warn: (msg, ctx) => console.warn(logger.format(LOG_LEVELS.WARN, msg, ctx)),
    error: (msg, ctx) => console.error(logger.format(LOG_LEVELS.ERROR, msg, ctx)),
    impact: (msg, ctx) => console.log(logger.format(LOG_LEVELS.IMPACT, msg, ctx)),
    simulation: (msg, ctx) => console.log(logger.format(LOG_LEVELS.SIMULATION, msg, ctx)),

    /**
     * Converts raw system/db errors into "UX Friendly" messages 
     * defined in Section 13 of the PRD.
     */
    toUserFriendly: (error) => {
        if (error.code === '23505') {
            return "You've already logged a score for this date. Would you like to edit it instead?";
        }
        if (error.status === 403) {
            return "This feature is reserved for our Impact Subscribers. Join a plan to continue.";
        }
        if (error.message?.includes('Stableford')) {
            return "Scores must be between 1 and 45. Please verify your scorecard.";
        }
        return "Something went wrong on our end. We're on it!";
    }
};

export default logger;
