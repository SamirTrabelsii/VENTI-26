import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helper to fetch all rows for a given query, bypassing Supabase's default 1000 row limit.
 * 
 * @param query The base Supabase select query (e.g. `supabase.from('profiles').select('id, name')`)
 * @returns All matched rows as an array
 */
export async function fetchAllRows(query: any): Promise<any[]> {
    const allData: any[] = []
    let hasMore = true
    let start = 0
    while (hasMore) {
        // Create a new instance of the query with range applied
        const { data, error } = await query.range(start, start + 999)
        
        if (error) {
            console.error('Error fetching paginated rows:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
            })
            throw error
        }

        if (data && data.length > 0) {
            allData.push(...data)
            start += 1000
            if (data.length < 1000) hasMore = false
        } else {
            hasMore = false
        }
    }
    return allData
}
