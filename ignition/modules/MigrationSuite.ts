import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import MainSuiteModule from "./MainSuite";
import SafeMigrationModule from "./SafeMigration";

/**
 * MigrationSuite module - equivalent to the "migration" tag in hardhat-deploy
 *
 * Deploys:
 * - All contracts from MainSuite
 * - SafeMigration (depends on Safe, SafeL2, and CompatibilityFallbackHandler)
 */
const MigrationSuiteModule = buildModule("MigrationSuite", (m) => {
    const mainSuite = m.useModule(MainSuiteModule);
    const { safeMigration } = m.useModule(SafeMigrationModule);

    return {
        ...mainSuite,
        safeMigration,
    };
});

export default MigrationSuiteModule;
