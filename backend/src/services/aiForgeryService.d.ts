export type AIForgeryVerdict = "genuine" | "suspicious" | "forged" | "invalid";
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
export declare function analyzeCertificateWithAI(ipfsUrl: string, expectedSha256: string): Promise<AIForgeryAnalysis>;
//# sourceMappingURL=aiForgeryService.d.ts.map