// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;

import {ISignatureValidator, ISignatureValidatorConstants} from "../interfaces/ISignatureValidator.sol";

/**
 * @title Secured Signature Validator
 * @notice Safely validates ERC-1271 contract signatures without propagating reverts.
 */
abstract contract SecuredSignatureValidator is ISignatureValidatorConstants {
    /**
     * @notice Validates an ERC-1271 contract signature, returning `true` if valid and `false` otherwise.
     * @dev This method never reverts. A reverting `isValidSignature` call is treated as an invalid
     *      signature. Exactly 32 bytes must be returned equal to ABI-encoded {EIP1271_MAGIC_VALUE}.
     * @param owner The contract whose `isValidSignature` method is called.
     * @param dataHash The hash of the data that was signed.
     * @param signature The signature bytes passed to `isValidSignature`.
     * @return valid `true` if the signature is valid, `false` otherwise.
     */
    function validateContractSignature(address owner, bytes32 dataHash, bytes memory signature) internal view returns (bool valid) {
        bytes memory data = abi.encodeWithSelector(ISignatureValidator.isValidSignature.selector, dataHash, signature);
        (bool success, bytes memory result) = owner.staticcall(data);
        return success && result.length == 32 && abi.decode(result, (bytes32)) == bytes32(EIP1271_MAGIC_VALUE);
    }
}
