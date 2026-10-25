import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();
  const address = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
  const issuer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const registry = await ethers.getContractAt("CertificateRegistry", address);

  console.log("Contract:", address);
  console.log("Owner:", await registry.owner());
  console.log("Backend issuer authorized:", await registry.authorizedIssuers(issuer));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
