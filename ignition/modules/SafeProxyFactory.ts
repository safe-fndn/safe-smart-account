import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import hre from "hardhat";
import { deployViaSafeSingletonFactory } from "../helpers/safeSingletonFactory";

const SafeProxyFactoryModule = buildModule("SafeProxyFactory", (m) => {
    const safeProxyFactory = m.contract("SafeProxyFactory", [], {
        id: "SafeProxyFactory",
    });

    return { safeProxyFactory };
});

export default SafeProxyFactoryModule;

/**
 * Deploy SafeProxyFactory via Safe Singleton Factory (for use outside of Ignition)
 */
export async function deploySafeProxyFactory() {
    return deployViaSafeSingletonFactory(hre, "SafeProxyFactory", []);
}
