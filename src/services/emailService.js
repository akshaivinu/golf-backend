import { Resend } from 'resend'
import dotenv from 'dotenv'

dotenv.config()
const resend = new Resend(process.env.RESEND_API_KEY)

export const sendWinnerEmail = async (userEmail, matchCount, prizeAmount) => {
    try {
        if (!process.env.RESEND_API_KEY) {
            console.warn('RESEND_API_KEY is not set. Skipping email.')
            return
        }

        const { data, error } = await resend.emails.send({
            from: 'Golf Lotto <noreply@golf-lotto.com>',
            to: [userEmail],
            subject: `Congratulations! You matched ${matchCount} numbers!`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h1 style="color: #2c3e50;">You Won!</h1>
                    <p>Dear Member,</p>
                    <p>We are thrilled to inform you that you matched <strong>${matchCount} numbers</strong> in the latest Golf Lotto draw!</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                        <span style="font-size: 1.2em; color: #27ae60;">Estimated Prize:</span>
                        <h2 style="margin: 10px 0; font-size: 2.5em; color: #2ecc71;">$${prizeAmount.toFixed(2)}</h2>
                    </div>
                    <p>To claim your prize, please log in to the dashboard and upload your identification for verification.</p>
                    <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: #3498db; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-top: 10px;">Go to Dashboard</a>
                    <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="font-size: 0.8em; color: #7f8c8d;">Good luck with your future scores!</p>
                </div>
            `
        })

        if (error) throw error
        return data
    } catch (error) {
        console.error('Failed to send winner email:', error)
    }
}
