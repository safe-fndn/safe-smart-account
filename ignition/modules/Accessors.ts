import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";
import { deployViaSafeSingletonFactory } from "../helpers/safeSingletonFactory";

const AccessorsModule = buildModule("Accessors", (m) => {
    const simulateTxAccessor = m.contract("SimulateTxAccessor", [], {
        id: "SimulateTxAccessor",
    });

    return { simulateTxAccessor };
});

export default AccessorsModule;

/**
 * Deploy SimulateTxAccessor via Safe Singleton Factory (for use outside of Ignition)
 */
export async function deployAccessors() {
    return deployViaSafeSingletonFactory(hre, "SimulateTxAccessor", []);
}
