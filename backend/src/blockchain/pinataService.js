export async function uploadCertificateToIPFS(certificateData, fileName, mimeType) {
    const jwt = process.env.PINATA_JWT;
    if (!jwt) {
        throw new Error("PINATA_JWT is not configured");
    }
    const gateway = process.env.PINATA_GATEWAY;
    if (!gateway) {
        throw new Error("PINATA_GATEWAY is not configured");
    }
    const formData = new FormData();
    const fileBytes = Buffer.isBuffer(certificateData)
        ? certificateData
        : Buffer.from(certificateData, "utf-8");
    const file = new Blob([fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength)], {
        type: mimeType,
    });
    formData.append("file", file, fileName);
    formData.append("network", "public");
    const response = await fetch("https://uploads.pinata.cloud/v3/files", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${jwt}`,
        },
        body: formData,
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Pinata upload failed: ${response.status} ${errorText}`);
    }
    const result = await response.json();
    const cid = result.data.cid;
    return {
        cid,
        name: result.data.name,
        size: result.data.size,
        mimeType: result.data.mime_type,
        ipfsUrl: `https://${gateway}/ipfs/${cid}`,
    };
}
//# sourceMappingURL=pinataService.js.map