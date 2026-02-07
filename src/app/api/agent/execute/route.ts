/**
 * POST /api/agent/execute
 * 
 * Execute a swap via the NEAR account.
 * This is a server-side endpoint that handles the actual deposit transaction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { executeSwap, isNearAccountConfigured, getNearAccountId } from '@/lib/near-transactions';

export async function POST(request: NextRequest) {
  try {
    if (!isNearAccountConfigured()) {
      return NextResponse.json(
        { error: 'NEAR account not configured. Set SENDER_NEAR_ACCOUNT and SENDER_PRIVATE_KEY in .env.local' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { originAsset, destinationAsset, amount, recipientAddress, refundAddress, slippageTolerance } = body as {
      originAsset: string;
      destinationAsset: string;
      amount: string;
      recipientAddress: string;
      refundAddress?: string;
      slippageTolerance?: number;
    };

    if (!originAsset || !destinationAsset || !amount || !recipientAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: originAsset, destinationAsset, amount, recipientAddress' },
        { status: 400 }
      );
    }

    const result = await executeSwap({
      originAsset,
      destinationAsset,
      amount,
      recipientAddress,
      refundAddress,
      slippageTolerance,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, details: result },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      depositAddress: result.depositAddress,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
      nearBlocksUrl: result.nearBlocksUrl,
      nearAccount: getNearAccountId(),
      quote: result.quote?.quote,
    });
  } catch (error) {
    console.error('Execute swap error:', error);
    return NextResponse.json(
      {
        error: `Swap execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
