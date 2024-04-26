import { useMemo, useState } from "react"
import { ChainId, Currency, CurrencyAmount, Percent, Token, TradeType } from "@uniswap/sdk-core"
import { ChainId as ChainIdJoe, TokenAmount as TokenAmountJoe, Percent as PercentJoe, Token as TokenJoe, WNATIVE } from "@traderjoe-xyz/sdk";
import {
  PairV2 as PairJoe,
  RouteV2 as RouteJoe,
  TradeV2 as TradeJoe,
  LB_ROUTER_ADDRESS,
} from "@traderjoe-xyz/sdk-v2";
import { useWeb3React } from "@web3-react/core";
import { COMMON_BASES } from "constants/routing";
import useInterval from "lib/hooks/useInterval";
import { getContract } from "utils";
import { Erc20 } from "abis/types";
import ERC20_ABI from 'abis/erc20.json'
import IUniswapV2PairJSON from '@uniswap/v2-core/build/IUniswapV2Pair.json'
import { Pair, Route } from "@uniswap/v2-sdk";
import { nativeOnChain } from "constants/tokens";
import { useUSDPrice } from "hooks/useUSDPrice";
import { formatEther, parseEther } from "ethers/lib/utils";
import { ApproveInfo, ClassicTrade, QuoteMethod, TradeState } from "./types";

export function useJoeTrade(
    chainId: number | undefined,
    tradeType: TradeType,
    amountSpecified: CurrencyAmount<Currency> | undefined,
    otherCurrency: Currency | undefined,
    inputTax?: Percent,
    outputTax?: Percent
) {
    const [ isFetching, setFetching ] = useState(true)
    const [ trade, setTrade ] = useState<ClassicTrade>()
    const { account, provider } = useWeb3React()
    const { data: priceETH } = useUSDPrice(CurrencyAmount.fromRawAmount(nativeOnChain(chainId!), parseEther('1').toString()))
    useInterval(() => {
        if(chainId && [ChainIdJoe.AVALANCHE, ChainIdJoe.FUJI].includes(chainId) && provider && amountSpecified) {
            const WAVAX = WNATIVE[chainId as ChainIdJoe]
            const tokenExact = !amountSpecified?.currency || amountSpecified?.currency.isNative 
                ? WAVAX
                : amountSpecified?.currency as TokenJoe
            const tokenOther = !otherCurrency || otherCurrency?.isNative 
                ? WAVAX
                : otherCurrency as TokenJoe
        
            const tokenInput = tradeType===TradeType.EXACT_INPUT ? tokenExact : tokenOther
            const tokenOutput = tradeType===TradeType.EXACT_OUTPUT ? tokenExact : tokenOther
        
            const allTokenPairs = PairJoe.createAllTokenPairs(
                tokenInput,
                tokenOutput,
                COMMON_BASES[chainId as ChainId].map(_token => _token.isNative ? WAVAX : _token as TokenJoe)
            )
            const allPairs = PairJoe.initPairs(allTokenPairs)
            const allRoutes = RouteJoe.createAllRoutes(allPairs, tokenInput, tokenOutput, 3)
            if(tradeType===TradeType.EXACT_INPUT) {
                TradeJoe.getTradesExactIn(
                    allRoutes,
                    new TokenAmountJoe(tokenInput, amountSpecified?.quotient!),
                    tokenOutput,
                    !!amountSpecified?.currency.isNative,
                    !!otherCurrency?.isNative,
                    provider,
                    chainId as ChainIdJoe
                ).then(trades => {
                    if(trades?.length) {
                        const bestTrade = TradeJoe.chooseBestTrade(trades.filter(t => !!t) as TradeJoe[], true)
                        if(bestTrade) 
                            doSomething(bestTrade)
                    }
                })
            } else {
                TradeJoe.getTradesExactOut(
                    allRoutes,
                    new TokenAmountJoe(tokenOutput, amountSpecified?.quotient!),
                    tokenInput,
                    !!otherCurrency?.isNative,
                    !!amountSpecified?.currency.isNative,
                    provider,
                    chainId as ChainIdJoe
                ).then(trades => {
                    if(trades?.length) {
                        const bestTrade = TradeJoe.chooseBestTrade(trades.filter(t => !!t) as TradeJoe[], false)
                        if(bestTrade) 
                            doSomething(bestTrade)
                    }
                })
            }
        }    
    }, 10_000)

    const getApproval = async (trade: TradeJoe) : Promise<ApproveInfo> => {
        if(trade.inputAmount.currency.isNative)
            return { needsApprove: false }
        if(provider && account) {
            const tokenContract = getContract(trade.outputAmount.token.address, ERC20_ABI, provider) as Erc20
            const allowance = await tokenContract.callStatic.allowance(account, LB_ROUTER_ADDRESS[chainId as ChainIdJoe])
            if (!allowance.lt(trade.outputAmount.quotient.toString())) 
                return { needsApprove: false }
        }
        return { needsApprove: true, approveGasEstimateUSD: 0 }
    }

    const doSomething = async (trade: TradeJoe) => {
        if(provider && trade && account) {
            const { totalFeePct, feeAmountIn } = await trade.getTradeFee()
            // const currenTimeInSec =  Math.floor((new Date().getTime()) / 1000)
            // const deadline = currenTimeInSec + 3600
            // const swapOptions = {
            //     recipient: account, 
            //     allowedSlippage: totalFeePct, 
            //     deadline,
            //     feeOnTransfer: tradeType===TradeType.EXACT_INPUT
            // }
            // const {
            //     methodName,
            //     args,
            //     value
            // } = trade.swapCallParameters(swapOptions)
            const blockNumber = await provider.getBlockNumber()
            const approveInfo = await getApproval(trade) 
            const est = await trade.estimateGas(provider.getSigner(), chainId as ChainIdJoe, totalFeePct).catch(e => {})
            const tokenInput = trade.isNativeIn ? nativeOnChain(provider.network.chainId) : new Token(
                provider.network.chainId, 
                (trade.inputAmount.currency as TokenJoe).address, 
                parseInt(trade.inputAmount.currency.decimals.toString()), 
                trade.inputAmount.currency.symbol, 
                undefined, 
                false,
            )
            // console.log('besttrade', trade)
            const tokenOutput = trade.isNativeOut ? nativeOnChain(provider.network.chainId) : new Token(
                provider.network.chainId, 
                (trade.outputAmount.currency as TokenJoe).address, 
                parseInt(trade.outputAmount.currency.decimals.toString()), 
                trade.outputAmount.currency.symbol, 
                undefined, 
                false,
            )
            const reserves:any[] = []
            for(const i in trade.quote.pairs) {
                const _pair = trade.quote.pairs[i]
                if(trade.quote.versions[i]===0) {
                    const pair = getContract(_pair, IUniswapV2PairJSON.abi, provider)
                    reserves.push(await pair.getReserves())
                } else {
                    const _reserve = await PairJoe.getLBPairReservesAndId(_pair, trade.quote.versions[i]>1, provider)
                    reserves.push({
                        reserve0: _reserve.reserveX,
                        reserve1: _reserve.reserveY,
                    })
                }
            }
            const routev2 = new Route(
                trade.route.pairs.map((_pair, _index) => 
                    new Pair(
                        CurrencyAmount.fromRawAmount(_pair.token0 as Token, reserves[_index].reserve0.toString()),
                        CurrencyAmount.fromRawAmount(_pair.token1 as Token, reserves[_index].reserve1.toString()),
                    )
                ),
                tokenInput,
                tokenOutput
            )
            console.log("estimate", est?.toString(), priceETH)
            setTrade(new ClassicTrade({
                quoteMethod: QuoteMethod.JOE_ROUTE,
                gasUseEstimateUSD: est && priceETH ? Number(formatEther(est)) * priceETH : undefined,
                original: trade,
                v2Routes: [{
                    routev2,
                    inputAmount: CurrencyAmount.fromRawAmount(tokenInput, trade.inputAmount.raw.toString()),
                    outputAmount: CurrencyAmount.fromRawAmount(tokenOutput, trade.outputAmount.raw.toString()),
                }],
                v3Routes: [],
                tradeType,
                blockNumber: String(blockNumber),
                priceImpact: new Percent(trade.priceImpact.numerator, trade.priceImpact.denominator),
                approveInfo,
                swapFee: {
                    recipient: account,
                    percent: new Percent(totalFeePct.numerator, totalFeePct.denominator),
                    amount: trade.outputAmount.raw.toString()
                }
            }))
            setFetching(false)
        }
    }
    
    return useMemo(() => ({
        state: isFetching ? TradeState.LOADING : TradeState.VALID,
        trade,
        currentTrade: trade,
        swapQuoteLatency: undefined
    }), [isFetching, trade])
}