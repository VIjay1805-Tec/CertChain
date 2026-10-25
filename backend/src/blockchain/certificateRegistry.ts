import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const RPC_URL = "http://127.0.0.1:8545";

const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const artifactPath = path.resolve(
  process.cwd(),
  "../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json"
);

const artifact = JSON.parse(
  fs.readFileSync(artifactPath, "utf-8")
);

const provider = new ethers.JsonRpcProvider(RPC_URL);

const wallet = new ethers.Wallet(
  PRIVATE_KEY,
  provider
);

export const certificateRegistry = new ethers.Contract(
  CONTRACT_ADDRESS,
  artifact.abi,
  wallet
);