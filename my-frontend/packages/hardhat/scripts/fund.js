const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    // Assuming the burner wallet is 0xdE1991A726cE6b2C758BB8EE526053088A9d9441 from the screenshot
    const burnerAddress = "0xdE1991A726cE6b2C758BB8EE526053088A9d9441";

    console.log("Funding burner wallet:", burnerAddress);

    const tx = await deployer.sendTransaction({
        to: burnerAddress,
        value: hre.ethers.parseEther("1.0"), // Send 1 ETH
        gasLimit: 21000
    });

    await tx.wait();
    console.log("Successfully funded burner wallet with 1 ETH!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
