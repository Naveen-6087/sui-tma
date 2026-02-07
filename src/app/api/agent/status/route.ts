/**
 * GET /api/agent/status
 * 
 * Checks the status of a swap using the deposit address.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNearIntentsAPI } from '@/lib/near-intents-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const depositAddress = searchParams.get('depositAddress');

    if (!depositAddress) {
      return NextResponse.json(
        { error: 'depositAddress query parameter is required' },
        { status: 400 }
      );
    }

    const api = getNearIntentsAPI();
    const status = await api.getStatus(depositAddress);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
