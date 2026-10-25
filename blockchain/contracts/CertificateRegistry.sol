// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract CertificateRegistry {
    struct Certificate {
        bytes32 certificateHash;
        address issuer;
        uint256 issuedAt;
        bool revoked;
    }

    address public owner;
    uint256 private nextCertificateId = 1;

    mapping(uint256 => Certificate) public certificates;
    mapping(address => bool) public authorizedIssuers;
    mapping(bytes32 => bool) public registeredHashes;

    event IssuerAuthorizationChanged(address indexed issuer, bool authorized);
    event CertificateIssued(
        uint256 indexed certificateId,
        bytes32 indexed certificateHash,
        address indexed issuer,
        uint256 issuedAt
    );
    event CertificateRevoked(uint256 indexed certificateId);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedIssuers[msg.sender] = true;
        emit IssuerAuthorizationChanged(msg.sender, true);
    }

    function setIssuer(address issuer, bool authorized) external onlyOwner {
        require(issuer != address(0), "Invalid issuer address");
        authorizedIssuers[issuer] = authorized;
        emit IssuerAuthorizationChanged(issuer, authorized);
    }

    function issueCertificate(bytes32 certificateHash) external returns (uint256) {
        require(authorizedIssuers[msg.sender], "Issuer not authorized");
        require(certificateHash != bytes32(0), "Certificate hash cannot be empty");
        require(!registeredHashes[certificateHash], "Certificate hash already registered");

        uint256 certificateId = nextCertificateId;
        certificates[certificateId] = Certificate({
            certificateHash: certificateHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            revoked: false
        });

        registeredHashes[certificateHash] = true;
        nextCertificateId++;

        emit CertificateIssued(certificateId, certificateHash, msg.sender, block.timestamp);
        return certificateId;
    }

    function revokeCertificate(uint256 certificateId) external {
        Certificate storage certificate = certificates[certificateId];
        require(certificate.issuedAt != 0, "Certificate does not exist");
        require(certificate.issuer == msg.sender, "Only issuer can revoke");
        require(!certificate.revoked, "Certificate already revoked");

        certificate.revoked = true;
        emit CertificateRevoked(certificateId);
    }

    function verifyCertificate(
        uint256 certificateId,
        bytes32 certificateHash
    ) external view returns (bool) {
        Certificate memory certificate = certificates[certificateId];
        if (certificate.issuedAt == 0 || certificate.revoked) return false;
        return certificate.certificateHash == certificateHash;
    }
}
