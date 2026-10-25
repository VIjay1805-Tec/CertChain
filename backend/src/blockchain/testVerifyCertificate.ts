
import dotenv from "dotenv";
import pool from "../config/database.js";
import { verifyCertificate } from "./certificateService.js";

dotenv.config();

async function main() {
  console.log("Verifying certificate from PostgreSQL...");

  const result = await pool.query(`
    SELECT
      id,
      sha256_hash,
      blockchain_certificate_id,
      blockchain_status
    FROM certificates
    WHERE blockchain_status = 'confirmed'
    ORDER BY id DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    throw new Error("No confirmed certificate found");
  }

  const certificate = result.rows[0];

  if (!certificate.blockchain_certificate_id) {
    throw new Error(
      "Certificate does not have a blockchain certificate ID"
    );
  }

  if (!certificate.sha256_hash) {
    throw new Error(
      "Certificate does not have a SHA-256 hash"
    );
  }

  const certificateId =
    certificate.blockchain_certificate_id.toString().trim();

  const certificateHash =
    certificate.sha256_hash
      .toString()
      .trim()
      .toLowerCase()
      .replace(/^0x/, "");

  if (!/^[a-f0-9]{64}$/.test(certificateHash)) {
    throw new Error(
      `Invalid SHA-256 hash: ${certificateHash}`
    );
  }

  const blockchainHash = `0x${certificateHash}`;

  console.log("PostgreSQL certificate ID:", certificate.id);
  console.log(
    "Blockchain certificate ID:",
    certificateId
  );
  console.log(
    "SHA-256 hash:",
    certificateHash
  );
  console.log(
    "Blockchain hash:",
    blockchainHash
  );

  const verified = await verifyCertificate(
    certificateId,
    blockchainHash
  );

  console.log("Verification result:", verified);

  await pool.end();
}

main().catch((error: unknown) => {
  console.error("Verification failed:");

  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exit(1);
});

