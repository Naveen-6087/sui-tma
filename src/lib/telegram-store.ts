/**
 * Shared in-memory store for Telegram bot state.
 *
 * Imported by both the webhook route AND the /api/telegram/link route
 * so they share the same Maps within a single Node.js process.
 *
 * ⚠️  Data is lost on server restart / redeploy.  For production,
 *     replace with Redis, Upstash, or a database.
 */

import crypto from 'crypto';

// ── Agent pool ──────────────────────────────────────
import { NearIntentsAgent } from './near-intents-agent';

export const agents = new Map<string, NearIntentsAgent>();
export const AGENT_POOL_MAX = 500;

export function getOrCreateAgent(chatId: string): NearIntentsAgent {
  let agent = agents.get(chatId);
  if (!agent) {
    agent = new NearIntentsAgent();
    agents.set(chatId, agent);
    if (agents.size > AGENT_POOL_MAX) {
      const oldest = agents.keys().next().value;
      if (oldest) {
        agents.delete(oldest);
        wallets.delete(oldest);
        nearAccounts.delete(oldest);
      }
    }
  }
  return agent;
}

// ── Wallets (SUI/EVM receive address) ───────────────
export const wallets = new Map<string, string>();

// ── NEAR account links (accountId only — NO private keys) ──
// Key: Telegram chatId, Value: NEAR account id
export const nearAccounts = new Map<string, string>();

/**
 * Legacy credentials store — kept ONLY for backward-compat with /import.
 * New /connect flow never stores private keys.
 */
export const nearLegacyCreds = new Map<string, { accountId: string; privateKey: string }>();

// ── Privy wallet store ──────────────────────────────
// Key: Telegram chatId, Value: Privy wallet info
export interface PrivyWalletEntry {
  privyUserId: string;
  walletId: string;
  nearAddress: string;
  telegramUserId: number;
}

export const privyWallets = new Map<string, PrivyWalletEntry>();

// ── Helpers ─────────────────────────────────────────

/** Build ProcessMessage options for a chat */
export function getAgentOpts(chatId: string) {
  const wallet = wallets.get(chatId);
  const accountId = nearAccounts.get(chatId);
  const legacy = nearLegacyCreds.get(chatId);
  const privy = privyWallets.get(chatId);

  // Priority: legacy import > privy wallet > old near-connect > manual
  const nearAccountId = legacy?.accountId || privy?.nearAddress || accountId;
  const nearPrivateKey = legacy?.privateKey;

  // Determine execution mode
  let executionMode: 'auto' | 'privy-auto' | 'client-sign' | 'manual';
  if (nearPrivateKey) {
    executionMode = 'auto';           // Legacy import with private key
  } else if (privy) {
    executionMode = 'privy-auto';     // Privy embedded wallet (server-side signing)
  } else if (accountId) {
    executionMode = 'client-sign';    // Old near-connect (kept for website)
  } else {
    executionMode = 'manual';         // No wallet connected
  }

  return {
    userAddress: wallet,
    nearAccountId,
    nearPrivateKey,
    executionMode,
    // Privy-specific fields
    privyWalletId: privy?.walletId,
    privyNearAddress: privy?.nearAddress,
  };
}

// ── HMAC link tokens ────────────────────────────────
// Used by the web-link auth flow so users can link their NEAR
// wallet through the website without exposing private keys.

const HMAC_SECRET =
  process.env.TELEGRAM_BOT_TOKEN || 'fallback-hmac-secret-dev';

/** Create an HMAC signature for a chatId (used in link URLs) */
export function createLinkSignature(chatId: string): string {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(chatId)
    .digest('hex');
}

/** Verify an HMAC signature for a chatId */
export function verifyLinkSignature(chatId: string, sig: string): boolean {
  const expected = createLinkSignature(chatId);
  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(sig, 'hex'),
  );
}
