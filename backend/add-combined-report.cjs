const fs = require("fs");

const filePath = "./src/routes/companyRoutes.ts";
let content = fs.readFileSync(filePath, "utf8");

const marker = `        return res.json({
          success: true,
          message: "AI forgery verification completed successfully",`;

const block = String.raw`        // =====================================================
        // COMBINED VERIFICATION REPORT
        // =====================================================

        if (verificationRequest.verification_type === "combined") {
          const combinedFinalStatus =
            analysis.verdict === "genuine"
              ? "verified"
              : analysis.verdict === "suspicious"
                ? "suspicious"
                : "invalid";

          await pool.query(
            \`
            INSERT INTO verification_reports (
              verification_request_id,
              blockchain_result,
              ai_result,
              final_status,
              blockchain_hash_match,
              ai_confidence_score,
              report_data,
              generated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
            ON CONFLICT (verification_request_id)
            DO UPDATE SET
              blockchain_result = EXCLUDED.blockchain_result,
              ai_result = EXCLUDED.ai_result,
              final_status = EXCLUDED.final_status,
              blockchain_hash_match = EXCLUDED.blockchain_hash_match,
              ai_confidence_score = EXCLUDED.ai_confidence_score,
              report_data = EXCLUDED.report_data,
              generated_at = NOW()
            \`,
            [
              verificationRequestId,
              "verified",
              analysis.verdict,
              combinedFinalStatus,
              true,
              analysis.confidenceScore,
              JSON.stringify({
                type: "combined",
                blockchain_result: "verified",
                blockchain_hash_match: true,
                model_name: analysis.modelName,
                ai_verdict: analysis.verdict,
                indicators: analysis.indicators,
                analysis_details: analysis.analysisDetails,
                page_count: analysis.pageCount,
                text_length: analysis.textLength,
              }),
            ]
          );

          await pool.query(
            \`
            UPDATE verification_requests
            SET
              status = 'completed',
              completed_at = NOW()
            WHERE id = $1
            \`,
            [verificationRequestId]
          );
        }

`;

if (content.includes("// COMBINED VERIFICATION REPORT")) {
  console.log("Combined report logic already exists. No changes made.");
  process.exit(0);
}

if (!content.includes(marker)) {
  console.error("Insertion marker not found. No changes made.");
  process.exit(1);
}

content = content.replace(marker, block + marker);
fs.writeFileSync(filePath, content, "utf8");

console.log("Combined verification report logic inserted successfully.");
