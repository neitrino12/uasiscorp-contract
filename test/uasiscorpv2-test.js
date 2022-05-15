const {expect} = require("chai");
const {ethers, waffle} = require("hardhat");

describe("UASISCorpV2", function () {
    const provider = waffle.provider;
    let contract, owner, addr1, addr2;

    before(async function () {
        [owner, addr1, addr2] = await ethers.getSigners();

        const Contract = await ethers.getContractFactory("UASISCorpV2");

        contract = await Contract.deploy("https://example.com/token/{id}.json", addr2.address);
        await contract.deployed();
    });

    it("should mint", async function () {
        const tokenId = 1;
        const amount = 3;
        const price = 0.01;

        const signatureId = await contract.mintIndex();

        let signature = getSignature(owner.address, price, tokenId, amount, signatureId);

        const mintTx = await contract.mint(ethers.utils.parseEther(price.toString()), tokenId, amount, signatureId, signature, {
            value: ethers.utils.parseEther((price * amount).toString())
        });
        await mintTx.wait();

        expect(await contract.balanceOf(owner.address, tokenId)).to.equal(amount);
        expect(await contract.totalSupply(1)).to.equal(3);

        await contract.mint(ethers.utils.parseEther(price.toString()), tokenId, amount, signatureId, signature, {
            value: ethers.utils.parseEther((price * amount).toString())
        }).catch((error) => {
            expect(error.message).to.equal("VM Exception while processing transaction: reverted with reason string 'signatureId already used'");
        });
    });

    it("should mint with error signatureId already use", async function () {
        const tokenId = 1;
        const amount = 3;
        const price = 0.01;

        const balance = await contract.balanceOf(owner.address, tokenId);

        const signatureId = 0;

        let signature = getSignature(owner.address, price, tokenId, amount, signatureId);

        await contract.mint(ethers.utils.parseEther(price.toString()), tokenId, amount, signatureId, signature, {
            value: ethers.utils.parseEther((price * amount).toString())
        }).catch((error) => {
            expect(error.message).to.equal("VM Exception while processing transaction: reverted with reason string 'signatureId already used'");
        });

        expect(await contract.balanceOf(owner.address, tokenId)).to.equal(balance);
    });

    it('should other mint', async function () {
        const tokenId = 1;
        const amount = 3;
        const price = 0.01;

        const signatureId = await contract.mintIndex();
        const signature = getSignature(addr1.address, price, tokenId, amount, signatureId);

        await contract.connect(addr1).mint(ethers.utils.parseEther(price.toString()), tokenId, amount, signatureId, signature, {
            value: ethers.utils.parseEther((price * amount).toString())
        });

        expect(await contract.balanceOf(addr1.address, tokenId)).to.equal(amount);
        expect(await contract.totalSupply(1)).to.equal(6);

        for (let i = 0; i < 10; i++) {
            const signatureId = await contract.mintIndex();
            const signature = getSignature(addr1.address, price, tokenId, amount, signatureId);

            const mintTx = await contract.connect(addr1).mint(ethers.utils.parseEther(price.toString()), tokenId, amount, signatureId, signature, {
                value: ethers.utils.parseEther((price * amount).toString())
            });
            await mintTx.wait();
        }
    });

    it('should mint with error incorrect price', async function () {
        const tokenId = 1;
        const amount = 3;
        const price = 0.01;

        const signatureId = await contract.mintIndex();

        let signature = getSignature(owner.address, price, tokenId, amount, signatureId);

        await contract.mint(ethers.utils.parseEther(price.toString()), tokenId, amount, signatureId, signature, {
            value: ethers.utils.parseEther("0")
        }).catch((error) => {
            expect(error.message).to.equal("VM Exception while processing transaction: reverted with reason string 'Ether value sent is not correct'");
        });
    });

    it('should mint with error bad parameters', async function () {
        const tokenId = 1;
        const amount = 3;
        const price = 0.01;

        const signatureId = await contract.mintIndex();

        let signature = getSignature(owner.address, price, tokenId, amount, signatureId);

        await contract.mint(ethers.utils.parseEther(price.toString()), 2, amount, signatureId, signature, {
            value: ethers.utils.parseEther((price * amount).toString())
        }).catch((error) => {
            expect(error.message).to.equal("VM Exception while processing transaction: reverted with reason string 'Not authorized to mint'");
        });
    });


    it("should burn tokens", async function () {
        const burnTx = await contract.burn(owner.address, 1, 1);
        await burnTx.wait();

        expect(await contract.balanceOf(owner.address, 1)).to.equal(2);
    });

    it("should set URI", async function () {
        const uri = "https://example.com/token2/{id}.json";
        const setUriTx = await contract.setURI(uri);
        await setUriTx.wait();
        expect(await contract.uri(1)).to.equal(uri);
    });

    it('should withdraw', async function () {
        const withdrawTx = await contract.withdraw();
        await withdrawTx.wait()

        expect(ethers.utils.formatEther(await provider.getBalance(contract.address))).to.equal("0.0");
    });

    it('should swapToken', async function () {
        const tokenId = 1;
        const newTokenId = 5;
        const amount = 1;
        const newAmount = 2;

        const oldTokenBalance = await contract.balanceOf(owner.address, tokenId)
        const newTokenBalance = await contract.balanceOf(owner.address, newTokenId)

        const signatureId = await contract.swapIndex();
        const signature = getSwapSignature(owner.address, tokenId, newTokenId, amount, newAmount, signatureId);

        await contract.swapToken(tokenId, newTokenId, amount, newAmount, signatureId, signature)

        expect(await contract.balanceOf(owner.address, tokenId)).to.equal(oldTokenBalance - amount)
        expect(await contract.balanceOf(owner.address, newTokenId)).to.equal(newTokenBalance + newAmount)
    });

    it('should swapToken with error', async function () {
        const tokenId = 1;
        const newTokenId = 5;
        const amount = 1;
        const newAmount = 2;

        const signatureId = 0;
        const signature = getSwapSignature(owner.address, tokenId, newTokenId, amount, newAmount, signatureId);

        await contract.swapToken(
            tokenId,
            newTokenId,
            amount,
            newAmount,
            signatureId,
            signature
        ).catch((error) => {
            expect(error.message).to.equal(
                "VM Exception while processing transaction: reverted with reason string 'swapSignatureId already used'"
            );
        });
    });

    it('should swapToken with signature error', async function () {
        const tokenId = 1;
        const newTokenId = 5;
        const amount = 1;
        const newAmount = 2;

        const signatureId = await contract.swapIndex();
        const signature = getSwapSignature(owner.address, tokenId, newTokenId, amount, newAmount, signatureId);

        await contract.swapToken(
            2,
            newTokenId,
            amount,
            newAmount,
            signatureId,
            signature
        ).catch((error) => {
            expect(error.message).to.equal(
                "VM Exception while processing transaction: reverted with reason string 'Not authorized to swap'"
            );
        });
    });

    it(`should mintBatch`, async function () {
        const tokenId = 999;
        const amount = 3;

        const mintTx = await contract.mintBatch(tokenId, [owner.address, addr1.address, addr2.address], [amount, amount, amount]);
        await mintTx.wait();

        const balances = await contract.balanceOfBatch([owner.address, addr1.address, addr2.address], [tokenId, tokenId, tokenId]);
        expect(
            balances.map(b => parseInt(b))
        ).to.deep.equal([amount, amount, amount]);
    });

    it(`should mintBatch with error`, async function () {
        const tokenId = 1999;
        const amount = 3;

        await contract.connect(addr1).mintBatch(
            tokenId,
            [owner.address, addr1.address, addr2.address],
            [amount, amount, amount]
        ).catch((error) => {
            expect(error.message).to.equal(
                "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'"
            );
        });

    });



    async function getSignature(wallet, price, tokenId, amount, signatureId) {
        const hash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ['address', 'uint256', 'uint256', 'uint256', 'uint256'],
                [wallet, ethers.utils.parseEther(price.toString()), tokenId, amount, signatureId]
            )
        );

        return await addr2.signMessage(ethers.utils.arrayify(hash));
    }

    async function getSwapSignature(wallet, tokenId, newTokenId, amount, newAmount, signatureId) {
        const hash = ethers.utils.keccak256(
            ethers.utils.defaultAbiCoder.encode(
                ['address', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
                [wallet, tokenId, newTokenId, amount, newAmount, signatureId]
            )
        );

        return await addr2.signMessage(ethers.utils.arrayify(hash));
    }
});
