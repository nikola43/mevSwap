import { Trans } from '@lingui/macro'
import { InterfacePageName } from '@uniswap/analytics-events'
import { useWeb3React } from '@web3-react/core'
import { Trace } from 'analytics'
import { PortfolioLogo } from 'components/AccountDrawer/MiniPortfolio/PortfolioLogo'
import { ChartType, PriceChartType } from 'components/Charts/utils'
import { useCachedPortfolioBalancesQuery } from 'components/PrefetchBalancesWrapper/PrefetchBalancesWrapper'
import { AboutSection } from 'components/Tokens/TokenDetails/About'
import AddressSection from 'components/Tokens/TokenDetails/AddressSection'
import ChartSection from 'components/Tokens/TokenDetails/ChartSection'
import ShareButton from 'components/Tokens/TokenDetails/ShareButton'
import TokenDetailsSkeleton, {
  Hr,
  LeftPanel,
  RightPanel,
  TokenDetailsLayout,
  TokenInfoContainer,
  TokenNameCell,
} from 'components/Tokens/TokenDetails/Skeleton'
import StatsSection from 'components/Tokens/TokenDetails/StatsSection'
import TokenSafetyMessage from 'components/TokenSafety/TokenSafetyMessage'
import TokenSafetyModal from 'components/TokenSafety/TokenSafetyModal'
import { NATIVE_CHAIN_ID, nativeOnChain } from 'constants/tokens'
import { checkWarning } from 'constants/tokenSafety'
import { useInfoExplorePageEnabled } from 'featureFlags/flags/infoExplore'
import { useInfoTDPEnabled } from 'featureFlags/flags/infoTDP'
import {
  Chain,
  PortfolioTokenBalancePartsFragment,
  TokenPriceQuery,
  TokenQuery,
} from 'graphql/data/__generated__/types-and-hooks'
import { TokenQueryData } from 'graphql/data/Token'
import {
  getTokenDetailsURL,
  gqlToCurrency,
  InterfaceGqlChain,
  supportedChainIdFromGQLChain,
  TimePeriod,
} from 'graphql/data/util'
import { useOnGlobalChainSwitch } from 'hooks/useGlobalChainSwitch'
import { UNKNOWN_TOKEN_SYMBOL, useTokenFromActiveNetwork } from 'lib/hooks/useCurrency'
import { Swap } from 'pages/Swap'
import { useCallback, useMemo, useState, useTransition } from 'react'
import { ArrowLeft, ChevronRight } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import { SwapState } from 'state/swap/SwapContext'
import styled, { css } from 'styled-components'
import { EllipsisStyle } from 'theme/components'
import { isAddress } from 'utils'
import { addressesAreEquivalent } from 'utils/addressesAreEquivalent'

import BalanceSummary from './BalanceSummary'
import { BreadcrumbNavContainer, BreadcrumbNavLink, CurrentBreadcrumb } from './BreadcrumbNav'
import { AdvancedPriceChartToggle } from './ChartTypeSelectors/AdvancedPriceChartToggle'
import ChartTypeSelector from './ChartTypeSelectors/ChartTypeSelector'
import InvalidTokenDetails from './InvalidTokenDetails'
import MobileBalanceSummaryFooter from './MobileBalanceSummaryFooter'
import { TokenDescription } from './TokenDescription'

const TokenSymbol = styled.span<{ isInfoTDPEnabled?: boolean }>`
  text-transform: uppercase;
  color: ${({ theme }) => theme.neutral2};
  margin-left: 8px;

  ${({ isInfoTDPEnabled }) =>
    isInfoTDPEnabled &&
    css`
      @media screen and (max-width: ${({ theme }) => theme.breakpoint.xs}px) {
        display: none;
      }
    `}
`
const ChartActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`
const TokenTitle = styled.div<{ isInfoTDPEnabled?: boolean }>`
  display: flex;

  ${({ isInfoTDPEnabled }) =>
    isInfoTDPEnabled
      ? css`
          overflow: hidden;
          white-space: nowrap;
        `
      : css`
          @media screen and (max-width: ${({ theme }) => theme.breakpoint.md}px) {
            display: inline;
          }
        `}
`
const TokenName = styled.span`
  ${EllipsisStyle}
  min-width: 40px;
`

function useOnChainToken(address: string | undefined, skip: boolean) {
  const token = useTokenFromActiveNetwork(skip || !address ? undefined : address)

  if (skip || !address || (token && token?.symbol === UNKNOWN_TOKEN_SYMBOL)) {
    return undefined
  } else {
    return token
  }
}

// Selects most relevant token based on data available, preferring native > query > on-chain
// Token will be null if still loading from on-chain, and undefined if unavailable
function useRelevantToken(
  address: string | undefined,
  pageChainId: number,
  tokenQueryData: TokenQueryData | undefined
) {
  const { chainId: activeChainId } = useWeb3React()
  const queryToken = useMemo(() => {
    if (!address) return undefined
    if (address === NATIVE_CHAIN_ID) return nativeOnChain(pageChainId)
    if (tokenQueryData) return gqlToCurrency(tokenQueryData)
    return undefined
  }, [pageChainId, address, tokenQueryData])
  // fetches on-chain token if query data is missing and page chain matches global chain (else fetch won't work)
  const skipOnChainFetch = Boolean(queryToken) || pageChainId !== activeChainId
  const onChainToken = useOnChainToken(address, skipOnChainFetch)

  return useMemo(
    () => ({ token: queryToken ?? onChainToken, didFetchFromChain: !queryToken }),
    [onChainToken, queryToken]
  )
}
export type MultiChainMap = { [chain: string]: { address?: string; balance?: PortfolioTokenBalancePartsFragment } }
type TokenDetailsProps = {
  urlAddress?: string
  inputTokenAddress?: string
  chain: InterfaceGqlChain
  tokenQuery: TokenQuery
  tokenPriceQuery?: TokenPriceQuery
  timePeriod: TimePeriod
  onChangeTimePeriod: (t: TimePeriod) => void
}
export default function TokenDetails({
  urlAddress,
  inputTokenAddress,
  chain,
  tokenQuery,
  tokenPriceQuery,
  timePeriod,
  onChangeTimePeriod,
}: TokenDetailsProps) {
  if (!urlAddress) {
    throw new Error('Invalid token details route: tokenAddress param is undefined')
  }
  const address = useMemo(
    () => (urlAddress === NATIVE_CHAIN_ID ? urlAddress : isAddress(urlAddress) || undefined),
    [urlAddress]
  )

  const { account, chainId: connectedChainId } = useWeb3React()
  const pageChainId = supportedChainIdFromGQLChain(chain)
  const tokenQueryData = tokenQuery.token
  const { data: balanceQuery } = useCachedPortfolioBalancesQuery({ account })
  const multiChainMap = useMemo(() => {
    const tokenBalances = balanceQuery?.portfolios?.[0].tokenBalances
    const tokensAcrossChains = tokenQueryData?.project?.tokens
    if (!tokensAcrossChains) return {}
    return tokensAcrossChains.reduce((map, current) => {
      if (current) {
        if (!map[current.chain]) {
          map[current.chain] = {}
        }
        map[current.chain].address = current.address
        map[current.chain].balance = tokenBalances?.find((tokenBalance) => tokenBalance.token?.id === current.id)
      }
      return map
    }, {} as MultiChainMap)
  }, [balanceQuery?.portfolios, tokenQueryData?.project?.tokens])

  const { token: detailedToken, didFetchFromChain } = useRelevantToken(address, pageChainId, tokenQueryData)

  const tokenWarning = address ? checkWarning(address) : null
  const isBlockedToken = tokenWarning?.canProceed === false
  const navigate = useNavigate()

  const isInfoExplorePageEnabled = useInfoExplorePageEnabled()
  const isInfoTDPEnabled = useInfoTDPEnabled()

  // Wrapping navigate in a transition prevents Suspense from unnecessarily showing fallbacks again.
  const [isPending, startTokenTransition] = useTransition()
  const navigateToTokenForChain = useCallback(
    (update: Chain) => {
      if (!address) return
      const bridgedAddress = multiChainMap[update]?.address
      if (bridgedAddress) {
        startTokenTransition(() =>
          navigate(
            getTokenDetailsURL({
              address: bridgedAddress,
              chain: update,
              isInfoExplorePageEnabled,
            })
          )
        )
      } else if (didFetchFromChain || detailedToken?.isNative) {
        startTokenTransition(() => navigate(getTokenDetailsURL({ address, chain: update, isInfoExplorePageEnabled })))
      }
    },
    [address, multiChainMap, didFetchFromChain, detailedToken?.isNative, navigate, isInfoExplorePageEnabled]
  )
  useOnGlobalChainSwitch(navigateToTokenForChain)

  const handleCurrencyChange = useCallback(
    (tokens: Pick<SwapState, 'inputCurrencyId' | 'outputCurrencyId'>) => {
      if (
        addressesAreEquivalent(tokens.inputCurrencyId, address) ||
        addressesAreEquivalent(tokens.outputCurrencyId, address)
      ) {
        return
      }

      const newDefaultTokenID = tokens.outputCurrencyId ?? tokens.inputCurrencyId
      startTokenTransition(() =>
        navigate(
          getTokenDetailsURL({
            // The function falls back to "NATIVE" if the address is null
            address: newDefaultTokenID === 'ETH' ? null : newDefaultTokenID,
            chain,
            inputAddress:
              // If only one token was selected before we navigate, then it was the default token and it's being replaced.
              // On the new page, the *new* default token becomes the output, and we don't have another option to set as the input token.
              tokens.inputCurrencyId !== newDefaultTokenID ? tokens.inputCurrencyId : null,
            isInfoExplorePageEnabled,
          })
        )
      )
    },
    [address, chain, isInfoExplorePageEnabled, navigate]
  )

  const [continueSwap, setContinueSwap] = useState<{ resolve: (value: boolean | PromiseLike<boolean>) => void }>()

  const [openTokenSafetyModal, setOpenTokenSafetyModal] = useState(false)

  const onResolveSwap = useCallback(
    (value: boolean) => {
      continueSwap?.resolve(value)
      setContinueSwap(undefined)
    },
    [continueSwap, setContinueSwap]
  )

  const [chartType, setChartType] = useState<ChartType>(ChartType.PRICE)
  const [priceChartType, setPriceChartType] = useState<PriceChartType>(PriceChartType.LINE)

  // address will never be undefined if token is defined; address is checked here to appease typechecker
  if (detailedToken === undefined || !address) {
    return <InvalidTokenDetails pageChainId={pageChainId} isInvalidAddress={!address} />
  }
  const tokenSymbolName = detailedToken && (detailedToken.symbol ?? <Trans>Symbol not found</Trans>)
  return (
    <Trace
      page={InterfacePageName.TOKEN_DETAILS_PAGE}
      properties={{ tokenAddress: address, tokenName: detailedToken?.name }}
      shouldLogImpression
    >
      <TokenDetailsLayout>
        {detailedToken && !isPending ? (
          <LeftPanel>
            {isInfoTDPEnabled ? (
              <BreadcrumbNavContainer aria-label="breadcrumb-nav">
                <BreadcrumbNavLink to={`/explore/tokens/${chain.toLowerCase()}`}>
                  <Trans>Explore</Trans> <ChevronRight size={14} /> <Trans>Tokens</Trans> <ChevronRight size={14} />
                </BreadcrumbNavLink>{' '}
                <CurrentBreadcrumb address={address} currency={detailedToken} />
              </BreadcrumbNavContainer>
            ) : (
              <BreadcrumbNavContainer aria-label="breadcrumb-nav">
                <BreadcrumbNavLink to={`${isInfoExplorePageEnabled ? '/explore' : ''}/tokens/${chain.toLowerCase()}`}>
                  <ArrowLeft data-testid="token-details-return-button" size={14} /> Tokens
                </BreadcrumbNavLink>
              </BreadcrumbNavContainer>
            )}
            <TokenInfoContainer isInfoTDPEnabled={isInfoTDPEnabled} data-testid="token-info-container">
              <TokenNameCell isInfoTDPEnabled={isInfoTDPEnabled}>
                <PortfolioLogo currencies={[detailedToken]} chainId={detailedToken.chainId} size="32px" />
                {isInfoTDPEnabled ? (
                  <TokenTitle isInfoTDPEnabled>
                    <TokenName>{detailedToken.name ?? <Trans>Name not found</Trans>}</TokenName>
                    <TokenSymbol isInfoTDPEnabled>{tokenSymbolName}</TokenSymbol>
                  </TokenTitle>
                ) : (
                  <TokenTitle>
                    {detailedToken.name ?? <Trans>Name not found</Trans>}
                    <TokenSymbol>{tokenSymbolName}</TokenSymbol>
                  </TokenTitle>
                )}
              </TokenNameCell>
              <ChartActions>
                {isInfoTDPEnabled ? (
                  <>
                    {chartType === ChartType.PRICE && (
                      <AdvancedPriceChartToggle
                        currentChartType={priceChartType}
                        onChartTypeChange={setPriceChartType}
                      />
                    )}
                    <ChartTypeSelector
                      currentChartType={chartType}
                      onChartTypeChange={(c: ChartType) => {
                        setChartType(c)
                        if (c === ChartType.PRICE) setPriceChartType(PriceChartType.LINE)
                      }}
                    />
                  </>
                ) : (
                  <ShareButton currency={detailedToken} />
                )}
              </ChartActions>
            </TokenInfoContainer>
            <ChartSection
              chartType={chartType}
              priceChartType={priceChartType}
              timePeriod={timePeriod}
              onChangeTimePeriod={onChangeTimePeriod}
              tokenPriceQuery={tokenPriceQuery}
            />

            <StatsSection chainId={pageChainId} address={address} tokenQueryData={tokenQueryData} />
            <Hr />
            <AboutSection
              address={address}
              chainId={pageChainId}
              description={tokenQueryData?.project?.description}
              homepageUrl={tokenQueryData?.project?.homepageUrl}
              twitterName={tokenQueryData?.project?.twitterName}
            />
            {!detailedToken.isNative && <AddressSection address={address} />}
          </LeftPanel>
        ) : (
          <TokenDetailsSkeleton />
        )}

        <RightPanel isInfoTDPEnabled={isInfoTDPEnabled} onClick={() => isBlockedToken && setOpenTokenSafetyModal(true)}>
          <div style={{ pointerEvents: isBlockedToken ? 'none' : 'auto' }}>
            <Swap
              chainId={pageChainId}
              initialInputCurrencyId={inputTokenAddress}
              initialOutputCurrencyId={address === NATIVE_CHAIN_ID ? 'ETH' : address}
              onCurrencyChange={handleCurrencyChange}
              disableTokenInputs={pageChainId !== connectedChainId}
            />
          </div>
          {tokenWarning && <TokenSafetyMessage tokenAddress={address} warning={tokenWarning} />}
          {detailedToken && <BalanceSummary currency={detailedToken} chain={chain} multiChainMap={multiChainMap} />}
          {isInfoTDPEnabled && (
            <TokenDescription
              tokenAddress={address}
              chainId={pageChainId}
              isNative={detailedToken?.isNative}
              characterCount={200}
            />
          )}
        </RightPanel>
        {detailedToken && (
          <MobileBalanceSummaryFooter currency={detailedToken} pageChainBalance={multiChainMap[chain].balance} />
        )}

        <TokenSafetyModal
          isOpen={openTokenSafetyModal || !!continueSwap}
          tokenAddress={address}
          onContinue={() => onResolveSwap(true)}
          onBlocked={() => {
            setOpenTokenSafetyModal(false)
          }}
          onCancel={() => onResolveSwap(false)}
          showCancel={true}
        />
      </TokenDetailsLayout>
    </Trace>
  )
}
