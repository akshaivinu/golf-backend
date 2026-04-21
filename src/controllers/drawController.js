import { supabase } from '../configs/supabaseClient.js'

// Helper to calculate match counts for a user
const getMatchCount = (userScores, winningNumbers) => {
    // winningNumbers is an array of 5 integers
    // userScores is an array of up to 5 score_value integers
    let matches = 0
    const winningSet = new Set(winningNumbers)
    
    userScores.forEach(score => {
        if (winningSet.has(score.score_value)) {
            matches++
        }
    })
    
    return matches
}

export const simulateDraw = async (req, res) => {
    try {
        const { drawn_numbers, fixed_per_user = 10 } = req.body // Assume $10 goes to pool per user

        if (!drawn_numbers || drawn_numbers.length !== 5) {
            return res.status(400).json({ error: 'Exactly 5 winning numbers are required.' })
        }

        // 1. Get all active subscribers from Profiles
        const { data: activeUsers, error: userError } = await supabase
            .from('profiles')
            .select('id, subscription_status')
            .eq('subscription_status', 'active')

        if (userError) throw userError

        const totalActive = activeUsers.length
        const totalPool = totalActive * fixed_per_user

        // 2. Fetch all scores for these users
        const { data: allScores, error: scoreError } = await supabase
            .from('scores')
            .select('user_id, score_value')
            .in('user_id', activeUsers.map(u => u.id))

        if (scoreError) throw scoreError

        // Group scores by user
        const userScoresMap = {}
        allScores.forEach(s => {
            if (!userScoresMap[s.user_id]) userScoresMap[s.user_id] = []
            userScoresMap[s.user_id].push(s)
        })

        // 3. Calculate matches
        const results = {
            fiveMatches: [],
            fourMatches: [],
            threeMatches: []
        }

        activeUsers.forEach(user => {
            const userScores = userScoresMap[user.id] || []
            const matchCount = getMatchCount(userScores, drawn_numbers)

            if (matchCount === 5) results.fiveMatches.push(user)
            else if (matchCount === 4) results.fourMatches.push(user)
            else if (matchCount === 3) results.threeMatches.push(user)
        })

        // 4. Calculate prize splits
        const pools = {
            total: totalPool,
            five: totalPool * 0.40,
            four: totalPool * 0.35,
            three: totalPool * 0.25
        }

        const splits = {
            fivePerPerson: results.fiveMatches.length > 0 ? pools.five / results.fiveMatches.length : 0,
            fourPerPerson: results.fourMatches.length > 0 ? pools.four / results.fourMatches.length : 0,
            threePerPerson: results.threeMatches.length > 0 ? pools.three / results.threeMatches.length : 0
        }

        res.status(200).json({
            drawn_numbers,
            metrics: {
                totalActiveSubscribers: totalActive,
                totalPool,
            },
            pools,
            splits,
            winners: {
                count5: results.fiveMatches.length,
                count4: results.fourMatches.length,
                count3: results.threeMatches.length
            },
            simulation: true
        })

    } catch (error) {
        console.error('Simulate draw error:', error)
        res.status(500).json({ error: 'Failed to simulate draw.' })
    }
}

export const publishDraw = async (req, res) => {
    try {
        const { drawn_numbers, draw_type = 'random', fixed_per_user = 10 } = req.body

        if (!drawn_numbers || drawn_numbers.length !== 5) {
            return res.status(400).json({ error: 'Exactly 5 winning numbers are required.' })
        }

        // 1. Get all active subscribers from Profiles
        const { data: activeUsers, error: userError } = await supabase
            .from('profiles')
            .select('id, email, subscription_status')
            .eq('subscription_status', 'active')

        if (userError) throw userError

        const totalActive = activeUsers.length
        const totalPool = totalActive * fixed_per_user

        // 2. Fetch all scores for these users
        const { data: allScores, error: scoreError } = await supabase
            .from('scores')
            .select('user_id, score_value')
            .in('user_id', activeUsers.map(u => u.id))

        if (scoreError) throw scoreError

        const userScoresMap = {}
        allScores.forEach(s => {
            if (!userScoresMap[s.user_id]) userScoresMap[s.user_id] = []
            userScoresMap[s.user_id].push(s)
        })

        // 3. Create the Draw record
        const now = new Date()
        const { data: draw, error: drawInsertError } = await supabase
            .from('draws')
            .insert({
                drawn_numbers,
                draw_type,
                status: 'published',
                total_pool: totalPool,
                draw_month: now.getMonth() + 1,
                draw_year: now.getFullYear()
            })
            .select()
            .single()

        if (drawInsertError) throw drawInsertError

        // 4. Calculate matches and per-tier winners
        const winners = []
        const counts = { 5: 0, 4: 0, 3: 0 }
        
        activeUsers.forEach(user => {
            const userScores = userScoresMap[user.id] || []
            const matchCount = getMatchCount(userScores, drawn_numbers)

            if (matchCount >= 3) {
                winners.push({
                    draw_id: draw.id,
                    user_id: user.id,
                    match_count: matchCount,
                    payment_status: 'pending'
                })
                counts[matchCount]++
            }
        })

        // 5. Calculate tiers
        const pools = {
            five: totalPool * 0.40,
            four: totalPool * 0.35,
            three: totalPool * 0.25
        }

        // Assign prize amounts to winners
        winners.forEach(w => {
            w.prize_amount = pools[w.match_count === 5 ? 'five' : w.match_count === 4 ? 'four' : 'three'] / counts[w.match_count]
        })

        // 6. Bulk Insert Results
        if (winners.length > 0) {
            const { error: resultsError } = await supabase
                .from('draw_results')
                .insert(winners)
            
            if (resultsError) throw resultsError
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
                jackpot_carried_forward: counts[5] === 0,
                jackpot_amount: counts[5] === 0 ? pools.five : 0
            })

        if (poolError) throw poolError

        res.status(201).json({
            message: 'Draw published successfully.',
            draw_id: draw.id,
            winners_count: winners.length,
            jackpot_rollover: counts[5] === 0
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

        // Handle case where no draw exists yet
        if (drawError && drawError.code !== 'PGRST116') throw drawError

        // 2. Get User Profile & Charity
        let profile = null
        if (userId) {
            const { data, error: profileError } = await supabase
                .from('profiles')
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
                .eq('is_active', true)
                .limit(5)
            
            if (scoreError) throw scoreError
            matchCount = getMatchCount(userScores || [], latestDraw.drawn_numbers || [])
        }

        // 4. Construct Response
        res.status(200).json({
            matches: matchCount,
            estimatedPrize: latestDraw ? (latestDraw.total_pool || 0) * 0.4 : 0, // Example logic
            userCharityTotal: profile ? profile.total_impact || 0 : 0,
            charityName: profile?.charities?.name || "None Selected",
            subscriptionStatus: profile?.subscription_status || "inactive",
            totalPool: latestDraw?.total_pool || 0
        })

    } catch (error) {
        console.error('Get active draw error:', error)
        res.status(500).json({ error: 'Failed to fetch draw status.' })
    }
}
