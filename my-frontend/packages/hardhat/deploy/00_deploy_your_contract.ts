import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

const deployPortfolioTracker: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("PortfolioTracker", {
    from: deployer,
    log: true,
    proxy: {
      proxyContract: "UUPS",
      execute: {
        init: {
          methodName: "initialize",
          args: [],
        },
      },
      upgradeFunction: {
        methodName: "upgradeToAndCall",
        upgradeArgs: ["{implementation}", "0x"],
      },
    },
    autoMine: true,
  });

  const portfolioTracker = await hre.ethers.getContract<Contract>("PortfolioTracker", deployer);
  console.log("PortfolioTracker deployed at:", await portfolioTracker.getAddress());
};

export default deployPortfolioTracker;

deployPortfolioTracker.tags = ["PortfolioTracker"];
