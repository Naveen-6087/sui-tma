/**
 * POST /api/telegram/deposit-signed
 *
 * Called by the sign-deposit TMA / web page after the user signs a deposit.
 * Reports the transaction hash back and notifies the user in Telegram.
 *
 * Body: { chatId: string, sig: string, txHash: string, depositAddress: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyLinkSignature,
  getOrCreateAgent,
  getAgentOpts,
} from '@/lib/telegram-store';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('[Telegram DepositSigned] Failed to send message:', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { chatId, sig, txHash, depositAddress } = await req.json();

    if (!chatId || !sig) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 },
      );
    }

    // Verify the HMAC signature
    try {
      if (!verifyLinkSignature(String(chatId), String(sig))) {
        return NextResponse.json(
          { ok: false, error: 'Invalid signature' },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: 'Invalid signature format' },
        { status: 403 },
      );
    }

    // If we have a txHash, tell the agent about the deposit
    if (txHash && depositAddress) {
      const agent = getOrCreateAgent(String(chatId));
      const opts = getAgentOpts(String(chatId));

      // Process "deposit_sent" through the agent to track via 1-Click API
      const agentResponse = await agent.processMessage(
        `deposit_sent ${txHash} ${depositAddress}`,
        opts,
      );

      // Notify user in Telegram
      await sendTelegramMessage(
        String(chatId),
        `✅ *Deposit Confirmed!*\n\n` +
          `Tx: \`${txHash}\`\n\n` +
          agentResponse.message.replace(/\*\*/g, '*') + '\n\n' +
          `Check swap progress: /status ${depositAddress}`,
      );

      return NextResponse.json({ ok: true, response: agentResponse.message });
    }

    // No txHash — just notify that the page was opened
    await sendTelegramMessage(
      String(chatId),
      '⏳ Deposit signing page opened. Please approve the transaction in your wallet.',
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Telegram DepositSigned] Error:', error);
    return NextResponse.json(
      { ok: false, error: 'Server error' },
      { status: 500 },
    );
  }
}
