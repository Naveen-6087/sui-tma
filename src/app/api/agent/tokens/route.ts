/**
 * GET /api/agent/tokens
 * 
 * Fetches available tokens from the NEAR Intents 1-Click API.
 * Supports optional chain filter via query parameter.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNearIntentsAPI } from '@/lib/near-intents-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chain = searchParams.get('chain');
    const symbol = searchParams.get('symbol');

    const api = getNearIntentsAPI();

    if (symbol) {
      const tokens = await api.searchTokens(symbol, chain || undefined);
      return NextResponse.json({ tokens, count: tokens.length });
    }

    if (chain) {
      const tokens = await api.getTokensByChain(chain);
      return NextResponse.json({ tokens, count: tokens.length, chain });
    }

    const tokens = await api.getTokens();

    // Group by chain for summary
    const byChain: Record<string, number> = {};
    for (const token of tokens) {
      byChain[token.blockchain] = (byChain[token.blockchain] || 0) + 1;
    }

    return NextResponse.json({
      tokens,
      count: tokens.length,
      chains: byChain,
    });
  } catch (error) {
    console.error('Tokens API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch tokens' },
      { status: 500 }
    );
  }
}
