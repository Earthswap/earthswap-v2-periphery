import { Wallet, Contract } from 'ethers'
import { Web3Provider } from 'ethers/providers'
import { deployContract } from 'ethereum-waffle'

import { expandTo18Decimals } from './utilities'

import EarthswapV2Factory from '@earthswap/v2-core/build/EarthswapV2Factory.json'
import IEarthswapV2Pair from '@earthswap/v2-core/build/IEarthswapV2Pair.json'

import ERC20 from '../../build/ERC20.json'
import WETH9 from '../../build/WETH9.json'
import EarthswapV1Exchange from '../../build/EarthswapV1Exchange.json'
import EarthswapV1Factory from '../../build/EarthswapV1Factory.json'
import EarthswapV2Router01 from '../../build/EarthswapV2Router01.json'
import EarthswapV2Migrator from '../../build/EarthswapV2Migrator.json'

const overrides = {
  gasLimit: 9999999
}

interface V2Fixture {
  token0: Contract
  token1: Contract
  WETH: Contract
  WETHPartner: Contract
  factoryV1: Contract
  factoryV2: Contract
  router: Contract
  migrator: Contract
  WETHExchangeV1: Contract
  pair: Contract
  WETHPair: Contract
}

export async function v2Fixture(provider: Web3Provider, [wallet]: Wallet[]): Promise<V2Fixture> {
  // deploy tokens
  const tokenA = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const tokenB = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])
  const WETH = await deployContract(wallet, WETH9)
  const WETHPartner = await deployContract(wallet, ERC20, [expandTo18Decimals(10000)])

  // deploy V1
  const factoryV1 = await deployContract(wallet, EarthswapV1Factory, [])
  await factoryV1.initializeFactory((await deployContract(wallet, EarthswapV1Exchange, [])).address)

  // deploy V2
  const factoryV2 = await deployContract(wallet, EarthswapV2Factory, [wallet.address])

  // deploy router and migrator
  const router = await deployContract(wallet, EarthswapV2Router01, [factoryV2.address, WETH.address], overrides)
  const migrator = await deployContract(wallet, EarthswapV2Migrator, [factoryV1.address, router.address], overrides)

  // initialize V1
  await factoryV1.createExchange(WETHPartner.address, overrides)
  const WETHExchangeV1Address = await factoryV1.getExchange(WETHPartner.address)
  const WETHExchangeV1 = new Contract(WETHExchangeV1Address, JSON.stringify(EarthswapV1Exchange.abi), provider).connect(
    wallet
  )

  // initialize V2
  await factoryV2.createPair(tokenA.address, tokenB.address)
  const pairAddress = await factoryV2.getPair(tokenA.address, tokenB.address)
  const pair = new Contract(pairAddress, JSON.stringify(IEarthswapV2Pair.abi), provider).connect(wallet)

  const token0Address = await pair.token0()
  const token0 = tokenA.address === token0Address ? tokenA : tokenB
  const token1 = tokenA.address === token0Address ? tokenB : tokenA

  await factoryV2.createPair(WETH.address, WETHPartner.address)
  const WETHPairAddress = await factoryV2.getPair(WETH.address, WETHPartner.address)
  const WETHPair = new Contract(WETHPairAddress, JSON.stringify(IEarthswapV2Pair.abi), provider).connect(wallet)

  return {
    token0,
    token1,
    WETH,
    WETHPartner,
    factoryV1,
    factoryV2,
    router,
    migrator,
    WETHExchangeV1,
    pair,
    WETHPair
  }
}
