import dotenv from "dotenv";
import { uploadCertificateToIPFS } from "./pinataService.js";
dotenv.config();
async function main() {
    console.log("Testing Pinata...");
    const result = await uploadCertificateToIPFS("TEST CERTIFICATE FOR PINATA", "test-certificate.txt", "text/plain");
    console.log("Pinata upload successful");
    console.log("CID:", result.cid);
    console.log("Name:", result.name);
    console.log("Size:", result.size);
}
main().catch((error) => {
    console.error("Pinata upload failed:", error);
    process.exit(1);
});
//# sourceMappingURL=testPinata.js.map