import { supabase } from '../configs/supabaseClient.js'
import { sendWinnerEmail } from '../utils/emailService.js'

// Helper to calculate match counts for a user
const getMatchCount = (userScores, winningNumbers) => {
    let matches = 0
    const winningSet = new Set(winningNumbers)
    userScores.forEach(score => {
        if (winningSet.has(score.score_value)) {
            matches++
        }
    })
    return matches
}

// Hybrid Algorithm: Generates 5 numbers
// 2 numbers from least frequent (protects jackpot)
// 3 numbers from most frequent (ensures lower tier wins)
const calculateHybridNumbers = (allScores) => {
    const freqMap = {}
    for (let i = 1; i <= 45; i++) freqMap[i] = 0
    allScores.forEach(s => {
        if (freqMap[s.score_value] !== undefined) freqMap[s.score_value]++
    })

    const sorted = Object.entries(freqMap)
        .map(([val, count]) => ({ val: parseInt(val), count }))
        .sort((a, b) => a.count - b.count)

    const leastFrequent = sorted.slice(0, 15).map(x => x.val)
    const mostFrequent = sorted.slice(-15).map(x => x.val).reverse()

    const results = new Set()
    
    // Pick 2 from least frequent
    while (results.size < 2) {
        results.add(leastFrequent[Math.floor(Math.random() * leastFrequent.length)])
    }
    
    // Pick 3 from most frequent
    while (results.size < 5) {
        const num = mostFrequent[Math.floor(Math.random() * mostFrequent.length)]
        if (!results.has(num)) results.add(num)
    }

    return Array.from(results)
}

export const simulateDraw = async (req, res) => {
    try {
        let { drawn_numbers, draw_type = 'random', fixed_per_user = 10 } = req.body

        // 1. Get all active subscribers
        const { data: activeUsers, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('id', 'some-logic-to-check-auth-users-active-sub') // Placeholder for complex join
            // Actually, let's use the profiles/users logic from schema
        
        const { data: subscribers, error: subError } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('status', 'active')

        if (subError) throw subError
        const activeUserIds = subscribers.map(s => s.user_id)
        const totalActive = activeUserIds.length
        const totalPool = totalActive * fixed_per_user

        // 2. Fetch all scores for these users
        const { data: allScores, error: scoreError } = await supabase
            .from('scores')
            .select('user_id, score_value')
            .in('user_id', activeUserIds)

        if (scoreError) throw scoreError

        if (draw_type === 'algorithmic') {
            drawn_numbers = calculateHybridNumbers(allScores)
        }

        if (!drawn_numbers || drawn_numbers.length !== 5) {
            return res.status(400).json({ error: 'Exactly 5 winning numbers are required for manual mode, or use algorithmic.' })
        }

        // Group scores by user
        const userScoresMap = {}
        allScores.forEach(s => {
            if (!userScoresMap[s.user_id]) userScoresMap[s.user_id] = []
            userScoresMap[s.user_id].push(s)
        })

        // 3. Calculate matches
        const results = { count5: 0, count4: 0, count3: 0 }
        activeUserIds.forEach(id => {
            const userScores = userScoresMap[id] || []
            const matchCount = getMatchCount(userScores, drawn_numbers)
            if (matchCount === 5) results.count5++
            else if (matchCount === 4) results.count4++
            else if (matchCount === 3) results.count3++
        })

        // 4. Calculate rollover (Simulation)
        const { data: lastPool } = await supabase
            .from('prize_pool')
            .select('jackpot_amount')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        const carriedForward = lastPool?.jackpot_amount || 0
        const pools = {
            total: totalPool,
            five: (totalPool * 0.40) + carriedForward,
            four: totalPool * 0.35,
            three: totalPool * 0.25
        }

        res.status(200).json({
            drawn_numbers,
            metrics: { totalActive, totalPool, carriedForward },
            pools,
            winners: results,
            simulation: true
        })

    } catch (error) {
        console.error('Simulate draw error:', error)
        res.status(500).json({ error: 'Failed to simulate draw.' })
    }
}

export const publishDraw = async (req, res) => {
    try {
        let { drawn_numbers, draw_type = 'random', fixed_per_user = 10 } = req.body

        // 1. Get active subscribers
        const { data: subscribers, error: subError } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('status', 'active')

        if (subError) throw subError
        const activeUserIds = subscribers.map(s => s.user_id)
        const totalActive = activeUserIds.length
        const totalPool = totalActive * fixed_per_user

        // 2. Fetch all scores
        const { data: allScores, error: scoreError } = await supabase
            .from('scores')
            .select('user_id, score_value')
            .in('user_id', activeUserIds)

        if (scoreError) throw scoreError

        if (draw_type === 'algorithmic') {
            drawn_numbers = calculateHybridNumbers(allScores)
        }

        // Check for existing draw this month
        const firstDayOfMonth = new Date()
        firstDayOfMonth.setDate(1)
        firstDayOfMonth.setHours(0, 0, 0, 0)

        const { data: existingMonthDraw, error: monthCheckError } = await supabase
            .from('draws')
            .select('id')
            .gte('draw_date', firstDayOfMonth.toISOString().split('T')[0])
            .eq('status', 'published')
            .limit(1)

        if (existingMonthDraw && existingMonthDraw.length > 0) {
            return res.status(400).json({ error: 'A draw has already been published for this month.' })
        }

        // 3. Create the Draw record
        const { data: draw, error: drawInsertError } = await supabase
            .from('draws')
            .insert({
                drawn_numbers,
                draw_type,
                status: 'published',
                draw_date: new Date().toISOString().split('T')[0]
            })
            .select()
            .single()

        if (drawInsertError) throw drawInsertError

        // 4. Calculate matches
        const userScoresMap = {}
        allScores.forEach(s => {
            if (!userScoresMap[s.user_id]) userScoresMap[s.user_id] = []
            userScoresMap[s.user_id].push(s)
        })

        const winners = []
        const counts = { 5: 0, 4: 0, 3: 0 }
        
        activeUserIds.forEach(id => {
            const userScores = userScoresMap[id] || []
            const matchCount = getMatchCount(userScores, drawn_numbers)
            if (matchCount >= 3) {
                winners.push({
                    draw_id: draw.id,
                    user_id: id,
                    match_count: matchCount,
                    payment_status: 'pending'
                })
                counts[matchCount]++
            }
        })

        // 5. Calculate tiers with Rollover
        const { data: lastPool } = await supabase
            .from('prize_pool')
            .select('jackpot_amount')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        const carriedForward = lastPool?.jackpot_amount || 0
        const pools = {
            five: (totalPool * 0.40) + carriedForward,
            four: totalPool * 0.35,
            three: totalPool * 0.25
        }

        // Assign prize amounts
        winners.forEach(w => {
            w.prize_amount = pools[w.match_count === 5 ? 'five' : w.match_count === 4 ? 'four' : 'three'] / counts[w.match_count]
        })

        // 6. Bulk Insert Results
        if (winners.length > 0) {
            const { error: resultsError } = await supabase.from('draw_results').insert(winners)
            if (resultsError) throw resultsError

            // Send Emails to winners
            const { data: userData } = await supabase
                .from('users')
                .select('id, email')
                .in('id', winners.map(w => w.user_id))
            
            const userEmailMap = userData.reduce((acc, u) => ({ ...acc, [u.id]: u.email }), {})
            
            // Note: In production, use a queue for large numbers of emails
            for (const winner of winners) {
                const email = userEmailMap[winner.user_id]
                if (email) {
                    await sendWinnerEmail(email, winner.match_count, winner.prize_amount)
                }
            }
        }

        // 7. Create Prize Pool record
        const { error: poolError } = await supabase
            .from('prize_pool')
            .insert({
                draw_id: draw.id,
                total_pool: totalPool,
                five_match_pool: pools.five,
                four_match_pool: pools.four,
                three_match_pool: pools.three,
                jackpot_carried_forward: carriedForward,
                jackpot_rollover: counts[5] === 0,
                jackpot_amount: counts[5] === 0 ? pools.five : 0
            })

        if (poolError) throw poolError

        res.status(201).json({
            message: 'Draw published successfully.',
            draw_id: draw.id,
            winners_count: winners.length,
            jackpot_rollover: counts[5] === 0,
            jackpot_amount: counts[5] === 0 ? pools.five : 0
        })

    } catch (error) {
        console.error('Publish draw error:', error)
        res.status(500).json({ error: 'Failed to publish draw.' })
    }
}

export const getActiveDraw = async (req, res) => {
    try {
        const userId = req.user?.id

        // 1. Get the latest published draw
        const { data: latestDraw, error: drawError } = await supabase
            .from('draws')
            .select('*')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (drawError && drawError.code !== 'PGRST116') throw drawError

        // 2. Get User Profile & Charity
        let profile = null
        if (userId) {
            const { data, error: profileError } = await supabase
                .from('users')
                .select('*, charities(name)')
                .eq('id', userId)
                .single()
            if (profileError && profileError.code !== 'PGRST116') throw profileError
            profile = data
        }

        // 3. Get User Scores & Calculate Matches
        let matchCount = 0
        if (userId && latestDraw) {
            const { data: userScores, error: scoreError } = await supabase
                .from('scores')
                .select('score_value')
                .eq('user_id', userId)
                .limit(5)
            
            if (scoreError) throw scoreError
            matchCount = getMatchCount(userScores || [], latestDraw.drawn_numbers || [])
        }

        // 4. Calculate Participation & Winnings
        const { data: winHistory } = await supabase
            .from('draw_results')
            .select(`
                prize_amount,
                payment_status,
                winner_verifications (admin_status)
            `)
            .eq('user_id', userId)

        const totalWon = winHistory?.reduce((sum, w) => sum + (w.payment_status === 'paid' ? w.prize_amount : 0), 0) || 0
        const pendingWinnings = winHistory?.reduce((sum, w) => sum + (w.payment_status === 'pending' ? w.prize_amount : 0), 0) || 0
        
        // 5. Next Draw Date
        const nextDraw = new Date()
        nextDraw.setMonth(nextDraw.getMonth() + 1)
        nextDraw.setDate(1)

        // 6. Get Latest Prize Pool for Jackpot
        const { data: pool } = await supabase
            .from('prize_pool')
            .select('five_match_pool, jackpot_amount')
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        // 7. Construct Response
        res.status(200).json({
            matches: matchCount,
            jackpot: pool ? (pool.jackpot_amount || pool.five_match_pool || 0) : 0,
            userCharityTotal: profile ? profile.total_impact || 0 : 0,
            charityName: profile?.charities?.name || "None Selected",
            charityPercentage: profile?.charity_percentage || 10,
            subscriptionStatus: profile?.subscriptions?.[0]?.status || "inactive",
            renewalDate: profile?.subscriptions?.[0]?.period_end || "2024-05-01",
            activeNumbers: latestDraw?.drawn_numbers || [],
            participation: {
                totalWon,
                pendingWinnings,
                drawsEntered: winHistory?.length || 0,
                nextDrawDate: nextDraw.toISOString().split('T')[0]
            }
        })

    } catch (error) {
        console.error('Get active draw error:', error)
        res.status(500).json({ error: 'Failed to fetch draw status.' })
    }
}

export const getAllDraws = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('draws')
            .select('*')
            .order('draw_date', { ascending: false })

        if (error) throw error
        res.status(200).json(data)
    } catch (error) {
        console.error('Get all draws error:', error)
        res.status(500).json({ error: 'Failed to fetch draws.' })
    }
}
