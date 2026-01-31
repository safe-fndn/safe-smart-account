import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";
import { deployViaSafeSingletonFactory } from "../helpers/safeSingletonFactory";

const SafeL2Module = buildModule("SafeL2", (m) => {
    const safeL2 = m.contract("SafeL2", [], {
        id: "SafeL2",
    });

    return { safeL2 };
});

export default SafeL2Module;

/**
 * Deploy SafeL2 via Safe Singleton Factory (for use outside of Ignition)
 */
export async function deploySafeL2() {
    return deployViaSafeSingletonFactory(hre, "SafeL2", []);
}
