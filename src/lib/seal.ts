/**
 * Seal Encryption Library
 * 
 * Provides encryption utilities for trading intents using Mysten's Seal
 * Identity-Based Encryption (IBE) system. Encrypted intents can only be
 * decrypted by the authorized Nautilus enclave.
 * 
 * NOTE: This implementation uses mock encryption for development.
 * Real Seal SDK integration requires proper setup with key servers.
 * 
 * @see https://seal-docs.wal.app/
 */

import { Transaction } from '@mysten/sui/transactions';

// ============== Configuration ==============

// Verified Seal Key Server Object IDs (Open mode)
// See: https://seal-docs.wal.app/Pricing/#verified-key-servers
const SEAL_KEY_SERVERS = {
  testnet: [
    // Mysten Labs testnet key servers
    "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
    "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
    // Ruby Nodes (Open mode)
    "0x6068c0acb197dddbacd4746a9de7f025b2ed5a5b6c1b1ab44dade4426d141da2",
  ],
  mainnet: [] as string[],
};

// Environment configuration
const SEAL_POLICY_PACKAGE_ID = process.env.NEXT_PUBLIC_SEAL_POLICY_PACKAGE_ID || '0x0';
const INTENT_REGISTRY_PACKAGE_ID = process.env.NEXT_PUBLIC_INTENT_REGISTRY_PACKAGE_ID || '0x0';
const INTENT_REGISTRY_ID = process.env.NEXT_PUBLIC_INTENT_REGISTRY_ID || '0x0';
const ENCLAVE_CONFIG_ID = process.env.NEXT_PUBLIC_ENCLAVE_CONFIG_ID || '0x0';

// Check if real Seal encryption should be used
const USE_REAL_SEAL = SEAL_POLICY_PACKAGE_ID !== '0x0' && 
                       SEAL_POLICY_PACKAGE_ID !== '' &&
                       typeof window !== 'undefined';

// ============== Types ==============

/**
 * Intent data structure for encryption
 */
export interface IntentData {
  intentId: string;
  pair: string;           // e.g., "SUI_USDC"
  triggerType: "price_below" | "price_above";
  triggerValue: number;   // Price in quote currency
  orderType: "market" | "limit";
  side: "buy" | "sell";
  quantity: number;       // Amount in base currency
  leverage?: number;      // Optional leverage for perps
  slippageBps: number;    // Slippage tolerance in basis points
  expiresAt: number;      // Unix timestamp
}

/**
 * Encrypted intent result with verification data
 */
export interface EncryptedIntentResult {
  encryptedBytes: Uint8Array;
  intentId: string;
  backupKey?: Uint8Array; // For disaster recovery
  metadata: {
    pair: string;
    triggerType: string;
    triggerValue: number;
    expiresAt: number;
  };
  // Verification data
  verification: {
    isRealEncryption: boolean;
    encryptionMethod: 'seal' | 'mock';
    threshold: number;
    keyServerCount: number;
    packageId: string;
    encryptedSize: number;
    timestamp: number;
  };
}

/**
 * Configuration for Seal client
 */
export interface SealConfig {
  network: 'testnet' | 'mainnet';
  policyPackageId: string;
  enclaveConfigId: string;
  threshold?: number;
}

/**
 * Parsed encrypted object info for verification
 */
export interface EncryptedObjectInfo {
  id: string;
  packageId: string;
  threshold: number;
  services: Array<[string, number]>;
  ciphertextLength: number;
}

// ============== Utility Functions ==============

/**
 * Get default Seal configuration from environment
 */
export function getDefaultSealConfig(): SealConfig {
  const network = (process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet') as 'testnet' | 'mainnet';
  return {
    network,
    policyPackageId: SEAL_POLICY_PACKAGE_ID,
    enclaveConfigId: ENCLAVE_CONFIG_ID,
    threshold: 2, // 2-of-3 key servers
  };
}

/**
 * Get Seal key server object IDs for a network
 */
export function getSealKeyServers(network: 'testnet' | 'mainnet'): string[] {
  return SEAL_KEY_SERVERS[network];
}

/**
 * Generate a unique intent ID
 */
export function generateIntentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `intent_${timestamp}_${random}`;
}

/**
 * Calculate expiry timestamp from hours
 */
export function calculateExpiry(hours: number): bigint {
  const now = Date.now();
  const expiryMs = now + hours * 60 * 60 * 1000;
  return BigInt(Math.floor(expiryMs / 1000));
}

/**
 * Check if an intent has expired
 */
export function isIntentExpired(expiresAt: number | bigint): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Number(expiresAt) < now;
}

/**
 * Scale price to integer for on-chain storage
 * Assumes 8 decimal places for price precision
 */
export function scalePrice(price: number): bigint {
  return BigInt(Math.round(price * 1e8));
}

/**
 * Unscale price from integer
 */
export function unscalePrice(scaledPrice: bigint): number {
  return Number(scaledPrice) / 1e8;
}

/**
 * Encode trading pair as bytes for on-chain storage
 */
export function encodePair(pair: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(pair);
}

/**
 * Decode trading pair from bytes
 */
export function decodePair(bytes: Uint8Array): string {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Format trigger condition for display
 * @param triggerType Either a string ('price_below'/'price_above') or number (0/1)
 * @param triggerValue The price trigger value
 * @param pair Optional trading pair for display
 */
export function formatTriggerCondition(
  triggerType: string | number, 
  triggerValue: number, 
  pair?: string
): string {
  // Convert number trigger type to string
  const triggerTypeStr = typeof triggerType === 'number' 
    ? (triggerType === 0 ? 'price_below' : 'price_above')
    : triggerType;
  
  const symbol = triggerTypeStr === 'price_below' ? '<' : '>';
  const pairSuffix = pair ? ` (${pair.replace('_', '/')})` : '';
  return `Price ${symbol} $${triggerValue.toLocaleString()}${pairSuffix}`;
}

// ============== Mock Encryption (Development) ==============

/**
 * Simple XOR cipher for mock encryption
 * DO NOT use in production - this is for development only
 */
function xorCipher(data: Uint8Array, key: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

/**
 * Generate a random key for mock encryption
 */
function generateMockKey(): Uint8Array {
  const key = new Uint8Array(32);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(key);
  } else {
    for (let i = 0; i < 32; i++) {
      key[i] = Math.floor(Math.random() * 256);
    }
  }
  return key;
}

/**
 * Create a mock encrypted object with metadata
 */
function createMockEncryptedObject(
  plaintext: Uint8Array,
  intentId: string,
  config: SealConfig
): { encrypted: Uint8Array; key: Uint8Array } {
  const key = generateMockKey();
  const ciphertext = xorCipher(plaintext, key);
  
  // Create a structured envelope with metadata
  const encoder = new TextEncoder();
  const metadata = encoder.encode(JSON.stringify({
    version: 1,
    intentId,
    packageId: config.policyPackageId,
    threshold: config.threshold || 2,
    keyServers: SEAL_KEY_SERVERS[config.network].length,
    timestamp: Date.now(),
    mock: true, // Flag indicating this is mock encryption
  }));
  
  // Structure: [4 bytes metadata length][metadata][ciphertext]
  const metadataLength = new Uint8Array(4);
  new DataView(metadataLength.buffer).setUint32(0, metadata.length, true);
  
  const envelope = new Uint8Array(4 + metadata.length + ciphertext.length);
  envelope.set(metadataLength, 0);
  envelope.set(metadata, 4);
  envelope.set(ciphertext, 4 + metadata.length);
  
  return { encrypted: envelope, key };
}

/**
 * Encrypt intent using mock encryption (development only)
 */
async function encryptIntentMock(
  intent: IntentData,
  config: SealConfig
): Promise<EncryptedIntentResult> {
  // Serialize intent to JSON
  const intentJson = JSON.stringify({
    ...intent,
    version: 1,
    createdAt: Date.now(),
  });
  
  const plaintext = new TextEncoder().encode(intentJson);
  const { encrypted, key } = createMockEncryptedObject(plaintext, intent.intentId, config);
  
  return {
    encryptedBytes: encrypted,
    intentId: intent.intentId,
    backupKey: key, // In mock mode, we return the key for testing
    metadata: {
      pair: intent.pair,
      triggerType: intent.triggerType,
      triggerValue: intent.triggerValue,
      expiresAt: intent.expiresAt,
    },
    verification: {
      isRealEncryption: false,
      encryptionMethod: 'mock',
      threshold: config.threshold || 2,
      keyServerCount: SEAL_KEY_SERVERS[config.network].length,
      packageId: config.policyPackageId,
      encryptedSize: encrypted.length,
      timestamp: Date.now(),
    },
  };
}

// ============== Real Seal Encryption ==============

/**
 * Create the seal_approve transaction for the intent policy
 * This is called by the Seal SDK to get permission to decrypt
 */
export function createSealApproveTransaction(
  intentId: Uint8Array,
  enclaveConfigId: string,
  packageId: string
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${packageId}::intent::seal_approve`,
    arguments: [
      tx.pure.vector('u8', Array.from(intentId)),
      tx.object(enclaveConfigId),
      tx.object('0x6'), // Clock object
    ],
  });
  
  return tx;
}

/**
 * Encrypt intent using real Seal SDK (when available)
 * Falls back to mock if SDK not configured
 */
async function encryptIntentReal(
  intent: IntentData,
  config: SealConfig
): Promise<EncryptedIntentResult> {
  // For now, we use mock encryption until Seal SDK integration is complete
  // Real implementation would:
  // 1. Import SealClient from @mysten/seal
  // 2. Create a SuiClient for the network
  // 3. Configure key servers
  // 4. Call sealClient.encrypt() with the intent data
  
  console.warn(
    '[Seal] Real Seal encryption not yet integrated. Using mock encryption.',
    '\nTo enable real encryption:',
    '\n1. Ensure @mysten/seal is properly configured',
    '\n2. Deploy seal_policy contract',
    '\n3. Set NEXT_PUBLIC_SEAL_POLICY_PACKAGE_ID in .env'
  );
  
  return encryptIntentMock(intent, config);
}

// ============== Main Encryption Function ==============

/**
 * Encrypt an intent for secure storage and transmission
 * 
 * The encrypted intent can only be decrypted by the authorized Nautilus
 * enclave that has been registered with the seal_policy contract.
 * 
 * @param intent The intent data to encrypt
 * @param config Optional Seal configuration
 * @returns Encrypted intent with verification data
 */
export async function encryptIntent(
  intent: IntentData,
  config?: SealConfig
): Promise<EncryptedIntentResult> {
  const effectiveConfig = config || getDefaultSealConfig();
  
  // Check if real Seal encryption is configured
  if (USE_REAL_SEAL && effectiveConfig.policyPackageId !== '0x0') {
    try {
      return await encryptIntentReal(intent, effectiveConfig);
    } catch (error) {
      console.error('[Seal] Real encryption failed, falling back to mock:', error);
      return encryptIntentMock(intent, effectiveConfig);
    }
  }
  
  // Use mock encryption for development
  return encryptIntentMock(intent, effectiveConfig);
}

// ============== Decryption (Enclave Only) ==============

/**
 * Decrypt a mock-encrypted intent (for testing only)
 * Real decryption happens in the Nautilus enclave
 */
export function decryptMockIntent(
  encrypted: Uint8Array,
  key: Uint8Array
): IntentData | null {
  try {
    // Parse envelope
    const metadataLength = new DataView(encrypted.buffer).getUint32(0, true);
    const ciphertext = encrypted.slice(4 + metadataLength);
    
    // Decrypt
    const plaintext = xorCipher(ciphertext, key);
    const decoder = new TextDecoder();
    const json = decoder.decode(plaintext);
    
    return JSON.parse(json) as IntentData;
  } catch (error) {
    console.error('[Seal] Failed to decrypt mock intent:', error);
    return null;
  }
}

// ============== Verification Functions ==============

/**
 * Parse encrypted object to extract verification info
 */
export function parseEncryptedObject(encrypted: Uint8Array): EncryptedObjectInfo | null {
  try {
    const metadataLength = new DataView(encrypted.buffer, encrypted.byteOffset).getUint32(0, true);
    const metadataBytes = encrypted.slice(4, 4 + metadataLength);
    const decoder = new TextDecoder();
    const metadata = JSON.parse(decoder.decode(metadataBytes));
    
    return {
      id: metadata.intentId || 'unknown',
      packageId: metadata.packageId || '0x0',
      threshold: metadata.threshold || 2,
      services: [[metadata.packageId || '0x0', metadata.keyServers || 3]],
      ciphertextLength: encrypted.length - 4 - metadataLength,
    };
  } catch (error) {
    console.error('[Seal] Failed to parse encrypted object:', error);
    return null;
  }
}

/**
 * Validate that an encrypted object has the expected structure
 */
export function isValidSealEncryption(encrypted: Uint8Array): boolean {
  if (encrypted.length < 8) return false;
  
  try {
    const metadataLength = new DataView(encrypted.buffer, encrypted.byteOffset).getUint32(0, true);
    if (metadataLength > encrypted.length - 4) return false;
    if (metadataLength < 10) return false; // Minimum metadata size
    
    const metadataBytes = encrypted.slice(4, 4 + metadataLength);
    const decoder = new TextDecoder();
    const metadata = JSON.parse(decoder.decode(metadataBytes));
    
    return typeof metadata.version === 'number' && 
           typeof metadata.intentId === 'string';
  } catch {
    return false;
  }
}

/**
 * Get human-readable encryption status message
 */
export function getEncryptionStatusMessage(result: EncryptedIntentResult): string {
  const { verification } = result;
  
  if (verification.isRealEncryption) {
    return `🔒 Encrypted with Seal (${verification.threshold}/${verification.keyServerCount} threshold)`;
  }
  
  return `⚠️ Mock encryption (${verification.encryptedSize} bytes) - Development mode`;
}

// ============== Transaction Builders ==============

/**
 * Build a transaction to create an intent on-chain
 */
export function buildCreateIntentTx(
  encryptedIntent: Uint8Array,
  triggerType: number,
  triggerValue: bigint,
  pair: Uint8Array,
  expiresAt: bigint,
  registryId: string
): Transaction {
  const tx = new Transaction();
  
  tx.moveCall({
    target: `${INTENT_REGISTRY_PACKAGE_ID}::intent_registry::create_intent`,
    arguments: [
      tx.object(registryId),
      tx.pure.vector('u8', Array.from(encryptedIntent)),
      tx.pure.u8(triggerType),
      tx.pure.u64(triggerValue),
      tx.pure.vector('u8', Array.from(pair)),
      tx.pure.u64(expiresAt),
    ],
  });
  
  return tx;
}

/**
 * Build a transaction to cancel an intent
 */
export function buildCancelIntentTx(
  intentId: string,
  registryId: string
): Transaction {
  const tx = new Transaction();
  
  // Convert intent ID to bytes
  const encoder = new TextEncoder();
  const intentIdBytes = encoder.encode(intentId);
  
  tx.moveCall({
    target: `${INTENT_REGISTRY_PACKAGE_ID}::intent_registry::cancel_intent`,
    arguments: [
      tx.object(registryId),
      tx.pure.vector('u8', Array.from(intentIdBytes)),
    ],
  });
  
  return tx;
}

// ============== Intent Summary for UI ==============

/**
 * Intent summary from on-chain data
 */
export interface OnChainIntentSummary {
  id: string;
  owner: string;
  pair: string;
  triggerType: number; // 0 = price_below, 1 = price_above
  triggerValue: number;
  status: number; // 0=Active, 1=Executing, 2=Executed, 3=Cancelled, 4=Expired, 5=Failed
  createdAt: number;
  expiresAt: number;
  objectId: string;
}

/**
 * Fetch user intents from the blockchain
 * Note: This uses object queries - for production, use an indexer
 */
export async function fetchUserIntents(
  userAddress: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  suiClient: any
): Promise<OnChainIntentSummary[]> {
  const intents: OnChainIntentSummary[] = [];
  
  try {
    // Query Intent objects owned by user
    const response = await suiClient.core.getOwnedObjects({
      owner: userAddress,
      filter: {
        StructType: `${INTENT_REGISTRY_PACKAGE_ID}::intent_registry::Intent`,
      },
      options: {
        showContent: true,
        showType: true,
      },
    });

    for (const obj of response.result.data || []) {
      if (!obj.data?.content) continue;
      
      const fields = obj.data.content.fields as Record<string, unknown>;
      if (!fields) continue;

      // Parse intent fields
      const pairBytes = fields.pair as number[] | undefined;
      const pair = pairBytes ? new TextDecoder().decode(new Uint8Array(pairBytes)) : 'UNKNOWN';
      
      intents.push({
        id: fields.id as string || obj.data.objectId,
        owner: userAddress,
        pair,
        triggerType: Number(fields.trigger_type || 0),
        triggerValue: unscalePrice(BigInt(fields.trigger_value as string || '0')),
        status: Number(fields.status || 0),
        createdAt: Number(fields.created_at || Date.now() / 1000),
        expiresAt: Number(fields.expires_at || 0),
        objectId: obj.data.objectId,
      });
    }

    // Sort by creation date, newest first
    intents.sort((a, b) => b.createdAt - a.createdAt);
    
    return intents;
  } catch (error) {
    console.error('Failed to fetch user intents:', error);
    return [];
  }
}

// ============== Export Package IDs for UI ==============

export const PACKAGE_IDS = {
  sealPolicy: SEAL_POLICY_PACKAGE_ID,
  intentRegistry: INTENT_REGISTRY_PACKAGE_ID,
  intentRegistryObject: INTENT_REGISTRY_ID,
  enclaveConfig: ENCLAVE_CONFIG_ID,
};
