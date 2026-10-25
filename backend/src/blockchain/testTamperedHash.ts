import { verifyCertificate } from "./certificateService.js";

const result = await verifyCertificate(
  "6",
  "0x0000000000000000000000000000000000000000000000000000000000000000"
);

console.log("Tampered hash verification result:", result);

if (result !== false) {
  console.error("FAIL: Unexpected verification result");
  process.exitCode = 1;
}
