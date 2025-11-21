// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title EIP-7702
 * @notice Base contract for detecting when code is run in an EIP-7702 delegated context.
 * @author Nicholas Rodrigues Lordello - @nlordell
 */
abstract contract EIP7702 {
    /**
     * @dev Returns whether the current contract is executing in the context of an EOA with a 7702 delegation. Note that
     *      just because this method returns `true` does **not** mean that the EOA delegated to this contract. In fact,
     *      they may have delegated to another contract that `DELEGATECALL`ed into this contract.
     */
    function isThisDelegatedAccount() internal view returns (bool result) {
        // As described in EIP-7702, during delegated execution `CODECOPY` operate directly on the executing code
        // instead of the delegation. We have to use `EXTCODECOPY` in order to read the delegation from the authority.
        // Note we use assembly to make sure we only copy the first 3 bytes, which is enough to determine whether or not
        // `this` is an EIP-7702 delegated account.

        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            extcodecopy(address(), 0, 0, 3)
            result := eq(shr(232, mload(0)), 0xef0100)
        }
        /* solhint-enable no-inline-assembly */
    }
}
