import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";
import { deployViaSafeSingletonFactory, getExpectedAddress } from "../helpers/safeSingletonFactory";
import SafeSingletonModule from "./SafeSingleton";
import SafeL2Module from "./SafeL2";
import HandlersModule from "./Handlers";

const SafeMigrationModule = buildModule("SafeMigration", (m) => {
    const { safe } = m.useModule(SafeSingletonModule);
    const { safeL2 } = m.useModule(SafeL2Module);
    const { compatibilityFallbackHandler } = m.useModule(HandlersModule);

    const safeMigration = m.contract("SafeMigration", [safe, safeL2, compatibilityFallbackHandler], {
        id: "SafeMigration",
    });

    return { safeMigration };
});

export default SafeMigrationModule;

/**
 * Deploy SafeMigration via Safe Singleton Factory (for use outside of Ignition)
 * Requires Safe, SafeL2, and CompatibilityFallbackHandler to be deployed first
 */
export async function deploySafeMigration() {
    // Get expected addresses of dependencies
    const safeAddress = await getExpectedAddress(hre, "Safe", []);
    const safeL2Address = await getExpectedAddress(hre, "SafeL2", []);
    const compatibilityHandlerAddress = await getExpectedAddress(hre, "CompatibilityFallbackHandler", []);

    return deployViaSafeSingletonFactory(hre, "SafeMigration", [safeAddress, safeL2Address, compatibilityHandlerAddress]);
}
