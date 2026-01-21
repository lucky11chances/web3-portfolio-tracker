const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("PortfolioTracker (UUPS)", function () {
    let portfolio;
    let owner;
    let otherAccount;
    let mockBtcFeed;
    let mockEthFeed;

    const ASSET_BTC = 0;
    const ASSET_ETH = 1;
    const ASSET_ADA = 4; // Use for manual price test

    beforeEach(async function () {
        [owner, otherAccount] = await ethers.getSigners();

        // Deploy Mocks
        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        // BTC $60,000 with 8 decimals
        mockBtcFeed = await MockV3Aggregator.deploy(8, 6000000000000);
        // ETH $3,000 with 8 decimals
        mockEthFeed = await MockV3Aggregator.deploy(8, 300000000000);

        // Deploy Portfolio
        const Portfolio = await ethers.getContractFactory("PortfolioTracker");
        portfolio = await upgrades.deployProxy(Portfolio, [], {
            initializer: 'initialize',
            kind: 'uups'
        });
        await portfolio.waitForDeployment();
    });

    describe("Initialization", function () {
        it("Should initialize with default positions", async function () {
            // Check BTC position from constructor/initializer: 
            // positions[AssetId.BTC] = Position(310_000_000, 6_000_000_000_000, 0); // 3.1 BTC @ $60,000
            const btcPos = await portfolio.positions(ASSET_BTC);
            expect(btcPos.amount).to.equal(310000000n);
        });

        it("Should be owned by deployer", async function () {
            expect(await portfolio.owner()).to.equal(owner.address);
        });
    });

    describe("Price Feeds", function () {
        it("Should set and get Chainlink price feeds", async function () {
            await portfolio.setPriceFeed(ASSET_BTC, await mockBtcFeed.getAddress());

            // safeGetPriceUsdScaled returns price with 8 decimals
            // Match the mock value: 6000000000000
            const price = await portfolio.safeGetPriceUsdScaled(ASSET_BTC);
            expect(price).to.equal(6000000000000n);
        });

        it("Should fail if non-owner tries to set feed", async function () {
            await expect(
                portfolio.connect(otherAccount).setPriceFeed(ASSET_BTC, await mockBtcFeed.getAddress())
            ).to.be.revertedWithCustomError(portfolio, "OwnableUnauthorizedAccount");
        });
    });

    describe("Manual Price Fallback", function () {
        it("Should use manual price when enabled", async function () {
            // Set ADA manual price to $1.50 (150000000)
            const manualPrice = 150000000n;
            await portfolio.setManualPrice(ASSET_ADA, manualPrice, true);

            const price = await portfolio.safeGetPriceUsdScaled(ASSET_ADA);
            expect(price).to.equal(manualPrice);
        });

        it("Should favor manual price over Chainlink if 'useManualPrice' is true", async function () {
            // Set feed first
            await portfolio.setPriceFeed(ASSET_BTC, await mockBtcFeed.getAddress());

            // Enable manual override: $100,000 BTC
            const overridePrice = 10000000000000n;
            await portfolio.setManualPrice(ASSET_BTC, overridePrice, true);

            const price = await portfolio.safeGetPriceUsdScaled(ASSET_BTC);
            expect(price).to.equal(overridePrice);
        });
    });

    describe("Portfolio Reporting", function () {
        it("Should calculate asset value correctly", async function () {
            // 3.1 BTC @ $60,000 (mock price)
            // Amount: 310,000,000 (1e8 scaled)
            // Price: 60,000 * 1e8

            await portfolio.setPriceFeed(ASSET_BTC, await mockBtcFeed.getAddress());

            const report = await portfolio.getAssetReport(ASSET_BTC);

            // valueUsd = (amount * price) / 1e8
            // (3.1 * 1e8 * 60000 * 1e8) / 1e8 = 186000 * 1e8 = 18600000000000
            const expectedValue = 18600000000000n;
            expect(report.valueUsd).to.equal(expectedValue);
            expect(report.priceOk).to.be.true;
        });

        it("Should return correct Asset Class from V2 logic", async function () {
            // BTC should be in CRYPTOS class by default initialization
            const report = await portfolio.getAssetReport(ASSET_BTC);
            // We need to check the class ID or the class name if exposed, 
            // but getAssetReport returns the V1 enum in 'assetClass' field for compatibility? 
            // Actually checking the code, 'assetClass' is the enum from mapping.
            // The V2 classes are in 'assetClassId' mapping.

            // Let's check the V2 assignment
            const classId = await portfolio.assetClassId(ASSET_BTC);
            // The first class created in _initV2DynamicClasses is CRYPTOS, so ID 1.
            expect(classId).to.equal(1n);

            const classInfo = await portfolio.getClassInfo(1);
            expect(classInfo.name).to.equal("CRYPTOS");
        });
    });

    describe("V2 Dynamic Classes", function () {
        it("Should allow owner to create new classes", async function () {
            await portfolio.createClass("HighRisk", 1); // Parent: CRYPTOS (1)
            const classInfo = await portfolio.getClassInfo(3); // 1=Crypto, 2=Stocks, 3=HighRisk
            expect(classInfo.name).to.equal("HighRisk");
            expect(classInfo.parentId).to.equal(1n);
        });
    });
});
