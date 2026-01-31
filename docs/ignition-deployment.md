# Hardhat Ignition Deployment Guide

This guide explains how to deploy Safe Smart Account contracts using Hardhat Ignition.

## Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env`:
   ```bash
   # For mainnet/testnet deployments
   INFURA_KEY=your_infura_key
   PK=your_private_key
   # or
   MNEMONIC=your_mnemonic_phrase

   # Optional
   ETHERSCAN_API_KEY=your_etherscan_key
   ```

## Available Modules

| Module | Description | Contracts |
|--------|-------------|-----------|
| `MainSuite` | Full deployment for L1 networks | Safe, SafeL2, SafeProxyFactory, Handlers, Accessors, Libraries |
| `L2Suite` | Deployment for L2 networks | SafeL2, SafeProxyFactory, Handlers, Accessors, Libraries |
| `MigrationSuite` | MainSuite + SafeMigration | All MainSuite contracts + SafeMigration |
| `SafeSingleton` | Single contract | Safe |
| `SafeL2` | Single contract | SafeL2 |
| `SafeProxyFactory` | Single contract | SafeProxyFactory |
| `Handlers` | Handler contracts | TokenCallbackHandler, CompatibilityFallbackHandler, ExtensibleFallbackHandler |
| `Accessors` | Accessor contracts | SimulateTxAccessor |
| `Libraries` | Library contracts | CreateCall, MultiSend, MultiSendCallOnly, SignMessageLib, SafeToL2Setup |
| `SafeMigration` | Migration contract | SafeMigration (requires Safe, SafeL2, CompatibilityFallbackHandler) |

## Deployment Commands

### Deploy to Local Hardhat Network (Testing)

```bash
# Deploy main suite
npx hardhat ignition deploy ignition/modules/MainSuite.ts --network hardhat

# Deploy L2 suite
npx hardhat ignition deploy ignition/modules/L2Suite.ts --network hardhat

# Deploy migration suite
npx hardhat ignition deploy ignition/modules/MigrationSuite.ts --network hardhat
```

### Deploy to Testnets

```bash
# Deploy to Sepolia
npx hardhat ignition deploy ignition/modules/MainSuite.ts --network sepolia

# Deploy to Sepolia with deployment ID (for tracking)
npx hardhat ignition deploy ignition/modules/MainSuite.ts --network sepolia --deployment-id my-deployment
```

### Deploy to Mainnet

```bash
# Deploy main suite to Ethereum mainnet
npx hardhat ignition deploy ignition/modules/MainSuite.ts --network mainnet

# Deploy L2 suite to Gnosis Chain
npx hardhat ignition deploy ignition/modules/L2Suite.ts --network gnosis
```

### Deploy Individual Contracts

```bash
# Deploy only Safe singleton
npx hardhat ignition deploy ignition/modules/SafeSingleton.ts --network sepolia

# Deploy only handlers
npx hardhat ignition deploy ignition/modules/Handlers.ts --network sepolia

# Deploy only libraries
npx hardhat ignition deploy ignition/modules/Libraries.ts --network sepolia
```

## Testing the Deployment

### 1. Local Network Test

Run a quick deployment test on the local Hardhat network:

```bash
# Test MainSuite deployment
npx hardhat ignition deploy ignition/modules/MainSuite.ts --network hardhat

# Test L2Suite deployment
npx hardhat ignition deploy ignition/modules/L2Suite.ts --network hardhat

# Test MigrationSuite deployment
npx hardhat ignition deploy ignition/modules/MigrationSuite.ts --network hardhat
```

Expected output shows all contracts deployed with their addresses.

### 2. Run Existing Test Suite

Verify the contracts work correctly with the existing test suite:

```bash
# Run all Hardhat tests
npm run test:hardhat

# Run L1-specific tests
npm run test:L1

# Run L2-specific tests
npm run test:L2

# Run all tests
npm test
```

### 3. Verify TypeScript Compilation

```bash
# Check for TypeScript errors
npx tsc --noEmit --skipLibCheck

# Run linting
npm run lint:ts
```

### 4. Verify Contract Compilation

```bash
# Compile contracts
npm run build

# Check contract sizes
npm run codesize
```

## Deployment Artifacts

After deployment, Ignition stores artifacts in:
- `ignition/deployments/<network>/<deployment-id>/`

These include:
- `deployed_addresses.json` - Contract addresses
- `journal.jsonl` - Deployment journal
- Contract artifacts and build info

## Comparing with hardhat-deploy

| hardhat-deploy Tag | Ignition Module |
|-------------------|-----------------|
| `main-suite` | `MainSuite.ts` |
| `l2-suite` | `L2Suite.ts` |
| `singleton` | `SafeSingleton.ts` |
| `l2` | `SafeL2.ts` |
| `factory` | `SafeProxyFactory.ts` |
| `handlers` | `Handlers.ts` |
| `accessors` | `Accessors.ts` |
| `libraries` | `Libraries.ts` |
| `migration` | `MigrationSuite.ts` |

## Troubleshooting

### Factory Not Available

If you see an error about the Safe Singleton Factory not being available:
```
Safe Singleton Factory not available for network <network>
```

Request deployment at: https://github.com/safe-global/safe-singleton-factory

### Insufficient Funds

Ensure your deployer account has enough ETH/native token to:
1. Fund the factory deployer (if factory not yet deployed)
2. Pay for contract deployment gas

### Resuming Failed Deployments

Ignition tracks deployment state. To resume a failed deployment:
```bash
npx hardhat ignition deploy ignition/modules/MainSuite.ts --network <network> --deployment-id <previous-id>
```

### Resetting Deployment State

To start fresh, delete the deployment artifacts:
```bash
rm -rf ignition/deployments/<network>/<deployment-id>
```

## Additional Options

```bash
# Show deployment plan without executing
npx hardhat ignition deploy ignition/modules/MainSuite.ts --network sepolia --dry-run

# Verify contracts on Etherscan after deployment
npx hardhat ignition verify <deployment-id> --network sepolia
```
