// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title EIP-7951
 * @notice Base contract that adds support for calling the `p256verify` precompile.
 * @dev This was split into its own function to enable CVL summaries for better formal verification support. Note that
 *      this contract also works with RIP-7212 which has the exact same interface.
 * @author Nicholas Rodrigues Lordello - @nlordell
 */
abstract contract EIP7951 {
    /**
     * @notice Calls the EIP-7951 `P256VERIFY` precompile to verify a secp256r1 signature.
     * @param h Message hash.
     * @param r Signature r-component.
     * @param s Signature s-component.
     * @param qx Public key x-coordinate.
     * @param qy Public key y-coordinate.
     * @return result Whether or not the signature is valid.
     */
    function p256Verify(bytes32 h, bytes32 r, bytes32 s, uint256 qx, uint256 qy) internal view returns (bool result) {
        // Call the EIP-7951/RIP-7212 precompile. We resort to assembly shenanigans here to avoid superfluous memory
        // allocations (both for encoding the parameters and decoding the result) and to reduce code size.
        /* solhint-disable no-inline-assembly */
        /// @solidity memory-safe-assembly
        assembly {
            // Get the free memory pointer for writing some temporary data to memory (meaning that we don't need to
            // actually allocate memory and update the pointer).
            let ptr := mload(0x40)

            // Now, prepare the call to the precompile: `address(0x100).call(h, r, s, qx, qy)`.
            mstore(ptr, h)
            mstore(add(ptr, 0x20), r)
            mstore(add(ptr, 0x40), s)
            mstore(add(ptr, 0x60), qx)
            mstore(add(ptr, 0x80), qy)

            // We write the return data of the call to the scratch space at memory address 0.
            result := staticcall(gas(), 0x100, ptr, 0xa0, 0x00, 0x20)

            // The precompile is defined to return exactly `uint256(1)` iff the signature is valid; check the return data is
            // exactly what we expect. Note that in case the precompile is not supported, the `returndatasize` will be 0
            // making `result` false.
            result := and(result, and(eq(returndatasize(), 0x20), eq(mload(0x00), 1)))
        }
        /* solhint-enable no-inline-assembly */
    }
}
