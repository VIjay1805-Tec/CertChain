import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const address = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const registry = await ethers.getContractAt("CertificateRegistry", address);

  const testHash = ethers.keccak256(ethers.toUtf8Bytes("read-only-check"));
  const result = await registry.verifyCertificate(999999, testHash);

  console.log("Read-only verification for nonexistent ID:", result);
  console.log("Expected result: false");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
