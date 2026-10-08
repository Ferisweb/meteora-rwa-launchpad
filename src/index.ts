import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { createRWAToken, initializeBondingCurvePool } from './launchpad';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('PRIVATE_KEY is missing in .env');
  }

  const connection = new Connection(rpcUrl, 'confirmed');
  const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));

  console.log('\n=============================================');
  console.log('    Meteora RWA Agent & Launchpad CLI        ');
  console.log('=============================================');
  console.log(`Active Wallet: ${wallet.publicKey.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Network Balance: ${balance / LAMPORTS_PER_SOL} SOL\n`);

  if (balance === 0) {
    console.error('[error] Wallet balance is zero. Aborting.');
    rl.close();
    return;
  }

  console.log('Select Action:');
  console.log('1. Launch New RWA Token & Bonding Curve');
  console.log('2. Check Network Status');
  console.log('3. Exit');

  const choice = await prompt('\nEnter option (1-3): ');

  if (choice === '1') {
    const name = await prompt('Asset Name (e.g., Charizard TCG Card): ');
    const symbol = await prompt('Asset Symbol (e.g., CHZRD): ');
    const uri = await prompt('Metadata URI (Press enter to leave blank): ');
    const supplyStr = await prompt('Initial Mint Supply (e.g., 5000): ');

    const initialSupply = parseInt(supplyStr, 10) || 0;

    console.log('\n[processing] Executing RWA tokenization pipeline...');
    
    const { mint } = await createRWAToken(connection, wallet, {
      name,
      symbol,
      decimals: 6,
      initialSupply,
      uri: uri || '',
    });

    await initializeBondingCurvePool(connection, wallet, mint);

    console.log('\n[success] RWA Launch sequence completed successfully.');
  } else if (choice === '2') {
    console.log(`\n[status] Connected to ${rpcUrl}`);
    console.log(`[status] Slot height: ${await connection.getSlot()}`);
  } else {
    console.log('\nExiting CLI application.');
  }

  rl.close();
}

main().catch((err) => {
  console.error('[fatal] Execution error:', err);
  rl.close();
  process.exit(1);
});