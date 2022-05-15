const {expect} = require("chai");
const {ethers, waffle} = require("hardhat");

describe("UASISCorp", function () {
    const provider = waffle.provider;
    let contract, owner, addr1, addr2;

    before(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const Contract = await ethers.getContractFactory("UASISCorp");

        contract = await Contract.deploy("https://example.com/token/{id}.json", addr2.address);
        await contract.deployed();
    });

    it("Minting tokens", async function () {
        const tokenId = 1;
        const amount = 3;
        const price = 0.01;

        let signature = getSignature(owner.address, price, tokenId, amount);

        const mintTx = await contract.mint(ethers.utils.parseEther(price.toString()), tokenId, amount, signature, {
            value: ethers.utils.parseEther((price * amount).toString())
        });
        await mintTx.wait();

        expect(await contract.balanceOf(owner.address, tokenId)).to.equal(amount);
        expect(await contract.totalSupply(1)).to.equal(3);

        signature = getSignature(addr1.address, price, tokenId, amount);
        await contract.connect(addr1).mint(ethers.utils.parseEther(price.toString()), tokenId, amount, signature, {
            value: ethers.utils.parseEther((price * amount).toString())
        });

        expect(await contract.balanceOf(addr1.address, tokenId)).to.equal(amount);
        expect(await contract.totalSupply(1)).to.equal(6);
    });

    it("Checking tokens", async function () {
        expect(await contract.balanceOf(owner.address, 1)).to.equal(3);
    });

    it("Token uri", async function () {
        expect(await contract.uri(1)).to.equal("https://example.com/token/{id}.json");
    });

    it("Burning tokens", async function () {
        const burnTx = await contract.burn(owner.address, 1, 1);
        await burnTx.wait();

        expect(await contract.balanceOf(owner.address, 1)).to.equal(2);
        expect(await contract.totalSupply(1)).to.equal(5);
    });

    it("Set URI", async function () {
        const uri = "https://example.com/token2/{id}.json";
        const setUriTx = await contract.setURI(uri);
        await setUriTx.wait();
        expect(await contract.uri(1)).to.equal(uri);
    });

    it('should withdraw', async function () {
        expect(ethers.utils.formatEther(await provider.getBalance(contract.address))).to.equal("0.06");

        const withdrawTx = await contract.withdraw();
        await withdrawTx.wait()

        expect(ethers.utils.formatEther(await provider.getBalance(contract.address))).to.equal("0.0");
    });

    it('should totalSupply', async function () {
        expect(await contract.totalSupply(1)).to.equal(5);
        expect(await contract.totalSupply(2)).to.equal(0);
    });

    async function getSignature(addr, price, tokenId, amount) {
        const hash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint256', 'uint256', 'uint256'],
            [addr, ethers.utils.parseEther(price.toString()), tokenId, amount])
        );

        return await addr2.signMessage(ethers.utils.arrayify(hash));
    }
});
