import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("CertificateRegistry", function () {
  async function deployRegistry() {
    const registry = await ethers.deployContract("CertificateRegistry");
    await registry.waitForDeployment();
    return registry;
  }

  const certificateHash = ethers.keccak256(
    ethers.toUtf8Bytes("certchain-test-certificate")
  );

  it("issues a certificate and emits CertificateIssued", async function () {
    const registry = await deployRegistry();
    const [issuer] = await ethers.getSigners();

    await expect(registry.issueCertificate(certificateHash))
      .to.emit(registry, "CertificateIssued")
      .withArgs(1n, certificateHash, issuer.address, (value: bigint) => value > 0n);
  });

  it("rejects an empty certificate hash", async function () {
    const registry = await deployRegistry();
    await expect(registry.issueCertificate(ethers.ZeroHash))
      .to.be.revertedWith("Certificate hash cannot be empty");
  });

  it("verifies a matching hash and rejects a wrong hash", async function () {
    const registry = await deployRegistry();
    await registry.issueCertificate(certificateHash);
    expect(await registry.verifyCertificate(1n, certificateHash)).to.equal(true);
    expect(await registry.verifyCertificate(
      1n, ethers.keccak256(ethers.toUtf8Bytes("wrong-certificate"))
    )).to.equal(false);
  });

  it("returns false for a non-existent certificate ID", async function () {
    const registry = await deployRegistry();
    expect(await registry.verifyCertificate(999n, certificateHash)).to.equal(false);
  });

  it("prevents a different wallet from revoking a certificate", async function () {
    const registry = await deployRegistry();
    const [, otherWallet] = await ethers.getSigners();
    await registry.issueCertificate(certificateHash);
    await expect(
      registry.connect(otherWallet).revokeCertificate(1n)
    ).to.be.revertedWith("Only issuer can revoke");
  });

  it("rejects verification after the issuer revokes a certificate", async function () {
    const registry = await deployRegistry();
    await registry.issueCertificate(certificateHash);
    await registry.revokeCertificate(1n);
    expect(await registry.verifyCertificate(1n, certificateHash)).to.equal(false);
  });

  it("rejects issuance from an unauthorized wallet", async function () {
    const registry = await deployRegistry();
    const [, unauthorizedWallet] = await ethers.getSigners();
    await expect(
      registry.connect(unauthorizedWallet).issueCertificate(certificateHash)
    ).to.be.revertedWith("Issuer not authorized");
  });

  it("rejects registering the same certificate hash twice", async function () {
    const registry = await deployRegistry();
    await registry.issueCertificate(certificateHash);
    await expect(
      registry.issueCertificate(certificateHash)
    ).to.be.revertedWith("Certificate hash already registered");
  });

  it("allows only the owner to authorize issuers", async function () {
    const registry = await deployRegistry();
    const [owner, , newIssuer, otherWallet] = await ethers.getSigners();
    await expect(registry.setIssuer(newIssuer.address, true))
      .to.emit(registry, "IssuerAuthorizationChanged")
      .withArgs(newIssuer.address, true);
    expect(await registry.authorizedIssuers(newIssuer.address)).to.equal(true);
    await expect(
      registry.connect(otherWallet).setIssuer(newIssuer.address, false)
    ).to.be.revertedWith("Only owner");
    expect(await registry.owner()).to.equal(owner.address);
  });

  it("rejects revoking an already revoked certificate", async function () {
    const registry = await deployRegistry();
    await registry.issueCertificate(certificateHash);
    await registry.revokeCertificate(1n);
    await expect(
      registry.revokeCertificate(1n)
    ).to.be.revertedWith("Certificate already revoked");
  });
});
