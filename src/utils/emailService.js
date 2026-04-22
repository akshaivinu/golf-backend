import nodemailer from 'nodemailer';
import logger from './logger.js';

/**
 * Section 12: Email Notification System
 * Handles winner alerts, draw results, and system updates.
 */

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export const sendWinnerEmail = async (email, matchCount, amount) => {
    try {
        const mailOptions = {
            from: '"Digital Heroes" <no-reply@digitalheroes.com>',
            to: email,
            subject: '🏆 WINNER ALERT: Your Prosperity Awaits!',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 40px; background: #0A0F0D; color: #F8FAFC; border-radius: 20px;">
                    <h1 style="color: #D4AF37; text-transform: uppercase; letter-spacing: 2px;">Congratulations!</h1>
                    <p style="font-size: 18px; line-height: 1.6;">
                        You've matched <strong>${matchCount} out of 5</strong> numbers in this month's draw.
                    </p>
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10B981; padding: 20px; border-radius: 12px; margin: 30px 0; text-align: center;">
                        <p style="text-transform: uppercase; font-size: 10px; color: #10B981; margin: 0;">Your Estimated Prize</p>
                        <h2 style="font-size: 40px; margin: 5px 0;">$${amount.toLocaleString()}</h2>
                    </div>
                    <p style="color: #94A3B8; font-size: 14px;">
                        To claim your prize, please log in to your dashboard and upload your scorecard proof within 48 hours.
                    </p>
                    <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #D4AF37; color: #0A0F0D; padding: 15px 30px; border-radius: 10px; font-weight: bold; text-decoration: none; margin-top: 20px;">
                        Access Dashboard
                    </a>
                    <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 40px 0;">
                    <p style="font-size: 10px; color: #475569; text-transform: uppercase;">
                        Your participation this month fueled a 10% contribution to our charity partners. Thank you for making an impact.
                    </p>
                </div>
            `
        };

        if (process.env.NODE_ENV === 'production' || process.env.SMTP_USER) {
            await transporter.sendMail(mailOptions);
            logger.info(`Winner email sent to ${email}`);
        } else {
            logger.info(`[SIMULATION] Winner email would be sent to ${email} for $${amount}`);
        }
    } catch (error) {
        logger.error('Failed to send winner email', { error: error.message, email });
    }
}

export const sendSystemUpdate = async (email, title, message) => {
    // Similar logic for system updates...
}
