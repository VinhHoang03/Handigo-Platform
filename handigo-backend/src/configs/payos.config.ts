import { PayOS } from '@payos/node';

export const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID!,
  apiKey: process.env.PAYOS_API_KEY!,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY!,
});

export const payoutPayos = new PayOS({
  clientId: process.env.PAYOS_PAYOUT_CLIENT_ID || process.env.PAYOS_CLIENT_ID!,
  apiKey: process.env.PAYOS_PAYOUT_API_KEY || process.env.PAYOS_API_KEY!,
  checksumKey:
    process.env.PAYOS_PAYOUT_CHECKSUM_KEY || process.env.PAYOS_CHECKSUM_KEY!,
});
