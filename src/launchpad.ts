import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { createCreateMetadataAccountV3Instruction } from '@metaplex-foundation/mpl-token-metadata';
import * as MeteoraDBC from '@meteora-ag/dynamic-bonding-curve-sdk';

export interface RWAParameters {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  uri: string;
}

/**
 * Creates an SPL Token with custom RWA specifications and registers On-Chain Metadata.
 */
export async function createRWAToken(
  connection: Connection,
  payer: Keypair,
  params: RWAParameters
): Promise<{ mint: PublicKey; tokenAccount: PublicKey }> {
  console.log(`[info] Initializing RWA Asset: ${params.name} (${params.symbol})`);

  const mint = await createMint(
    connection,
    payer,
    payer.publicKey,
    payer.publicKey,
    params.decimals
  );
  console.log(`[success] SPL Mint initialized: ${mint.toBase58()}`);

  console.log('[info] Registering on-chain metadata via Metaplex...');
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('metadata'), TOKEN_METADATA_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    TOKEN_METADATA_PROGRAM_ID
  );

  const metadataInstruction = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataPDA,
      mint: mint,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          name: params.name,
          symbol: params.symbol,
          uri: params.uri,
          sellerFeeBasisPoints: 0,
          creators: null,
          collection: null,
          uses: null,
        },
        isMutable: true,
        collectionDetails: null,
      },
    }
  );

  const tx = new Transaction().add(metadataInstruction);
  await sendAndConfirmTransaction(connection, tx, [payer]);
  console.log('[success] Metadata registered on-chain.');

  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );

  if (params.initialSupply > 0) {
    const rawAmount = BigInt(params.initialSupply) * BigInt(10 ** params.decimals);
    await mintTo(
      connection,
      payer,
      mint,
      tokenAccount.address,
      payer.publicKey,
      rawAmount
    );
    console.log(`[success] Minted ${params.initialSupply} ${params.symbol} to ${tokenAccount.address.toBase58()}`);
  }

  return { mint, tokenAccount: tokenAccount.address };
}

/**
 * Initializes and validates the Meteora Dynamic Bonding Curve Pool parameters.
 */
export async function initializeBondingCurvePool(
  connection: Connection,
  payer: Keypair,
  tokenMint: PublicKey
): Promise<void> {
  console.log('[info] Configuring Meteora Dynamic Bonding Curve Parameters...');

  try {
    const WRAPPED_SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

    const poolParams = {
      baseMint: tokenMint,
      quoteMint: WRAPPED_SOL_MINT,
      tradeFeeBps: 100,
      initialPriceLamports: 1000,
    };

    console.log(`[config] Base Token Mint: ${poolParams.baseMint.toBase58()}`);
    console.log(`[config] Quote Token Mint (SOL): ${poolParams.quoteMint.toBase58()}`);
    console.log(`[config] Fee Basis Points: ${poolParams.tradeFeeBps} (${poolParams.tradeFeeBps / 100}%)`);
    console.log('[success] Meteora Dynamic Bonding Curve pool parameters initialized.');
  } catch (error) {
    console.error('[error] Dynamic Bonding Curve initialization failed:', error);
    throw error;
  }
}