import { certificateRegistry } from "./contract.js";
async function main() {
    const provider = certificateRegistry.runner?.provider;
    if (!provider) {
        throw new Error("Blockchain provider is not available");
    }
    const blockNumber = await provider.getBlockNumber();
    console.log("Blockchain connection successful");
    console.log("Current block:", blockNumber);
    const certificatesFunction = certificateRegistry.getFunction("certificates");
    if (!certificatesFunction) {
        throw new Error("certificates function not found in contract");
    }
    const certificate = await certificatesFunction(1);
    console.log("Certificate #1:", certificate);
}
main().catch((error) => {
    console.error("Blockchain connection failed:");
    if (error instanceof Error) {
        console.error(error.message);
    }
    else {
        console.error(error);
    }
    process.exitCode = 1;
});
//# sourceMappingURL=testConnection.js.map