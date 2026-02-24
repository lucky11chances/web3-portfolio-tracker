const hre = require("hardhat");

async function main() {
    const account = (await hre.ethers.getSigners())[0];
    const { deployer } = await hre.getNamedAccounts();
    const MyContract = await hre.ethers.getContract("PortfolioTracker", account);

    console.log("Setting up mock prices from owner:", account.address, "deployer was:", deployer);

    const mockPrices = [
        { asset: 0n, price: 6500000000000n, enabled: true },
        { asset: 1n, price: 220000000000n, enabled: true },
        { asset: 2n, price: 1500000000n, enabled: true },
        { asset: 3n, price: 11000000000n, enabled: true },
        { asset: 4n, price: 50000000n, enabled: true },
        { asset: 5n, price: 3000n, enabled: true },
        { asset: 6n, price: 500000000n, enabled: true },
        { asset: 7n, price: 150000000n, enabled: true },
        { asset: 8n, price: 15000000n, enabled: true },
        { asset: 9n, price: 8000000000n, enabled: true },
        { asset: 10n, price: 750000000n, enabled: true }
    ];

    for (const mp of mockPrices) {
        try {
            console.log(`Setting price for asset ${mp.asset}...`);
            const tx = await MyContract.setManualPrice(mp.asset, mp.price, mp.enabled, {
                gasLimit: 500000 // force a gas limit so it doesn't fail estimation
            });
            await tx.wait();
        } catch (e) {
            console.log("Error setting asset", mp.asset, e.message);
        }
    }

    console.log("Mock prices set successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
