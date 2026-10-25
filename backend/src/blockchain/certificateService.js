import { certificateRegistry } from "./contract.js";
export async function issueCertificate(certificateHash) {
    const issueCertificateFunction = certificateRegistry.getFunction("issueCertificate");
    if (!issueCertificateFunction) {
        throw new Error("issueCertificate function not found in contract");
    }
    // Send transaction to Solidity contract
    const tx = await issueCertificateFunction(certificateHash);
    console.log("Blockchain transaction submitted:", tx.hash);
    // Wait for blockchain confirmation
    const receipt = await tx.wait();
    if (!receipt) {
        throw new Error("Blockchain transaction receipt not received");
    }
    console.log("Blockchain transaction hash:", receipt.hash);
    console.log("Blockchain receipt logs:", receipt.logs);
    let certificateId = null;
    // Find CertificateIssued event
    for (const log of receipt.logs) {
        try {
            const parsed = certificateRegistry.interface.parseLog({
                topics: [...log.topics],
                data: log.data,
            });
            console.log("Parsed blockchain log:", parsed);
            if (parsed &&
                parsed.name === "CertificateIssued") {
                certificateId =
                    parsed.args[0].toString();
                console.log("CertificateIssued event found. Certificate ID:", certificateId);
                break;
            }
        }
        catch (error) {
            console.log("Could not parse blockchain log:", error);
        }
    }
    if (!certificateId) {
        throw new Error("CertificateIssued event not found");
    }
    return {
        certificateId,
        transactionHash: receipt.hash,
    };
}
export async function verifyCertificate(certificateId, certificateHash) {
    const verifyCertificateFunction = certificateRegistry.getFunction("verifyCertificate");
    if (!verifyCertificateFunction) {
        throw new Error("verifyCertificate function not found in contract");
    }
    const result = await verifyCertificateFunction(certificateId, certificateHash);
    return result;
}
//# sourceMappingURL=certificateService.js.map