const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SafeMaster Contract Identification", function () {
  let SafeMaster;
  let safeMaster;

  beforeEach(async function () {
    // Deploy contract
    SafeMaster = await ethers.getContractFactory("SafeMaster");
    safeMaster = await SafeMaster.deploy();
    await safeMaster.deployed();
  });

  it("should return the correct IDENTIFIER", async function () {
    const identifier = await safeMaster.IDENTIFIER();
    expect(identifier).to.equal("Gnosis SAFE");
  });

  it("should return the correct VERSION", async function () {
    const version = await safeMaster.VERSION();
    expect(version).to.equal(1);
  });
});
