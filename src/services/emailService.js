import { Resend } from 'resend'
import dotenv from 'dotenv'

dotenv.config()
const resend = new Resend(process.env.RESEND_API_KEY)

export const sendWelcomeEmail = async (userEmail, name, charityName) => {
    try {
        await resend.emails.send({
            from: 'Golf Lotto <noreply@golflotto.com>',
            to: userEmail,
            subject: 'Welcome to Golf Lotto!',
            html: `<h1>Welcome, ${name}!</h1><p>You're now playing to win and supporting <strong>${charityName}</strong>. Log your scores to enter the next draw!</p>`
        })
    } catch (error) {
        console.error('Welcome email failed:', error)
    }
}

export const sendWinnerAlert = async (userEmail, prizeAmount) => {
    try {
        await resend.emails.send({
            from: 'Golf Lotto <winners@golflotto.com>',
            to: userEmail,
            subject: "You're a Winner!",
            html: `<h1>Congratulations!</h1><p>You matched the numbers in this month's draw. Your estimated prize is <strong>$${prizeAmount}</strong>. Please log in to upload your proof and claim your prize.</p>`
        })
    } catch (error) {
        console.error('Winner alert failed:', error)
    }
}

export const sendDrawPublished = async (userEmail, drawDate) => {
    try {
        await resend.emails.send({
            from: 'Golf Lotto <noreply@golflotto.com>',
            to: userEmail,
            subject: 'Draw Results are Live!',
            html: `<p>The results for the ${drawDate} draw have been published. Check your dashboard to see if you've won!</p>`
        })
    } catch (error) {
        console.error('Draw published email failed:', error)
    }
}
