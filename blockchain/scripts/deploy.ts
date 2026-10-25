import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  console.log("Deploying CertificateRegistry...");

  const CertificateRegistry = await ethers.getContractFactory(
    "CertificateRegistry"
  );

  const certificateRegistry =
    await CertificateRegistry.deploy();

  await certificateRegistry.waitForDeployment();

  const address =
    await certificateRegistry.getAddress();

  console.log(
    "CertificateRegistry deployed to:",
    address
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});