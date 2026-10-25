import { PDFParse } from "pdf-parse";
import Tesseract from "tesseract.js";

export type AIForgeryVerdict =
  | "genuine"
  | "suspicious"
  | "forged"
  | "invalid";

export interface AIForgeryAnalysis {
  verdict: AIForgeryVerdict;
  confidenceScore: number;
  forgeryProbability: number;
  indicators: string[];
  analysisDetails: string;
  modelName: string;
  pageCount: number;
  textLength: number;
}

function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

async function extractCertificateText(
  certificateBuffer: Buffer
): Promise<{ text: string; pageCount: number; cleanup?: () => Promise<void> }> {
  if (isPdf(certificateBuffer)) {
    const parser = new PDFParse({
      data: new Uint8Array(certificateBuffer),
    });

    const textResult = await parser.getText();
    const infoResult = await parser.getInfo();

    return {
      text: textResult.text?.trim() || "",
      pageCount: infoResult.total || 0,
      cleanup: async () => {
        await parser.destroy();
      },
    };
  }

  const ocrResult = await Tesseract.recognize(
    certificateBuffer,
    "eng",
    {
      logger: () => undefined,
    }
  );

  return {
    text: ocrResult.data.text?.trim() || "",
    pageCount: 1,
  };
}

interface PythonAIResponse {
  success: boolean;
  prediction: "genuine" | "suspicious" | "forged";
  forgery_probability: number;
  confidence: number;
  model: string;
  model_status: string;
}

async function analyzeWithPythonAI(
  certificateBuffer: Buffer
): Promise<PythonAIResponse> {
  let mimeType: string;
  let filename: string;

  if (isPdf(certificateBuffer)) {
    mimeType = "application/pdf";
    filename = "certificate.pdf";
  } else if (
    certificateBuffer.length >= 8 &&
    certificateBuffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    mimeType = "image/png";
    filename = "certificate.png";
  } else if (
    certificateBuffer.length >= 3 &&
    certificateBuffer.subarray(0, 3).equals(
      Buffer.from([255, 216, 255])
    )
  ) {
    mimeType = "image/jpeg";
    filename = "certificate.jpg";
  } else if (
    certificateBuffer.length >= 12 &&
    certificateBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    certificateBuffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    mimeType = "image/webp";
    filename = "certificate.webp";
  } else if (
    certificateBuffer.length >= 2 &&
    certificateBuffer.subarray(0, 2).toString("ascii") === "BM"
  ) {
    mimeType = "image/bmp";
    filename = "certificate.bmp";
  } else {
    throw new Error("Certificate file type is not supported by the Python AI service");
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(certificateBuffer)], {
      type: mimeType,
    }),
    filename
  );

  const aiUrl = process.env.PYTHON_AI_URL || "http://127.0.0.1:8000";
  const response = await fetch(`${aiUrl.replace(/\/+$/, "")}/analyze`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Python AI service returned HTTP ${response.status}`);
  }

  const result: unknown = await response.json();

  if (
    typeof result !== "object" ||
    result === null ||
    !("success" in result) ||
    result.success !== true ||
    !("prediction" in result) ||
    !["genuine", "suspicious", "forged"].includes(String(result.prediction)) ||
    !("confidence" in result) ||
    typeof result.confidence !== "number" ||
    !("forgery_probability" in result) ||
    typeof result.forgery_probability !== "number" ||
    !("model" in result) ||
    typeof result.model !== "string" ||
    !("model_status" in result) ||
    typeof result.model_status !== "string"
  ) {
    throw new Error("Python AI service returned an invalid response");
  }

  return result as PythonAIResponse;
}
export async function analyzeCertificateWithAI(
  ipfsUrl: string,
  expectedSha256: string
): Promise<AIForgeryAnalysis> {
  if (!ipfsUrl) {
    throw new Error("Certificate IPFS URL is missing");
  }

  const response = await fetch(ipfsUrl);

  if (!response.ok) {
    throw new Error(
      `Unable to download certificate from IPFS: ${response.status}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const certificateBuffer = Buffer.from(arrayBuffer);

  if (certificateBuffer.length === 0) {
    throw new Error("Downloaded certificate is empty");
  }

  const actualSha256 = await crypto.subtle.digest(
    "SHA-256",
    certificateBuffer
  );

  const actualHash = Buffer.from(actualSha256)
    .toString("hex")
    .toLowerCase();

  const normalizedExpectedHash = expectedSha256.trim().toLowerCase().replace(/^0x/, "");

  const extracted = await extractCertificateText(certificateBuffer);
  const text = extracted.text;
  const pageCount = extracted.pageCount;
  const indicators: string[] = [];

  try {
    if (pageCount === 0) {
      indicators.push("Certificate contains no readable pages");
    }

    if (text.length < 100) {
      indicators.push("Certificate contains very little extractable text");
    }

    if (text.length > 200000) {
      indicators.push("Certificate contains unusually large amounts of text");
    }

    if (
      normalizedExpectedHash &&
      actualHash !== normalizedExpectedHash
    ) {
      indicators.push("Downloaded certificate hash differs from stored hash");
    }

    const hasCertificateKeywords =
      /certificate|degree|diploma|university|institute|student|academic|marks|grade/i.test(
        text
      );

    if (!hasCertificateKeywords) {
      indicators.push(
        "Expected academic certificate terminology was not detected"
      );
    }

    const pythonAnalysis = await analyzeWithPythonAI(certificateBuffer);

    let verdict: AIForgeryVerdict = pythonAnalysis.prediction;
    let confidenceScore = Math.round(pythonAnalysis.confidence * 100);

    const hashMismatch =
      Boolean(normalizedExpectedHash) &&
      actualHash !== normalizedExpectedHash;

    if (pythonAnalysis.model_status !== "trained") {
      verdict = "suspicious";
      confidenceScore = Math.min(confidenceScore, 60);
      indicators.push(
        "Python AI used a development fallback; trained-model results are unavailable"
      );
    }

    if (hashMismatch) {
      verdict = "forged";
      confidenceScore = 99;
    } else if (
      verdict === "genuine" &&
      (pageCount === 0 || text.length < 100 || !hasCertificateKeywords)
    ) {
      verdict = "suspicious";
      confidenceScore = Math.min(confidenceScore, 70);
    }

    return {
      verdict,
      confidenceScore,
      forgeryProbability: Math.round(pythonAnalysis.forgery_probability * 10000) / 100,
      indicators,
      analysisDetails:
        indicators.length > 0
          ? indicators.join("; ")
          : verdict === "genuine"
            ? "Certificate passed all document integrity and academic-content checks."
            : verdict === "suspicious"
              ? "Certificate requires further review; the AI analysis could not confirm that all checks passed."
              : "Certificate failed verification and may be forged.",
      modelName: `CertChain AI + ${pythonAnalysis.model}`,
      pageCount,
      textLength: text.length,
    };
  } finally {
    if (extracted.cleanup) {
      await extracted.cleanup();
    }
  }
}




