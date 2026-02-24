"use client";

import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { formatUnits, parseUnits } from "viem";
import { useMemo, useState } from "react";
import { ArrowPathIcon, ArrowTrendingUpIcon, ArrowTrendingDownIcon } from "@heroicons/react/24/outline";

const ASSET_NAMES = ["BTC", "ETH", "LINK", "SOL", "ADA", "SHIB", "ATOM", "SUI", "CRO", "CIRCLE", "TRON"];

const ASSET_LOGOS: { [key: string]: string } = {
  "BTC": "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
  "ETH": "https://cryptologos.cc/logos/ethereum-eth-logo.png",
  "LINK": "https://cryptologos.cc/logos/chainlink-link-logo.png",
  "SOL": "https://cryptologos.cc/logos/solana-sol-logo.png",
  "ADA": "https://cryptologos.cc/logos/cardano-ada-logo.png",
  "SHIB": "https://cryptologos.cc/logos/shiba-inu-shib-logo.png",
  "ATOM": "https://cryptologos.cc/logos/cosmos-atom-logo.png",
  "SUI": "https://cryptologos.cc/logos/sui-sui-logo.png",
  "CRO": "https://cryptologos.cc/logos/cronos-cro-logo.png",
  "CIRCLE": "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
  "TRON": "https://cryptologos.cc/logos/tron-trx-logo.png",
};

export default function Home() {
  const { data: portfolioReport, isLoading, refetch } = useScaffoldReadContract({
    contractName: "PortfolioTracker",
    functionName: "getPortfolioReport",
  });

  const { writeContractAsync: writePortfolioTracker, isPending: isWritePending } = useScaffoldWriteContract("PortfolioTracker");

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionAmounts, setActionAmounts] = useState<{ [key: number]: string }>({});

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSell = async (assetId: number, currentHoldings: string, currentPriceUsd: string) => {
    const amountStr = actionAmounts[assetId];
    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) return;

    const sellAmountNum = Number(amountStr);
    const holdAmountNum = Number(currentHoldings);
    if (sellAmountNum > holdAmountNum) return; // Cannot sell more than holdings

    const sellAmountScaled = parseUnits(sellAmountNum.toFixed(8), 8);
    const priceScaled = parseUnits(currentPriceUsd, 8);

    try {
      await writePortfolioTracker({
        functionName: "recordSell",
        args: [assetId, sellAmountScaled, priceScaled],
      });
      refetch();
    } catch (e) {
      console.error("Sell failed:", e);
    }
  };

  const handleBuy = async (assetId: number, currentHoldings: string, avgPrice: string) => {
    const amountStr = actionAmounts[assetId];
    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) return;

    const buyAmountNum = Number(amountStr);
    const holdAmountNum = Number(currentHoldings);
    const newTotalScaled = parseUnits((holdAmountNum + buyAmountNum).toFixed(8), 8);
    const avgPriceScaled = parseUnits(avgPrice, 8);

    try {
      await writePortfolioTracker({
        functionName: "setPosition",
        args: [assetId, newTotalScaled, avgPriceScaled, 0n], // assuming 0 staking rewards for demo simplicity
      });
      refetch();
    } catch (e) {
      console.error("Buy failed:", e);
    }
  };

  const totals = useMemo(() => {
    if (!portfolioReport) return { value: 0n, pnl: 0n, cost: 0n };
    return portfolioReport.reduce((acc, report) => {
      return {
        value: acc.value + (report.valueUsd as bigint),
        pnl: acc.pnl + (report.pnlUsd as bigint),
        cost: acc.cost + (report.costUsd as bigint),
      };
    }, { value: 0n, pnl: 0n, cost: 0n });
  }, [portfolioReport]);

  const totalValue = Number(formatUnits(totals.value, 8));
  const totalPnL = Number(formatUnits(totals.pnl < 0n ? -totals.pnl : totals.pnl, 8)) * (totals.pnl < 0n ? -1 : 1);
  const totalCost = Number(formatUnits(totals.cost, 8));

  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  return (
    <div className="flex flex-col min-h-[calc(100vh-theme(spacing.16))] bg-base-300 px-4 py-12 items-center text-base-content font-sans">
      <div className="max-w-7xl w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-5xl font-extrabold tracking-tight mb-3 text-primary">Portfolio Dashboard</h1>
            <p className="text-xl opacity-80 font-medium">Real-time PnL insights for your multi-asset holdings</p>
          </div>
          <button
            className={`btn btn-primary btn-lg shadow-lg ${isRefreshing || isLoading ? "loading" : ""}`}
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
          >
            {!isRefreshing && !isLoading && <ArrowPathIcon className="h-6 w-6" />}
            Refresh Price Feeds
          </button>
        </div>

        {isLoading && !portfolioReport ? (
          <div className="flex justify-center items-center h-48">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : (
          <>
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="card bg-base-100/90 backdrop-blur shadow-xl border border-base-200">
                <div className="card-body items-center text-center">
                  <h2 className="card-title text-base-content/60 uppercase tracking-widest text-sm font-bold">Total Holdings Value</h2>
                  <p className="text-4xl font-extrabold font-mono text-base-content mt-2">
                    ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="card bg-base-100/90 backdrop-blur shadow-xl border border-base-200">
                <div className="card-body items-center text-center">
                  <h2 className="card-title text-base-content/60 uppercase tracking-widest text-sm font-bold">Total Cost Basis</h2>
                  <p className="text-3xl font-semibold font-mono text-base-content/80 mt-2">
                    ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="card bg-base-100/90 backdrop-blur shadow-xl border border-base-200">
                <div className="card-body items-center text-center">
                  <h2 className="card-title text-base-content/60 uppercase tracking-widest text-sm font-bold">Unrealized PnL</h2>
                  <div className={`mt-2 flex items-center justify-center gap-3 ${totalPnL >= 0 ? "text-success" : "text-error"}`}>
                    <span className="text-4xl font-extrabold font-mono">
                      {totalPnL >= 0 ? "▲" : "▼"} ${Math.abs(totalPnL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <span className={`text-md font-bold px-3 py-1 mt-2 rounded-full ${totalPnL >= 0 ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
                    {totalPnL >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Asset Table */}
            <div className="card bg-base-100/90 backdrop-blur shadow-xl overflow-hidden border border-base-200">
              <div className="overflow-x-auto">
                <table className="table table-lg w-full">
                  <thead className="bg-base-200/50">
                    <tr className="uppercase tracking-widest text-xs font-bold text-base-content/60">
                      <th className="rounded-tl-lg">Asset</th>
                      <th className="text-right">Balance</th>
                      <th className="text-right">Current Price</th>
                      <th className="text-right">Avg Buy Price</th>
                      <th className="text-right">Total Value</th>
                      <th className="text-right">PnL</th>
                      <th className="text-center rounded-tr-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioReport && portfolioReport.map((report: any) => {
                      if (!report.hasPosition) return null;

                      const amount = Number(formatUnits(report.totalAmount, 8));
                      const price = Number(formatUnits(report.priceUsd, 8));
                      const costUsd = Number(formatUnits(report.costUsd, 8));
                      const avgBuyPrice = amount > 0 ? costUsd / amount : 0;

                      const value = Number(formatUnits(report.valueUsd, 8));

                      let pnl = 0;
                      if (report.pnlUsd < 0n) {
                        pnl = -Number(formatUnits(report.pnlUsd * -1n, 8));
                      } else {
                        pnl = Number(formatUnits(report.pnlUsd, 8));
                      }

                      const assetName = ASSET_NAMES[report.asset];
                      const inProfit = pnl >= 0;

                      return (
                        <tr key={report.asset} className="hover:bg-base-200/50 transition-colors border-b border-base-200 last:border-0 hover:shadow-sm">
                          <td className="font-bold">
                            <div className="flex items-center gap-4">
                              <div className="avatar">
                                <div className="w-10 rounded-full bg-base-100 shadow-sm border border-base-300 p-1 cursor-pointer hover:shadow-md hover:scale-105 transition-all">
                                  <img src={ASSET_LOGOS[assetName] || "https://cryptologos.cc/logos/ethereum-eth-logo.png"} alt={assetName} className="object-contain" />
                                </div>
                              </div>
                              <span className="text-lg">{assetName}</span>
                            </div>
                          </td>
                          <td className="text-right font-mono text-base">{amount.toLocaleString()}</td>
                          <td className="text-right font-mono text-base">${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                          <td className="text-right font-mono text-base-content/70 text-base">${avgBuyPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                          <td className="text-right font-mono font-bold text-base">${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className={`text-right font-mono font-extrabold text-base ${inProfit ? "text-success" : "text-error"}`}>
                            <div className="flex flex-col items-end">
                              <span>{inProfit ? "+" : "-"}${Math.abs(pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span className="text-xs opacity-80">{inProfit ? "+" : ""}{costUsd > 0 ? ((pnl / costUsd) * 100).toFixed(2) : 0}%</span>
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="number"
                                placeholder="Amount"
                                className="input input-bordered input-sm w-24 bg-base-100/50"
                                value={actionAmounts[report.asset] || ""}
                                onChange={(e) => setActionAmounts({ ...actionAmounts, [report.asset]: e.target.value })}
                              />
                              {/* Buy Button */}
                              <button
                                className="btn btn-sm btn-success btn-outline gap-1"
                                onClick={() => handleBuy(report.asset, amount.toString(), avgBuyPrice.toString())}
                                disabled={isWritePending || !actionAmounts[report.asset]}
                              >
                                <ArrowTrendingUpIcon className="h-4 w-4" /> Buy
                              </button>

                              {/* Sell Button */}
                              <button
                                className="btn btn-sm btn-error btn-outline gap-1"
                                onClick={() => handleSell(report.asset, amount.toString(), price.toString())}
                                disabled={isWritePending || !actionAmounts[report.asset]}
                              >
                                <ArrowTrendingDownIcon className="h-4 w-4" /> Sell
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!portfolioReport || portfolioReport.filter((r: any) => r.hasPosition).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-10 font-bold opacity-50 text-lg">
                          No active positions found in portfolio.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
