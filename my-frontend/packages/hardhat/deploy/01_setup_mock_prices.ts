import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

const setupMockPrices: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployer } = await hre.getNamedAccounts();
    const portfolioTracker = await hre.ethers.getContract<Contract>("PortfolioTracker", deployer);

    console.log("Setting up mock manual prices...");

    const mockPrices = [
        { asset: 0n, price: 6500000000000n, enabled: true }, // BTC 65k (Profit)
        { asset: 1n, price: 220000000000n, enabled: true },  // ETH 2.2k (Loss)
        { asset: 2n, price: 1500000000n, enabled: true },    // LINK 15 (Profit)
        { asset: 3n, price: 11000000000n, enabled: true },   // SOL 110 (Profit)
        { asset: 4n, price: 50000000n, enabled: true },      // ADA 0.5 (Loss)
        { asset: 5n, price: 3000n, enabled: true },          // SHIB 0.00003 (Profit)
        { asset: 6n, price: 500000000n, enabled: true },     // ATOM 5 (Loss)
        { asset: 7n, price: 150000000n, enabled: true },     // SUI 1.5 (Loss)
        { asset: 8n, price: 15000000n, enabled: true },      // CRO 0.15 (Profit)
        { asset: 9n, price: 8000000000n, enabled: true },    // CIRCLE 80 (Profit)
        { asset: 10n, price: 750000000n, enabled: true },    // TRON 7.5 (Loss)
    ];

    for (const mp of mockPrices) {
        console.log(`Setting price for asset ${mp.asset} to ${mp.price}...`);
        const tx = await portfolioTracker.setManualPrice(mp.asset, mp.price, mp.enabled, {
            gasLimit: 3000000
        });
        await tx.wait();
    }

    console.log("Mock prices set successfully!");
};

export default setupMockPrices;
setupMockPrices.tags = ["MockPrices"];
