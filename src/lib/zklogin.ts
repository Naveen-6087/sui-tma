import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
  genAddressSeed,
  getZkLoginSignature,
} from "@mysten/sui/zklogin";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { jwtDecode } from "jwt-decode";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/sui/utils";

// Configuration
const SUI_RPC_URL =
  process.env.NEXT_PUBLIC_SUI_RPC_URL || "https://fullnode.testnet.sui.io:443";
const PROVER_URL =
  process.env.NEXT_PUBLIC_PROVER_URL || "https://prover-dev.mystenlabs.com/v1";
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const REDIRECT_URL = process.env.NEXT_PUBLIC_REDIRECT_URL || "";

export interface JwtPayload {
  iss?: string;
  sub?: string;
  aud?: string[] | string;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
}

export interface ZkLoginSetup {
  ephemeralKeyPair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
  estimatedExpiration: Date;
}

export interface PartialZkLoginSignature {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
}

export interface ZkLoginSession {
  ephemeralPrivateKey: string;
  ephemeralPublicKey: string;
  randomness: string;
  maxEpoch: number;
  jwt: string;
  userSalt: string;
  zkLoginAddress: string;
  zkProof?: PartialZkLoginSignature;
}

/**
 * Get Sui client instance
 */
export function getSuiClient(): SuiGrpcClient {
  return new SuiGrpcClient({
    baseUrl: SUI_RPC_URL,
    network: "testnet",
  });
}

/**
 * Initialize zkLogin by generating ephemeral keypair and nonce
 */
export async function setupZkLogin(): Promise<ZkLoginSetup> {
  const suiClient = getSuiClient();

  // Get current epoch information
  const systemState = await suiClient.core.getCurrentSystemState();
  const epoch = systemState.systemState.epoch;

  // Set ephemeral key to be active for 2 epochs (~24 hours on testnet)
  const maxEpoch = Number(epoch) + 2;

  // Generate ephemeral keypair
  const ephemeralKeyPair = new Ed25519Keypair();

  // Generate randomness and nonce
  const randomness = generateRandomness();
  const nonce = generateNonce(
    ephemeralKeyPair.getPublicKey(),
    maxEpoch,
    randomness,
  );

  // Calculate estimated expiration time (approximately 24 hours per epoch)
  const estimatedExpiration = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  return {
    ephemeralKeyPair,
    randomness,
    nonce,
    maxEpoch,
    estimatedExpiration,
  };
}

/**
 * Build Google OAuth URL for zkLogin
 */
export function getGoogleAuthUrl(nonce: string, redirectUrl?: string): string {
  const clientId = GOOGLE_CLIENT_ID;
  const redirect = redirectUrl || REDIRECT_URL;

  if (!clientId) {
    throw new Error("Google Client ID not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "id_token",
    redirect_uri: redirect,
    scope: "openid",
    nonce: nonce,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Get or create user-specific salt component stored in localStorage
 * This ensures same wallet address on login, but allows reset on "delete everything"
 */
function getUserSaltComponent(sub: string): string {
  if (typeof window === "undefined") return "0";

  const key = `${USER_SALT_KEY}_${sub}`;
  let stored = localStorage.getItem(key);

  if (!stored) {
    // Generate new random component for first login
    const random = Math.floor(Math.random() * 1000000000);
    stored = random.toString();
    localStorage.setItem(key, stored);
  }

  return stored;
}

/**
 * Generate user salt for zkLogin
 * Combines Google sub with stored random component for deterministic wallet
 */
export function generateUserSalt(sub: string): string {
  const userComponent = getUserSaltComponent(sub);

  // Combine sub + stored component for deterministic salt
  const combined = `${sub}:${userComponent}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  // Convert to a valid salt (must be smaller than 2^128)
  const maxSalt = BigInt(2) ** BigInt(128);
  const salt = BigInt(Math.abs(hash)) % maxSalt;
  return salt.toString();
}

/**
 * Get zkLogin address from JWT and salt
 */
export function getZkLoginAddressFromJwt(
  jwt: string,
  userSalt: string,
): string {
  // jwtToAddress(jwt, salt, isTestnet)
  return jwtToAddress(jwt, userSalt, false);
}

/**
 * Decode and validate JWT
 */
export function decodeJwt(jwt: string): JwtPayload {
  try {
    return jwtDecode<JwtPayload>(jwt);
  } catch (error) {
    console.error("Failed to decode JWT:", error);
    throw new Error("Invalid JWT token");
  }
}

/**
 * Check if JWT is expired
 */
export function isJwtExpired(jwt: string): boolean {
  const decoded = decodeJwt(jwt);
  if (!decoded.exp) return true;
  return Date.now() >= decoded.exp * 1000;
}

/**
 * Request ZK proof from prover service
 */
export async function requestZkProof(
  jwt: string,
  ephemeralKeyPair: Ed25519Keypair,
  maxEpoch: number,
  randomness: string,
  userSalt: string,
): Promise<PartialZkLoginSignature> {
  const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(
    ephemeralKeyPair.getPublicKey(),
  );

  const payload = {
    jwt,
    extendedEphemeralPublicKey: extendedEphemeralPublicKey.toString(),
    maxEpoch: maxEpoch.toString(),
    jwtRandomness: randomness,
    salt: userSalt,
    keyClaimName: "sub",
  };

  console.log("[Prover] Request payload:", {
    extendedEphemeralPublicKeyPrefix: extendedEphemeralPublicKey
      .toString()
      .substring(0, 20),
    maxEpoch: maxEpoch.toString(),
    randomnessLength: randomness.length,
    salt: userSalt,
    keyClaimName: "sub",
  });

  console.log("Requesting ZK proof...");

  try {
    const response = await fetch(PROVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Prover error:", {
        status: response.status,
        body: errorText,
      });
      throw new Error(
        `Prover request failed: ${response.status} - ${errorText}`,
      );
    }

    const proof = await response.json();
    console.log("ZK proof received successfully");
    return proof as PartialZkLoginSignature;
  } catch (error) {
    console.error("Failed to get ZK proof:", error);
    throw error;
  }
}

/**
 * Sign and execute a transaction with zkLogin
 */
export async function signAndExecuteZkLoginTransaction(
  txb: Transaction,
  session: ZkLoginSession,
) {
  const suiClient = getSuiClient();

  // Reconstruct ephemeral keypair from Bech32-encoded string (suiprivkey1...)
  const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(
    session.ephemeralPrivateKey,
  );

  console.log("[zkLogin] Ephemeral key info:", {
    secretKeyPrefix: session.ephemeralPrivateKey.substring(0, 15),
    publicKeyBase64: ephemeralKeyPair.getPublicKey().toBase64(),
    storedPublicKey: session.ephemeralPublicKey,
    keysMatch:
      ephemeralKeyPair.getPublicKey().toBase64() === session.ephemeralPublicKey,
    extendedPublicKey: getExtendedEphemeralPublicKey(
      ephemeralKeyPair.getPublicKey(),
    )
      .toString()
      .substring(0, 20),
  });

  // Set transaction sender
  txb.setSender(session.zkLoginAddress);

  // Set gas budget to avoid auto dry-run (which may fail with gRPC client)
  txb.setGasBudget(10000000); // 0.01 SUI

  console.log("[zkLogin] About to sign transaction...", {
    sender: session.zkLoginAddress,
    gasBudget: 10000000,
  });

  // Sign transaction with ephemeral key (zkLogin canonical pattern)
  const { bytes, signature: userSignature } = await txb.sign({
    client: suiClient,
    signer: ephemeralKeyPair,
  });

  console.log("[zkLogin] Transaction signed successfully", {
    bytesLength: bytes.length,
    userSignatureLength: userSignature.length,
  });

  // Decode JWT to get claims
  const decodedJwt = decodeJwt(session.jwt);

  // Generate address seed
  const addressSeed = genAddressSeed(
    BigInt(session.userSalt),
    "sub",
    decodedJwt.sub!,
    decodedJwt.aud as string,
  ).toString();

  console.log("[zkLogin] Address seed info:", {
    userSalt: session.userSalt,
    sub: decodedJwt.sub,
    aud: decodedJwt.aud,
    addressSeed: addressSeed.substring(0, 20) + "...",
    maxEpoch: session.maxEpoch,
    randomness: session.randomness,
  });

  if (!session.zkProof) {
    throw new Error("ZK proof not found in session");
  }

  console.log("[zkLogin] ZK Proof structure:", {
    hasProofPoints: !!session.zkProof.proofPoints,
    hasA: !!session.zkProof.proofPoints?.a,
    hasB: !!session.zkProof.proofPoints?.b,
    hasC: !!session.zkProof.proofPoints?.c,
    hasIssBase64Details: !!session.zkProof.issBase64Details,
    hasHeaderBase64: !!session.zkProof.headerBase64,
  });

  // Create zkLogin signature
  const zkLoginSignature = getZkLoginSignature({
    inputs: {
      ...session.zkProof,
      addressSeed,
    },
    maxEpoch: session.maxEpoch,
    userSignature,
  });

  console.log("[zkLogin] zkLogin signature created:", {
    signatureLength: zkLoginSignature.length,
    signaturePrefix: zkLoginSignature.substring(0, 20),
  });

  // Execute transaction with zkLogin signature
  // Convert base64 bytes to Uint8Array
  const txBytes = fromBase64(bytes);

  console.log("[zkLogin] Executing transaction with zkLogin signature...");

  try {
    // Use the documented simple pattern from zkLogin guide
    const result = await suiClient.executeTransaction({
      transaction: txBytes,
      signatures: [zkLoginSignature],
    });

    console.log("[zkLogin] Transaction result:", result);

    return result;
  } catch (error) {
    console.error("[zkLogin] Execute transaction error:", error);
    throw error;
  }
}

/**
 * Get account balance
 */
export async function getBalance(address: string): Promise<bigint> {
  const suiClient = getSuiClient();
  const balanceResponse = await suiClient.core.getBalance({
    owner: address,
    coinType: "0x2::sui::SUI",
  });
  return BigInt(balanceResponse.balance.balance);
}

/**
 * Create a transaction to send SUI to a recipient
 */
export function createSendTransaction(
  recipientAddress: string,
  amountInMist: bigint,
  sendAll = false,
): Transaction {
  const tx = new Transaction();

  if (sendAll) {
    // Send all: transfer the gas coin itself (minus gas fees)
    tx.transferObjects([tx.gas], tx.pure.address(recipientAddress));
  } else {
    // Send specific amount: split from gas coin and transfer
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);
    tx.transferObjects([coin], tx.pure.address(recipientAddress));
  }

  return tx;
}

/**
 * Send SUI to a recipient address using zkLogin
 */
export async function sendSui(
  recipientAddress: string,
  amountInSui: number,
  session: ZkLoginSession,
  sendAll = false,
): Promise<any> {
  // Validate epoch before attempting transaction
  const isValid = await isSessionEpochValid(session);
  if (!isValid) {
    throw new Error("Session epoch has expired. Please login again.");
  }

  // Convert SUI to MIST (1 SUI = 1_000_000_000 MIST)
  const amountInMist = BigInt(Math.floor(amountInSui * 1_000_000_000));

  // Create transaction
  const tx = createSendTransaction(recipientAddress, amountInMist, sendAll);

  // Sign and execute with zkLogin
  const result = await signAndExecuteZkLoginTransaction(tx, session);

  return result;
}

/**
 * Format SUI balance for display
 */
export function formatSuiBalance(balance: bigint): string {
  const sui = Number(balance) / 1_000_000_000;
  return sui.toFixed(4);
}

// Session Storage Keys
const SESSION_KEY = "zklogin_session";
const SETUP_KEY = "zklogin_setup";
const USER_SALT_KEY = "zklogin_user_salt";

/**
 * Store zkLogin setup data (before OAuth)
 */
export function storeZkLoginSetup(setup: {
  ephemeralPrivateKey: string;
  ephemeralPublicKey: string;
  randomness: string;
  maxEpoch: number;
  nonce: string;
}): void {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SETUP_KEY, JSON.stringify(setup));
  }
}

/**
 * Get zkLogin setup data
 */
export function getZkLoginSetup(): {
  ephemeralPrivateKey: string;
  ephemeralPublicKey: string;
  randomness: string;
  maxEpoch: number;
  nonce: string;
} | null {
  if (typeof window !== "undefined") {
    const data = sessionStorage.getItem(SETUP_KEY);
    return data ? JSON.parse(data) : null;
  }
  return null;
}

/**
 * Clear zkLogin setup data
 */
export function clearZkLoginSetup(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(SETUP_KEY);
  }
}

/**
 * Store zkLogin session data in localStorage for persistence
 */
export function storeZkLoginSession(session: ZkLoginSession): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem("zklogin_active", "true");
  }
}

/**
 * Retrieve zkLogin session data
 */
export function getZkLoginSession(): ZkLoginSession | null {
  if (typeof window !== "undefined") {
    const data = localStorage.getItem(SESSION_KEY);
    return data ? JSON.parse(data) : null;
  }
  return null;
}

/**
 * Clear active session (normal logout) - keeps data in localStorage
 */
export function clearZkLoginSession(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(SESSION_KEY); // Clear the actual session
    sessionStorage.removeItem("zklogin_active");
    sessionStorage.removeItem(SETUP_KEY);
  }
}

/**
 * Delete everything - completely wipes all zkLogin data including user salt
 * This will cause a NEW wallet to be generated on next login
 */
export function deleteAllZkLoginData(): void {
  if (typeof window !== "undefined") {
    // Remove session data
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem("zklogin_active");
    sessionStorage.removeItem(SETUP_KEY);

    // Remove all user salt components (allows new wallet generation)
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(USER_SALT_KEY)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;

  // Check if session is active
  const isActive = sessionStorage.getItem("zklogin_active") === "true";
  if (!isActive) return false;

  const session = getZkLoginSession();
  if (!session) return false;

  // Check if JWT is still valid
  if (isJwtExpired(session.jwt)) {
    clearZkLoginSession();
    return false;
  }

  return true;
}

/**
 * Get current epoch
 */
export async function getCurrentEpoch(): Promise<number> {
  const suiClient = getSuiClient();
  const systemState = await suiClient.core.getCurrentSystemState();
  return Number(systemState.systemState.epoch);
}

/**
 * Check if session epoch is still valid
 */
export async function isSessionEpochValid(
  session: ZkLoginSession,
): Promise<boolean> {
  const currentEpoch = await getCurrentEpoch();
  return currentEpoch <= session.maxEpoch;
}
