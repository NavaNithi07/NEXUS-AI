const fs = require('fs');
const path = require('path');

// 1. Read ALCHEMY_API_KEY from .env safely without exposing credentials in logs
function getApiKey() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found in wallet-app directory');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('ALCHEMY_API_KEY=')) {
      return trimmed.substring('ALCHEMY_API_KEY='.length).trim();
    }
  }
  throw new Error('ALCHEMY_API_KEY not defined in .env');
}

async function main() {
  const apiKey = getApiKey();
  const endpoint = `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
  const vitalikAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

  console.log(`Connecting to Alchemy Ethereum Mainnet endpoint...`);
  console.log(`Target Address: vitalik.eth (${vitalikAddress})`);

  // eth_getBalance request
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_getBalance',
    params: [vitalikAddress, 'latest']
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`HTTP Error ${response.status}: ${errText}`);
      process.exit(1);
    }

    const data = await response.json();
    if (data.error) {
      console.error('RPC Error returned by Alchemy:', data.error);
      process.exit(1);
    }

    const balanceHex = data.result;
    const balanceWei = BigInt(balanceHex);
    // 1 ETH = 10^18 Wei
    const ethWhole = balanceWei / 1000000000000000000n;
    const ethRemainder = balanceWei % 1000000000000000000n;
    const ethFormatted = `${ethWhole}.${ethRemainder.toString().padStart(18, '0').slice(0, 4)} ETH`;

    console.log(`\n--- Alchemy API Call Successful ---`);
    console.log(`Raw Hex Balance : ${balanceHex}`);
    console.log(`Balance in Wei  : ${balanceWei.toString()} Wei`);
    console.log(`Formatted Balance: ${ethFormatted}`);
  } catch (err) {
    console.error('Failed to connect to Alchemy:', err.message);
    process.exit(1);
  }
}

main();
