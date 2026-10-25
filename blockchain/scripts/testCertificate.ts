import { JsonRpcProvider, Wallet, Contract } from "ethers";
import artifact from "../artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json" with { type: "json" };

const RPC_URL = "http://127.0.0.1:8545";

const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function main() {
  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);

  const contract = new Contract(
    CONTRACT_ADDRESS,
    artifact.abi,
    wallet
  );

  const hash =
    "0xb2dd968ad8496a9ab1f3e05b25cd1f532e73f5d0195c91373aafb3c3db8b72b5";

  console.log("Calling issueCertificate...");

  const tx = await contract.issueCertificate(hash);

  console.log("Transaction hash:", tx.hash);

  const receipt = await tx.wait();

  console.log("Receipt status:", receipt.status);
  console.log("Receipt logs:", receipt.logs);

  console.log("Number of logs:", receipt.logs.length);
}

main().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});
