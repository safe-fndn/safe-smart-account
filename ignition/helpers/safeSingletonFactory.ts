import { ethers, keccak256, concat, getBytes, zeroPadValue, toBeHex } from "ethers";
import { getSingletonFactoryInfo } from "@safe-global/safe-singleton-factory";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

const SAFE_SINGLETON_FACTORY = "0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7";
const DEFAULT_SALT = "0x0000000000000000000000000000000000000000000000000000000000000000";

export interface DeployResult {
    address: string;
    deployed: boolean;
}

/**
 * Calculate the CREATE2 address for a contract deployed via the Safe Singleton Factory
 */
export function calculateCreate2Address(initCode: string, salt: string = DEFAULT_SALT): string {
    const initCodeHash = keccak256(initCode);
    return ethers.getCreate2Address(SAFE_SINGLETON_FACTORY, salt, initCodeHash);
}

/**
 * Ensure the Safe Singleton Factory is deployed on the current network
 */
async function ensureFactoryDeployed(hre: HardhatRuntimeEnvironment): Promise<void> {
    const { ethers: hreEthers, network } = hre;

    const factoryCode = await hreEthers.provider.getCode(SAFE_SINGLETON_FACTORY);
    if (factoryCode !== "0x") {
        return; // Factory already deployed
    }

    // Get factory deployment info
    const chainId = Number((await hreEthers.provider.getNetwork()).chainId);
    const factoryInfo = getSingletonFactoryInfo(chainId);

    if (!factoryInfo) {
        throw new Error(
            `Safe Singleton Factory not available for network ${network.name} (chainId: ${chainId}). ` +
                `Request deployment at https://github.com/safe-global/safe-singleton-factory`,
        );
    }

    // Fund the factory deployer if needed
    const signers = await hreEthers.getSigners();
    const deployer = signers[0];
    const fundingAmount = BigInt(factoryInfo.gasLimit) * BigInt(factoryInfo.gasPrice);
    const deployerBalance = await hreEthers.provider.getBalance(factoryInfo.signerAddress);

    if (deployerBalance < fundingAmount) {
        const fundingTx = await deployer.sendTransaction({
            to: factoryInfo.signerAddress,
            value: fundingAmount - deployerBalance,
        });
        await fundingTx.wait();
    }

    // Send the pre-signed transaction to deploy the factory
    const deployTx = await hreEthers.provider.broadcastTransaction(factoryInfo.transaction);
    await deployTx.wait();

    console.log(`Safe Singleton Factory deployed at ${SAFE_SINGLETON_FACTORY}`);
}

/**
 * Deploy a contract via the Safe Singleton Factory using deterministic CREATE2
 */
export async function deployViaSafeSingletonFactory(
    hre: HardhatRuntimeEnvironment,
    contractName: string,
    constructorArgs: unknown[] = [],
    salt: string = DEFAULT_SALT,
): Promise<DeployResult> {
    const { ethers: hreEthers } = hre;

    // Ensure factory is deployed
    await ensureFactoryDeployed(hre);

    // Get contract factory and build init code
    const ContractFactory = await hreEthers.getContractFactory(contractName);
    const deployTx = await ContractFactory.getDeployTransaction(...constructorArgs);
    const initCode = deployTx.data;

    if (!initCode) {
        throw new Error(`Failed to get init code for ${contractName}`);
    }

    // Calculate expected address
    const expectedAddress = calculateCreate2Address(initCode, salt);

    // Check if already deployed
    const existingCode = await hreEthers.provider.getCode(expectedAddress);
    if (existingCode !== "0x") {
        console.log(`${contractName} already deployed at ${expectedAddress}`);
        return { address: expectedAddress, deployed: false };
    }

    // Deploy via factory
    const factory = new ethers.Contract(
        SAFE_SINGLETON_FACTORY,
        ["function deploy(bytes memory _initCode, bytes32 _salt) public returns (address payable createdContract)"],
        (await hreEthers.getSigners())[0],
    );

    console.log(`Deploying ${contractName}...`);
    const tx = await factory.deploy(initCode, salt);
    await tx.wait();

    // Verify deployment
    const deployedCode = await hreEthers.provider.getCode(expectedAddress);
    if (deployedCode === "0x") {
        throw new Error(`Failed to deploy ${contractName} at ${expectedAddress}`);
    }

    console.log(`${contractName} deployed at ${expectedAddress}`);
    return { address: expectedAddress, deployed: true };
}

/**
 * Get the expected deployment address for a contract via Safe Singleton Factory
 */
export async function getExpectedAddress(
    hre: HardhatRuntimeEnvironment,
    contractName: string,
    constructorArgs: unknown[] = [],
    salt: string = DEFAULT_SALT,
): Promise<string> {
    const { ethers: hreEthers } = hre;

    const ContractFactory = await hreEthers.getContractFactory(contractName);
    const deployTx = await ContractFactory.getDeployTransaction(...constructorArgs);
    const initCode = deployTx.data;

    if (!initCode) {
        throw new Error(`Failed to get init code for ${contractName}`);
    }

    return calculateCreate2Address(initCode, salt);
}
