import hre, { ethers } from "hardhat";
import { ContractTransactionResponse } from "ethers";
import { TestGuard } from "../../typechain-types";

export const MAX_GUARDS = 8;

export const deployTestGuards = async (count: number): Promise<TestGuard[]> => {
    const guardFactory = await hre.ethers.getContractFactory("TestGuard");
    const guards: TestGuard[] = [];
    for (let i = 0; i < count; i++) {
        guards.push(await guardFactory.deploy());
    }
    return guards;
};

/**
 * Returns the storage words of a guard list: the first guard packed with the number of other guards, then the other guards.
 */
export const guardListStorage = (guards: string[]): string[] =>
    guards.map((guard, i) => ethers.toBeHex(i === 0 ? (BigInt(guards.length - 1) << BigInt(160)) | BigInt(guard) : BigInt(guard), 32));

/**
 * Returns the storage words of `count` consecutive slots of `address`, starting at `slot`.
 */
export const readStorage = (address: string, slot: string, count: number): Promise<string[]> =>
    Promise.all(Array.from({ length: count }, (_, i) => hre.ethers.provider.getStorage(address, BigInt(slot) + BigInt(i))));

/**
 * Returns the checks that test guards ran in `tx`, in order, as `<guard index>:<event name>`.
 */
export const guardChecks = async (tx: Promise<ContractTransactionResponse>, guards: TestGuard[]): Promise<string[]> => {
    const receipt = await (await tx).wait();
    const addresses = await Promise.all(guards.map((guard) => guard.getAddress()));
    return receipt!.logs
        .filter((log) => addresses.includes(log.address))
        .map((log) => `${addresses.indexOf(log.address)}:${guards[0].interface.parseLog(log)!.name}`);
};
