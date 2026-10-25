import "dotenv/config";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import CertificateRegistryArtifact from "../../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json" with { type: "json" };

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";

const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;

const CONTRACT_ADDRESS = process.env.CERTIFICATE_CONTRACT_ADDRESS; // Replace with your deployed contract address;

if (!PRIVATE_KEY) throw new Error("BLOCKCHAIN_PRIVATE_KEY is not configured");
if (!CONTRACT_ADDRESS) throw new Error("CERTIFICATE_CONTRACT_ADDRESS is not configured");
const provider = new JsonRpcProvider(RPC_URL);

const wallet = new Wallet(PRIVATE_KEY, provider);

export const certificateRegistry = new Contract(
  CONTRACT_ADDRESS,
  CertificateRegistryArtifact.abi,
  wallet
);

export { provider, wallet };
