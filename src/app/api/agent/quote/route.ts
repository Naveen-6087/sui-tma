/**
 * POST /api/agent/quote
 * 
 * Gets a swap quote from the NEAR Intents 1-Click API.
 * Supports both dry-run (estimation) and live quotes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNearIntentsAPI } from '@/lib/near-intents-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      originAsset,
      destinationAsset,
      amount,
      refundAddress,
      recipientAddress,
      // Legacy support
      senderAddress,
      dry = true,
      slippageTolerance = 100,
    } = body as {
      originAsset: string;
      destinationAsset: string;
      amount: string;
      refundAddress?: string;
      recipientAddress?: string;
      senderAddress?: string;
      dry?: boolean;
      slippageTolerance?: number;
    };

    // Use refundAddress if provided, fall back to senderAddress for backwards compat
    const effectiveRefund = refundAddress || senderAddress || '0x0000000000000000000000000000000000000000000000000000000000000000';
    const effectiveRecipient = recipientAddress || effectiveRefund;

    if (!originAsset || !destinationAsset || !amount) {
      return NextResponse.json(
        { error: 'originAsset, destinationAsset, and amount are required' },
        { status: 400 }
      );
    }

    const api = getNearIntentsAPI();

    if (dry) {
      const quote = await api.getDryQuote({
        originAsset,
        destinationAsset,
        amount,
        refundAddress: effectiveRefund,
        recipientAddress: effectiveRecipient,
      });
      return NextResponse.json(quote);
    }

    const quote = await api.getLiveQuote({
      originAsset,
      destinationAsset,
      amount,
      refundAddress: effectiveRefund,
      recipientAddress: effectiveRecipient,
      slippageTolerance,
    });

    return NextResponse.json(quote);
  } catch (error) {
    console.error('Quote API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get quote' },
      { status: 500 }
    );
  }
}
