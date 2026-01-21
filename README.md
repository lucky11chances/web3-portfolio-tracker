# Web3 Multi-Asset Portfolio Tracker (Upgradeable)

![Solidity](https://img.shields.io/badge/Solidity-0.8.20-blue)
![Network](https://img.shields.io/badge/Network-Sepolia-orange)
![Pattern](https://img.shields.io/badge/Pattern-UUPS-green)

A professional, upgradeable Web3 Portfolio Tracker smart contract built for the Ethereum ecosystem. This project demonstrates advanced Solidity patterns including UUPS Upgradeability and a robust Hybrid Oracle Architecture.

## Key Highlights

### Hybrid Oracle Architecture
This project implements a unique **Hybrid Oracle Architecture** designed for maximum reliability across both Mainnet and Testnet environments.
- **Primary Source**: Uses Chainlink Data Feeds for high-fidelity price updates for major assets (BTC, ETH, LINK, etc.).
- **Manual Price Fallback**: Incorporates a fail-safe system. Given that Chainlink feeds for specific assets (e.g., ADA) are currently unavailable on the Sepolia Testnet, this fallback mechanism allows manual price injection. This ensures the protocol's PnL logic remains fully testable and operational, simulating a Mainnet environment where all feeds would be active.

## Architecture

The project utilizes the **UUPS (Universal Upgradeable Proxy Standard)** pattern to ensure the contract logic can be upgraded without changing the contract address or losing state.
- **Proxy Contract**: Holds the state (storage) and delegates calls to the implementation.
- **Implementation Contract**: Contains the logic (e.g., `PortfolioTracker.sol`) and can be swapped out by the owner to add features or fix bugs (as demonstrated by the V2 migration in the codebase).

## Tech Stack

- **Solidity**: Smart Contract Language (v0.8.20)
- **OpenZeppelin**: Standard Upgradeable Contracts (Ownable, Initializable, UUPS)
- **Hardhat**: Development Environment
- **Remix**: Used for rapid prototyping and interaction

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure `.env` with your `SEPOLIA_RPC_URL` and `PRIVATE_KEY`.
4. Compile:
   ```bash
   npx hardhat compile
   ```
5. Deploy to Sepolia:
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
