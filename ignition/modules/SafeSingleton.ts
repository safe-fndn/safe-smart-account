import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";
import { deployViaSafeSingletonFactory } from "../helpers/safeSingletonFactory";

const SafeSingletonModule = buildModule("SafeSingleton", (m) => {
    const safe = m.contract("Safe", [], {
        id: "Safe",
        after: [],
    });

    return { safe };
});

export default SafeSingletonModule;

/**
 * Deploy Safe singleton via Safe Singleton Factory (for use outside of Ignition)
 */
export async function deploySafeSingleton() {
    return deployViaSafeSingletonFactory(hre, "Safe", []);
}
