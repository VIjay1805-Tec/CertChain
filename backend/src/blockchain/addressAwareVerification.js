import { Contract } from "ethers";
import CertificateRegistryArtifact from "../../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json" with { type: "json" };
import { provider } from "./contract.js";
export async function verifyCertificateAtAddress(contractAddress, certificateId, certificateHash) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        throw new Error("Invalid certificate contract address");
    }
    const registry = new Contract(contractAddress, CertificateRegistryArtifact.abi, provider);
    const verify = registry.getFunction("verifyCertificate");
    return await verify(certificateId, certificateHash);
}
//# sourceMappingURL=addressAwareVerification.js.map