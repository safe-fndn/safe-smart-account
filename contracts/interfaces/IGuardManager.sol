// SPDX-License-Identifier: LGPL-3.0-only
/* solhint-disable one-contract-per-file */
pragma solidity >=0.7.0 <0.9.0;

/**
 * @title IGuardManager - A contract interface managing transaction guards which perform pre and post-checks on Safe transactions.
 * @author @safe-global/safe-protocol
 */
interface IGuardManager {
    /**
     * @notice Transaction guards changed.
     * @param guards The new transaction guards, in the order they run their pre-execution checks.
     */
    event ChangedGuards(address[] guards);

    /**
     * @notice Set Transaction Guards `guards` for the Safe, replacing the current ones. Make sure you trust the guards.
     * @dev Set up to 8 guards that check Safe transactions before and after execution: the pre-execution checks run in
     *      the order of `guards`, the post-execution checks in reverse order.
     *      This can only be done via a Safe transaction, which includes a module transaction: transaction guards do not
     *      check module transactions, so restricting what modules can change requires module guards.
     *      The post-execution checks run with the guards read before execution: a guard removed by a transaction still
     *      runs its post-execution check, and a guard added by it runs none. A guard that must not be removed by a Safe
     *      transaction can therefore revert in its post-execution check if it is no longer in {getGuards}.
     *      ⚠️⚠️⚠️ IMPORTANT: Since a guard has full power to block Safe transaction execution,
     *      a broken guard can cause a denial of service for the Safe. Make sure to carefully
     *      audit the guard code and design recovery mechanisms. ⚠️⚠️⚠️
     * @param guards The addresses of the guards to be used, or an empty array to disable all guards.
     */
    function setGuards(address[] calldata guards) external;

    /**
     * @notice Returns the transaction guards of the Safe, in the order they run their pre-execution checks.
     * @dev Guards should use this function rather than read the guard storage slot, which packs the first guard with
     *      the number of other guards.
     * @return guards Array of transaction guards.
     */
    function getGuards() external view returns (address[] memory guards);
}
