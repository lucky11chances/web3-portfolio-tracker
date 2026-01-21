// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// OpenZeppelin Upgradeable
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80);
}

contract PortfolioTracker is
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    uint256 public constant SCALE = 1e8;

    enum AssetClass {
        CRYPTO,
        STOCK
    } // kept for backward compatibility
    enum AssetId {
        BTC,
        ETH,
        LINK,
        SOL,
        ADA,
        SHIB,
        ATOM,
        SUI,
        CRO,
        CIRCLE,
        TRON
    }
    uint256 public constant ASSET_COUNT = 11;

    struct Position {
        uint256 amount; // token/share * 1e8 (principal)
        uint256 avgBuyPrice; // USD * 1e8
        uint256 stakingRewards; // token/share * 1e8
    }

    struct AssetReport {
        uint8 asset;
        AssetClass assetClass;
        bool hasPosition;
        bool priceOk;
        bool usingManualPrice;
        uint256 priceUsd;
        uint256 principalAmount;
        uint256 stakingRewards;
        uint256 totalAmount;
        uint256 costUsd;
        uint256 valueUsd;
        int256 pnlUsd;
        bool inProfit;
    }

    // -----------------------
    // V1 Storage (DO NOT REORDER)
    // -----------------------
    mapping(AssetId => Position) public positions;
    mapping(AssetId => AssetClass) public assetClasses;

    mapping(AssetId => AggregatorV3Interface) public priceFeeds;
    mapping(AssetId => uint256) public manualPriceUsd;
    mapping(AssetId => bool) public useManualPrice;

    event PriceFeedSet(uint8 indexed asset, address indexed feed);
    event ManualPriceSet(
        uint8 indexed asset,
        uint256 priceUsdScaled,
        bool enabled
    );
    event PositionSet(
        uint8 indexed asset,
        uint256 amountScaled,
        uint256 avgBuyPriceScaled,
        uint256 stakingRewardsScaled
    );
    event StakingRewardsAdded(uint8 indexed asset, uint256 extraRewardsScaled);

    // -----------------------
    // V2 NEW: Dynamic Class Registry + Assignment
    // -----------------------
    struct ClassInfo {
        bool exists;
        bool active;
        uint256 parentId; // 0 means "no parent"
        string name;
    }

    uint256 public nextClassId; // starts at 1
    mapping(uint256 => ClassInfo) private _classes;

    // Asset -> dynamic classId (runtime configurable)
    mapping(AssetId => uint256) public assetClassId;

    event ClassCreated(
        uint256 indexed classId,
        uint256 indexed parentId,
        string name
    );
    event ClassDeactivated(uint256 indexed classId);
    event ClassRenamed(uint256 indexed classId, string name);
    event AssetClassAssigned(uint8 indexed asset, uint256 indexed classId);

    // -----------------------
    // V2 NEW: Sell tracking (realized PnL)
    // -----------------------
    mapping(AssetId => int256) public realizedPnlUsd; // USD*1e8
    mapping(AssetId => uint256) public lastSellPriceUsd; // USD*1e8
    mapping(AssetId => uint256) public lastSellAmount; // asset*1e8
    event SellRecorded(
        uint8 indexed asset,
        uint256 amountScaled,
        uint256 priceUsdScaled,
        int256 realizedPnlDelta
    );

    // -----------------------
    // constructor / initialize
    // -----------------------
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        // V1 init (same semantics as your V1)
        for (uint256 i = 0; i < ASSET_COUNT; i++) {
            assetClasses[AssetId(i)] = AssetClass.CRYPTO;
        }
        assetClasses[AssetId.CIRCLE] = AssetClass.STOCK;
        assetClasses[AssetId.TRON] = AssetClass.STOCK;

        positions[AssetId.BTC] = Position(310_000_000, 6_000_000_000_000, 0); // 3.1 BTC @ $60,000
        positions[AssetId.ETH] = Position(615_000_000, 240_000_000_000, 0); // 6.15 ETH @ $2,400
        positions[AssetId.LINK] = Position(697_000_000_000, 1_436_000_000, 0); // 697 LINK @ $14.36
        positions[AssetId.SOL] = Position(13_957_000_000, 7_344_000_000, 0); // 139.57 SOL @ $73.44
        positions[AssetId.ADA] = Position(11_323_100_000_000, 69_000_000, 0); // 113,231 ADA @ $0.69
        positions[AssetId.SHIB] = Position(4_867_917_800_000_000, 2_146, 0); // 48,679,178 SHIB @ $0.00002146
        positions[AssetId.ATOM] = Position(78_700_000_000, 694_000_000, 0); // 787 ATOM @ $6.94
        positions[AssetId.SUI] = Position(14_300_000_000, 343_000_000, 0); // 143 SUI @ $3.43
        positions[AssetId.CRO] = Position(5_800_000_000_000, 12_600_000, 0); // 58,000 CRO @ $0.126
        positions[AssetId.CIRCLE] = Position(9_350_000_000, 7_850_000_000, 0); // 93.5 Shares @ $78.50
        positions[AssetId.TRON] = Position(60_000_000_000, 820_000_000, 0); // 600 Shares @ $8.20

        // V2 init: create default dynamic classes + assign existing assets
        _initV2DynamicClasses();
    }

    /// @dev Call once after upgrade if you are upgrading from V1 proxy state.
    /// If you deploy V2 fresh (new proxy), initialize() already calls this.
    function initializeV2() external reinitializer(2) onlyOwner {
        _initV2DynamicClasses();
    }

    function _initV2DynamicClasses() internal {
        if (nextClassId != 0) return; // already initialized

        nextClassId = 1;

        uint256 cryptosId = _createClassInternal("CRYPTOS", 0);
        uint256 stocksId = _createClassInternal("STOCKS", 0);

        // Assign existing assets: Circle + Tron are STOCKS, others CRYPTOS
        for (uint256 i = 0; i < ASSET_COUNT; i++) {
            assetClassId[AssetId(i)] = cryptosId;
        }
        assetClassId[AssetId.CIRCLE] = stocksId;
        assetClassId[AssetId.TRON] = stocksId;

        emit AssetClassAssigned(uint8(AssetId.CIRCLE), stocksId);
        emit AssetClassAssigned(uint8(AssetId.TRON), stocksId);
    }

    // -----------------------
    // UUPS Authorization
    // -----------------------
    function _authorizeUpgrade(
        address /*newImplementation*/
    ) internal override onlyOwner {}

    // -----------------------
    // Dynamic Class Management
    // -----------------------
    function createClass(
        string calldata name,
        uint256 parentId
    ) external onlyOwner returns (uint256 classId) {
        return _createClassInternal(name, parentId);
    }

    function _createClassInternal(
        string memory name,
        uint256 parentId
    ) internal returns (uint256 classId) {
        require(bytes(name).length > 0, "name empty");
        if (parentId != 0) {
            require(
                _classes[parentId].exists && _classes[parentId].active,
                "bad parent"
            );
        }

        classId = nextClassId;
        nextClassId++;

        _classes[classId] = ClassInfo({
            exists: true,
            active: true,
            parentId: parentId,
            name: name
        });
        emit ClassCreated(classId, parentId, name);
    }

    function deactivateClass(uint256 classId) external onlyOwner {
        require(_classes[classId].exists, "no class");
        require(_classes[classId].active, "already inactive");
        _classes[classId].active = false;
        emit ClassDeactivated(classId);
    }

    function renameClass(
        uint256 classId,
        string calldata name
    ) external onlyOwner {
        require(_classes[classId].exists, "no class");
        require(bytes(name).length > 0, "name empty");
        _classes[classId].name = name;
        emit ClassRenamed(classId, name);
    }

    function getClassInfo(
        uint256 classId
    )
        external
        view
        returns (bool exists, bool active, uint256 parentId, string memory name)
    {
        ClassInfo storage c = _classes[classId];
        return (c.exists, c.active, c.parentId, c.name);
    }

    function setAssetClass(AssetId asset, uint256 classId) external onlyOwner {
        require(
            _classes[classId].exists && _classes[classId].active,
            "bad class"
        );
        assetClassId[asset] = classId;
        emit AssetClassAssigned(uint8(asset), classId);
    }

    // -----------------------
    // Sell recording (simple average cost basis)
    // -----------------------
    function recordSell(
        AssetId asset,
        uint256 sellAmountScaled,
        uint256 sellPriceUsdScaled
    ) external onlyOwner {
        require(sellAmountScaled > 0, "sell=0");
        require(sellPriceUsdScaled > 0, "price=0");

        Position storage p = positions[asset];
        uint256 totalHeld = p.amount + p.stakingRewards;
        require(totalHeld >= sellAmountScaled, "insufficient");

        // realized PnL:
        // - principal part has cost basis avgBuyPrice
        // - stakingRewards part has 0 cost basis
        uint256 principalSold = sellAmountScaled <= p.amount
            ? sellAmountScaled
            : p.amount;
        uint256 rewardsSold = sellAmountScaled - principalSold;

        int256 pnlDelta = 0;

        if (principalSold > 0) {
            // (sellPrice - avgBuyPrice) * principalSold
            int256 priceDiff = int256(sellPriceUsdScaled) -
                int256(p.avgBuyPrice);
            pnlDelta += (priceDiff * int256(principalSold)) / int256(SCALE);
            p.amount -= principalSold;
        }

        if (rewardsSold > 0) {
            // rewards cost is 0, so pnl = sellPrice * rewardsSold
            pnlDelta +=
                (int256(sellPriceUsdScaled) * int256(rewardsSold)) /
                int256(SCALE);
            p.stakingRewards -= rewardsSold;
        }

        // If fully exited principal, reset avgBuyPrice to 0 (optional but cleaner)
        if (p.amount == 0) {
            p.avgBuyPrice = 0;
        }

        realizedPnlUsd[asset] += pnlDelta;
        lastSellPriceUsd[asset] = sellPriceUsdScaled;
        lastSellAmount[asset] = sellAmountScaled;

        emit SellRecorded(
            uint8(asset),
            sellAmountScaled,
            sellPriceUsdScaled,
            pnlDelta
        );
    }

    // -----------------------
    // Price setters (same as V1)
    // -----------------------
    function setPriceFeed(AssetId asset, address feed) external onlyOwner {
        require(feed != address(0), "feed=0");
        require(feed.code.length > 0, "not contract"); // ensure it's a contract
        priceFeeds[asset] = AggregatorV3Interface(feed);
        emit PriceFeedSet(uint8(asset), feed);
    }

    function setManualPrice(
        AssetId asset,
        uint256 priceUsdScaled,
        bool enabled
    ) external onlyOwner {
        manualPriceUsd[asset] = priceUsdScaled;
        useManualPrice[asset] = enabled;
        emit ManualPriceSet(uint8(asset), priceUsdScaled, enabled);
    }

    function setPosition(
        AssetId asset,
        uint256 amountScaled,
        uint256 avgBuyPriceScaled,
        uint256 stakingRewardsScaled
    ) external onlyOwner {
        positions[asset] = Position(
            amountScaled,
            avgBuyPriceScaled,
            stakingRewardsScaled
        );
        emit PositionSet(
            uint8(asset),
            amountScaled,
            avgBuyPriceScaled,
            stakingRewardsScaled
        );
    }

    function addStakingRewards(
        AssetId asset,
        uint256 extraRewardsScaled
    ) external onlyOwner {
        positions[asset].stakingRewards += extraRewardsScaled;
        emit StakingRewardsAdded(uint8(asset), extraRewardsScaled);
    }

    // -----------------------
    // View Logic
    // -----------------------

    function safeGetPriceUsdScaled(
        AssetId asset
    ) public view returns (uint256) {
        // 1. Priority: Manual Price Overrides
        if (useManualPrice[asset]) {
            return manualPriceUsd[asset];
        }

        // 2. Chainlink Price Feeds
        AggregatorV3Interface feed = priceFeeds[asset];
        if (address(feed) != address(0)) {
            try feed.latestRoundData() returns (
                uint80 /*roundId*/,
                int256 price,
                uint256 /*startedAt*/,
                uint256 updatedAt,
                uint80 /*answeredInRound*/
            ) {
                // Check if price is positive and data is not completely stale
                if (price > 0 && updatedAt > 0) {
                    return uint256(price);
                }
            } catch {
                // If call fails, fall through to manual price
            }
        }

        // 3. Fallback
        return manualPriceUsd[asset];
    }

    function getAssetReport(
        AssetId asset
    ) public view returns (AssetReport memory) {
        Position memory p = positions[asset];
        uint256 currentPrice = safeGetPriceUsdScaled(asset);

        uint256 totalAmount = p.amount + p.stakingRewards;
        // value = totalAmount * price / 1e8
        uint256 valueUsd = (totalAmount * currentPrice) / SCALE;

        // cost = principal * avgBuyPrice / 1e8
        uint256 costUsd = (p.amount * p.avgBuyPrice) / SCALE;

        int256 pnl = int256(valueUsd) - int256(costUsd);

        return
            AssetReport({
                asset: uint8(asset),
                assetClass: assetClasses[asset],
                hasPosition: totalAmount > 0,
                priceOk: currentPrice > 0,
                usingManualPrice: useManualPrice[asset],
                priceUsd: currentPrice,
                principalAmount: p.amount,
                stakingRewards: p.stakingRewards,
                totalAmount: totalAmount,
                costUsd: costUsd,
                valueUsd: valueUsd,
                pnlUsd: pnl,
                inProfit: pnl >= 0
            });
    }

    function getPortfolioReport() external view returns (AssetReport[] memory) {
        AssetReport[] memory reports = new AssetReport[](ASSET_COUNT);
        for (uint256 i = 0; i < ASSET_COUNT; i++) {
            reports[i] = getAssetReport(AssetId(i));
        }
        return reports;
    }

    // Storage gap: reduced because V2 added new variables
    uint256[50] private __gap;
}
