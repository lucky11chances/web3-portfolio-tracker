const { ethers, upgrades } = require("hardhat");

async function main() {
    const Portfolio = await ethers.getContractFactory("PortfolioTracker");
    console.log("Deploying Portfolio...");

    // Deploying as UUPS Proxy
    // initialize() function takes no arguments
    const portfolio = await upgrades.deployProxy(Portfolio, [], {
        initializer: 'initialize',
        kind: 'uups'
    });

    await portfolio.waitForDeployment();
    console.log("Portfolio deployed to:", await portfolio.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
