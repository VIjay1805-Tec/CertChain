import { issueCertificate } from "./certificateService.js";
async function main() {
    console.log("Issuing test certificate...");
    const certificateHash = "0x1111111111111111111111111111111111111111111111111111111111111111";
    console.log("Certificate hash:", certificateHash);
    const result = await issueCertificate(certificateHash);
    console.log("Certificate issued successfully!");
    console.log("Blockchain certificate ID:", result.certificateId);
    console.log("Transaction hash:", result.transactionHash);
}
main().catch((error) => {
    console.error("Certificate issuance failed:", error);
});
//# sourceMappingURL=testIssueCertificate.js.map