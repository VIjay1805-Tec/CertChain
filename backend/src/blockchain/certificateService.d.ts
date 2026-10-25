export declare function issueCertificate(certificateHash: string): Promise<{
    certificateId: string;
    transactionHash: any;
}>;
export declare function verifyCertificate(certificateId: string, certificateHash: string): Promise<boolean>;
//# sourceMappingURL=certificateService.d.ts.map