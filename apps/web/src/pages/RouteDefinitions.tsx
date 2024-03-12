import { t } from '@lingui/macro'
import { useInfoExplorePageEnabled } from 'featureFlags/flags/infoExplore'
import { useInfoPoolPageEnabled } from 'featureFlags/flags/infoPoolPage'
import { useAtom } from 'jotai'
import { lazy, ReactNode, Suspense, useMemo } from 'react'
import { matchPath, Navigate, useLocation } from 'react-router-dom'
import { shouldDisableNFTRoutesAtom } from 'state/application/atoms'
import { SpinnerSVG } from 'theme/components'
import { isBrowserRouterEnabled } from 'utils/env'

// High-traffic pages (index and /swap) should not be lazy-loaded.
import Landing from './Landing'
import Swap from './Swap'
import NFTPage from './NFT'

const NftExplore = lazy(() => import('nft/pages/explore'))
const Collection = lazy(() => import('nft/pages/collection'))
const Profile = lazy(() => import('nft/pages/profile'))
const Asset = lazy(() => import('nft/pages/asset/Asset'))
const Explore = lazy(() => import('pages/Explore'))
const AddLiquidityWithTokenRedirects = lazy(() => import('pages/AddLiquidity/redirects'))
const AddLiquidityV2WithTokenRedirects = lazy(() => import('pages/AddLiquidityV2/redirects'))
const RedirectExplore = lazy(() => import('pages/Explore/redirects'))
const MigrateV2 = lazy(() => import('pages/MigrateV2'))
const MigrateV2Pair = lazy(() => import('pages/MigrateV2/MigrateV2Pair'))
const NotFound = lazy(() => import('pages/NotFound'))
const Pool = lazy(() => import('pages/Pool'))
const PositionPage = lazy(() => import('pages/Pool/PositionPage'))
const PoolV2 = lazy(() => import('pages/Pool/v2'))
const PoolDetails = lazy(() => import('pages/PoolDetails'))
const PoolFinder = lazy(() => import('pages/PoolFinder'))
const RemoveLiquidity = lazy(() => import('pages/RemoveLiquidity'))
const RemoveLiquidityV3 = lazy(() => import('pages/RemoveLiquidity/V3'))
const TokenDetails = lazy(() => import('pages/TokenDetails'))
const Vote = lazy(() => import('pages/Vote'))

// this is the same svg defined in assets/images/blue-loader.svg
// it is defined here because the remote asset may not have had time to load when this file is executing
const LazyLoadSpinner = () => (
  <SpinnerSVG width="94" height="94" viewBox="0 0 94 94" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M92 47C92 22.1472 71.8528 2 47 2C22.1472 2 2 22.1472 2 47C2 71.8528 22.1472 92 47 92"
      stroke="#2172E5"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </SpinnerSVG>
)

interface RouterConfig {
  browserRouterEnabled?: boolean
  hash?: string
  infoExplorePageEnabled?: boolean
  infoPoolPageEnabled?: boolean
  shouldDisableNFTRoutes?: boolean
}

/**
 * Convenience hook which organizes the router configuration into a single object.
 */
export function useRouterConfig(): RouterConfig {
  const browserRouterEnabled = isBrowserRouterEnabled()
  const { hash } = useLocation()
  const infoPoolPageEnabled = useInfoPoolPageEnabled()
  const infoExplorePageEnabled = useInfoExplorePageEnabled()
  const [shouldDisableNFTRoutes] = useAtom(shouldDisableNFTRoutesAtom)
  return useMemo(
    () => ({
      browserRouterEnabled,
      hash,
      infoExplorePageEnabled,
      infoPoolPageEnabled,
      shouldDisableNFTRoutes: Boolean(shouldDisableNFTRoutes),
    }),
    [browserRouterEnabled, hash, infoExplorePageEnabled, infoPoolPageEnabled, shouldDisableNFTRoutes]
  )
}

export interface RouteDefinition {
  path: string
  nestedPaths: string[]
  staticTitle: string
  enabled: (args: RouterConfig) => boolean
  getElement: (args: RouterConfig) => ReactNode
}

// Assigns the defaults to the route definition.
function createRouteDefinition(route: Partial<RouteDefinition>): RouteDefinition {
  return {
    getElement: () => null,
    staticTitle: 'Wolf Swap',
    enabled: () => true,
    path: '/',
    nestedPaths: [],
    // overwrite the defaults
    ...route,
  }
}

export const routes: RouteDefinition[] = [
  // createRouteDefinition({
  //   path: '/',
  //   staticTitle: t`Wolf Swap`,
  //   getElement: (args) => {
  //     return args.browserRouterEnabled && args.hash ? <Navigate to={args.hash.replace('#', '')} replace /> : <Landing />
  //   },
  // }),
  createRouteDefinition({
    path: '/',
    staticTitle: t`Wolf Swap`,
    getElement: () => <Swap />,
  }),
  createRouteDefinition({
    path: '/nft',
    staticTitle: t`Wolf Swap`,
    getElement: () => <NFTPage />,
  }),
  createRouteDefinition({
    path: '/explore',
    staticTitle: t`Explore Tokens on Uniswap`,
    nestedPaths: [':tab', ':chainName'],
    getElement: () => <RedirectExplore />,
    enabled: (args) => Boolean(args.infoExplorePageEnabled),
  }),
  createRouteDefinition({
    path: '/explore',
    staticTitle: t`Explore Tokens on Uniswap`,
    nestedPaths: [':tab/:chainName'],
    getElement: () => <Explore />,
    enabled: (args) => Boolean(args.infoExplorePageEnabled),
  }),
  createRouteDefinition({
    path: '/explore/tokens/:chainName/:tokenAddress',
    staticTitle: t`Buy & Sell on Uniswap`,
    getElement: () => <TokenDetails />,
    enabled: (args) => Boolean(args.infoExplorePageEnabled),
  }),
  createRouteDefinition({
    path: '/tokens',
    staticTitle: t`Explore Tokens on Uniswap`,
    getElement: (args) => {
      return args.infoExplorePageEnabled ? <Navigate to="/explore/tokens" replace /> : <Explore />
    },
  }),
  createRouteDefinition({
    path: '/tokens/:chainName',
    staticTitle: t`Explore Tokens on Uniswap`,
    getElement: (args) => {
      return args.infoExplorePageEnabled ? <RedirectExplore /> : <Explore />
    },
  }),
  createRouteDefinition({
    path: '/tokens/:chainName/:tokenAddress',
    staticTitle: t`Explore Tokens on Uniswap`,
    getElement: (args) => {
      return args.infoExplorePageEnabled ? <RedirectExplore /> : <TokenDetails />
    },
  }),
  createRouteDefinition({
    path: '/explore/pools/:chainName/:poolAddress',
    staticTitle: t`Explore Pools on Uniswap`,
    getElement: () => (
      <Suspense fallback={null}>
        <PoolDetails />
      </Suspense>
    ),
    enabled: (args) => Boolean(args.infoExplorePageEnabled && args.infoPoolPageEnabled),
  }),
  createRouteDefinition({
    path: '/vote/*',
    staticTitle: t`Vote on Uniswap`,
    getElement: () => (
      <Suspense fallback={<LazyLoadSpinner />}>
        <Vote />
      </Suspense>
    ),
  }),
  createRouteDefinition({
    path: '/create-proposal',
    staticTitle: t`Uniswap Governance Proposals`,
    getElement: () => <Navigate to="/vote/create-proposal" replace />,
  }),
  createRouteDefinition({
    path: '/send',
    getElement: () => <Navigate to={{ ...location, pathname: '/swap' }} replace />,
  }),
  createRouteDefinition({
    path: '/swap',
    getElement: () => <Swap />,
    staticTitle: t`Wolf Swap`,
  }),
  createRouteDefinition({
    path: '/pool/v2/find',
    getElement: () => <PoolFinder />,
    staticTitle: t`Explore Pools on Uniswap`,
  }),
  createRouteDefinition({ path: '/pool/v2', getElement: () => <PoolV2 />, staticTitle: t`Explore Pools on Uniswap` }),
  createRouteDefinition({ path: '/pool', getElement: () => <Pool /> }),
  createRouteDefinition({
    path: '/pool/:tokenId',
    getElement: () => <PositionPage />,
    staticTitle: t`Manage Positions on Uniswap`,
  }),
  createRouteDefinition({
    path: '/pools/v2/find',
    getElement: () => <PoolFinder />,
    staticTitle: t`Explore Pools on Uniswap`,
  }),
  createRouteDefinition({ path: '/pools/v2', getElement: () => <PoolV2 />, staticTitle: t`Explore Pools on Uniswap` }),
  createRouteDefinition({ path: '/pools', getElement: () => <Pool />, staticTitle: t`Explore Pools on Uniswap` }),
  createRouteDefinition({
    path: '/pools/:tokenId',
    getElement: () => <PositionPage />,
    staticTitle: t`Explore Pools on Uniswap`,
  }),
  createRouteDefinition({
    path: '/add/v2',
    nestedPaths: [':currencyIdA', ':currencyIdA/:currencyIdB'],
    getElement: () => <AddLiquidityV2WithTokenRedirects />,
    staticTitle: t`Add Liquidity on Uniswap`,
  }),
  createRouteDefinition({
    path: '/add',
    nestedPaths: [
      ':currencyIdA',
      ':currencyIdA/:currencyIdB',
      ':currencyIdA/:currencyIdB/:feeAmount',
      ':currencyIdA/:currencyIdB/:feeAmount/:tokenId',
    ],
    getElement: () => <AddLiquidityWithTokenRedirects />,
    staticTitle: t`Add Liquidity on Uniswap`,
  }),
  createRouteDefinition({
    path: '/remove/v2/:currencyIdA/:currencyIdB',
    getElement: () => <RemoveLiquidity />,
    staticTitle: t`Manage Liquidity on Uniswap`,
  }),
  createRouteDefinition({
    path: '/remove/:tokenId',
    getElement: () => <RemoveLiquidityV3 />,
    staticTitle: t`Manage Liquidity on Uniswap`,
  }),
  createRouteDefinition({
    path: '/migrate/v2',
    getElement: () => <MigrateV2 />,
    staticTitle: t`Manage Liquidity on Uniswap`,
  }),
  createRouteDefinition({
    path: '/migrate/v2/:address',
    getElement: () => <MigrateV2Pair />,
    staticTitle: t`Manage Liquidity on Uniswap`,
  }),
  createRouteDefinition({
    path: '/nfts',
    getElement: () => (
      <Suspense fallback={null}>
        <NftExplore />
      </Suspense>
    ),
    enabled: (args) => !args.shouldDisableNFTRoutes,
    staticTitle: t`Explore NFTs on Uniswap`,
  }),
  createRouteDefinition({
    path: '/nfts/asset/:contractAddress/:tokenId',
    getElement: () => (
      <Suspense fallback={null}>
        <Asset />
      </Suspense>
    ),
    enabled: (args) => !args.shouldDisableNFTRoutes,
    staticTitle: t`Explore NFTs on Uniswap`,
  }),
  createRouteDefinition({
    path: '/nfts/profile',
    getElement: () => (
      <Suspense fallback={null}>
        <Profile />
      </Suspense>
    ),
    enabled: (args) => !args.shouldDisableNFTRoutes,
    staticTitle: t`Explore NFTs on Uniswap`,
  }),
  createRouteDefinition({
    path: '/nfts/collection/:contractAddress',
    getElement: () => (
      <Suspense fallback={null}>
        <Collection />
      </Suspense>
    ),
    enabled: (args) => !args.shouldDisableNFTRoutes,
    staticTitle: t`Explore NFTs on Uniswap`,
  }),
  createRouteDefinition({
    path: '/nfts/collection/:contractAddress/activity',
    getElement: () => (
      <Suspense fallback={null}>
        <Collection />
      </Suspense>
    ),
    enabled: (args) => !args.shouldDisableNFTRoutes,
    staticTitle: t`Explore NFTs on Uniswap`,
  }),
  createRouteDefinition({ path: '*', getElement: () => <Navigate to="/not-found" replace /> }),
  createRouteDefinition({ path: '/not-found', getElement: () => <NotFound /> }),
]

export const findRouteByPath = (pathname: string) => {
  for (const route of routes) {
    const match = matchPath(route.path, pathname)
    if (match) {
      return route
    }
  }
  return undefined
}
