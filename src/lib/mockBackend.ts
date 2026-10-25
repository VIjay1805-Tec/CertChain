// ============================================================
// Mock verification backend functions.
// These are structured as realistic swap-in points:
//   verifyOnChain(hash)  â†’ replace with real blockchain RPC call
//   detectForgery(file)  â†’ replace with real AI forgery API call
// ============================================================

import type { VerificationTier } from '@/types/schema';

// Simulate a SHA-256 hash (mock â€” not real crypto, but deterministic)
export function mockSha256(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return (
    hex.repeat(8).slice(0, 64)
  );
}

// Mock IPFS CID (v0-style, 46 chars)
export function mockIpfsCid(input: string): string {
  const hash = mockSha256(input);
  return 'Qm' + hash.slice(0, 44);
}

// Mock blockchain transaction hash (0x + 64 hex)
export function mockTxHash(input: string): string {
  const hash = mockSha256(input + 'tx');
  return '0x' + hash;
}

// Mock blockchain contract address
export const MOCK_CONTRACT_ADDRESS = '0x7Ae36FbaC2C4e3D91851f7c5b3a2E1F4C8D9bE6a';

// ---- Swap-in point: on-chain verification ----
// Real impl: fetch stored hash + CID from blockchain, compare against
// the hash of the document on file.
export async function verifyOnChain(
  storedHash: string,
  documentHash: string,
): Promise<{ match: boolean; txRef: string }> {
  await delay(1500);
  const match = storedHash === documentHash;
  return {
    match,
    txRef: mockTxHash(storedHash + 'verify'),
  };
}

// ---- Swap-in point: AI forgery detection ----
// Real impl: send certificate file to AI forgery-detection API,
// receive tampering analysis.
export async function detectForgery(
  fileName: string,
): Promise<{
  result: 'genuine' | 'suspicious';
  confidenceScore: number;
  indicators: string[];
}> {
  await delay(1800);
  // Mock logic: deterministic based on filename â€” mostly genuine
  const isTampered = fileName.toLowerCase().includes('fake') || fileName.toLowerCase().includes('copy');
  if (isTampered) {
    return {
      result: 'suspicious',
      confidenceScore: 87,
      indicators: [
        'Metadata inconsistency detected in document header',
        'Pixel-level anomalies around text regions',
        'Digital signature hash mismatch',
      ],
    };
  }
  return {
    result: 'genuine',
    confidenceScore: 94,
    indicators: [
      'Document metadata consistent',
      'No pixel-level tampering detected',
      'Digital signature verified',
    ],
  };
}

// ---- Compute final verdict from check results ----
export function computeVerdict(
  tier: VerificationTier,
  blockchainMatch: boolean | null,
  aiResult: 'genuine' | 'suspicious' | null,
): { verdict: 'verified' | 'suspicious' | 'invalid'; confidence: number } {
  // Combined tier
  if (tier === 'combined') {
    if (blockchainMatch === true && aiResult === 'genuine') {
      return { verdict: 'verified', confidence: 96 };
    }
    if (blockchainMatch === false) {
      return { verdict: 'invalid', confidence: 92 };
    }
    if (aiResult === 'suspicious') {
      return { verdict: 'suspicious', confidence: 87 };
    }
    return { verdict: 'suspicious', confidence: 75 };
  }
  // Blockchain-only
  if (tier === 'blockchain') {
    if (blockchainMatch === true) {
      return { verdict: 'verified', confidence: 95 };
    }
    if (blockchainMatch === false) {
      return { verdict: 'invalid', confidence: 93 };
    }
    return { verdict: 'suspicious', confidence: 70 };
  }
  // AI-only
  if (tier === 'ai_forgery') {
    if (aiResult === 'genuine') {
      return { verdict: 'verified', confidence: 92 };
    }
    if (aiResult === 'suspicious') {
      return { verdict: 'suspicious', confidence: 87 };
    }
    return { verdict: 'suspicious', confidence: 70 };
  }
  return { verdict: 'suspicious', confidence: 50 };
}

export const TIER_PRICING: Record<VerificationTier, { label: string; price: number; description: string }> = {
  blockchain: { label: 'Blockchain Verification', price: 999, description: 'Compare document hash against on-chain stored original' },
  ai_forgery: { label: 'AI Forgery Detection', price: 1999, description: 'AI-powered analysis for tampering and manipulation signs' },
  combined: { label: 'Combined Verification', price: 2999, description: 'Full blockchain + AI forgery analysis for maximum confidence' },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

