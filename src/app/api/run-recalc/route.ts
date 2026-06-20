import { NextResponse } from 'next/server'
import { recalculateAllUsers } from '../admin/recalculate/route'

export async function GET() {
    const result = await recalculateAllUsers()
    return NextResponse.json(result)
}
