# Abyss Protocol

**Professional DeFi Trading Platform on Sui Blockchain**

Abyss Protocol is a comprehensive decentralized finance (DeFi) trading platform built on the Sui blockchain, featuring real-time market analytics, advanced trading tools, multi-chain intelligence, and privacy-preserving intent-based trading. The platform integrates with DeepBook V3, Mysten Seal, and NEAR Protocol to deliver a complete trading experience.

## 🌊 Core Features

### 📱 Telegram Bot (@DeepIntentBot)
Trade on the go with natural language commands via Telegram.

**Features:**
- Natural language swap interface
- Multi-chain swaps (15+ blockchains)
- Wallet connection & management
- Balance checking
- Status tracking
- Token discovery
- Fund management

**Commands:** `/start`, `/swap`, `/tokens`, `/status`, `/balance`, `/connect`, `/wallet`, `/fund`, `/help`

### 🦈 Trading Terminal
Advanced trading tools on DeepBook V3 for professional traders.

**Features:**
- **Instant Swaps** - Real-time token exchanges with slippage protection
- **Limit Orders** - Set target prices for automatic execution
- **Flash Arbitrage** - Exploit price differences across pools
- **Margin Trading** - Trade with leverage using Pyth oracle prices
- **Balance Manager** - View and manage all token balances

**Path:** `/trade/*` (swap, limit-orders, flash-arbitrage, margin-trading, balance-manager)

### 🤖 AI Agent
Multi-chain intelligence powered by NEAR Protocol Intents API.

**Features:**
- Natural language processing for trades
- Multi-chain routing (15+ blockchains)
- AI-powered best rate discovery
- Automatic execution options
- Quote generation
- Chain and token discovery

**Path:** `/agent`

### 📊 Market Indexer
Real-time market data and liquidity analytics from DeepBook V3.

**Features:**
- Live pool monitoring
- Asset tracking and analytics
- Trading pair data
- Volume and liquidity metrics
- Price change tracking
- Testnet and mainnet support

**Path:** `/indexer`

### 🔐 zkLogin Authentication
Secure, passwordless authentication via Google OAuth and zkLogin.

**Features:**
- Google OAuth integration
- Zero-knowledge proof generation
- Session management
- Balance tracking
- Epoch validity checking
- Seamless wallet-less experience

### 👻 Private Intent Trading
Encrypted conditional trading with privacy-preserving execution.

**Features:**
- Seal-encrypted intent creation
- Conditional triggers (price above/below)
- Privacy-preserving trading strategies
- On-chain intent registry
- Intent lifecycle management (view, cancel)
- Automated execution framework

**Path:** `/intents` (experimental)

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- Next.js 16.0.7 with App Router
- React 19
- TypeScript 5.9.3
- Tailwind CSS 4.1.17
- Shadcn/ui components (New York style)

**Blockchain Integration:**
- Sui Blockchain (@mysten/sui ^2.2.0)
- DeepBook V3 SDK (@mysten/deepbook-v3 ^1.0.3)
- Mysten Seal (@mysten/seal ^1.0.0)
- Sui DApp Kit (@mysten/dapp-kit ^0.14.0)
- NEAR Protocol (near-api-js ^7.1.0, @near-js packages)
- Privy Wallet SDK (@privy-io/node ^0.8.0)

**Data & APIs:**
- TanStack React Query ^5.0.0
- ApexCharts ^5.3.6 / Lightweight Charts ^4.2.3
- Axios ^1.13.4

**Telegram Integration:**
- Grammy ^1.21.0 (Telegram Bot framework)
- Telegram Mini Apps support

**Smart Contracts:**
- Move language (Sui edition 2024.beta)
- Intent Registry module
- Seal Policy module

## 📁 Project Structure

```
sui-tma/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── agent/               # Multi-chain AI agent (Manta)
│   │   ├── api/                 # API routes
│   │   │   ├── agent/          # Agent endpoints (chat, tokens, quote, execute, status)
│   │   │   └── telegram/       # Telegram webhook & actions
│   │   ├── auth/               # Authentication callbacks
│   │   ├── dashboard/          # User dashboard
│   │   ├── indexer/            # Market data explorer (Marlin)
│   │   │   ├── mainnet/       # Mainnet markets
│   │   │   └── testnet/       # Testnet markets
│   │   ├── intents/            # Intent trading (experimental)
│   │   │   └── create/
│   │   ├── login/              # Login page
│   │   ├── telegram/           # Telegram Mini App pages
│   │   └── trade/              # Trading terminal (Barracuda)
│   │       ├── swap/          # Token swaps
│   │       ├── limit-orders/  # Limit orders
│   │       ├── flash-arbitrage/ # Arbitrage
│   │       ├── margin-trading/ # Margin trading
│   │       └── balance-manager/ # Balance management
│   ├── components/              # React components
│   │   ├── ui/                 # Shadcn/ui components
│   │   ├── DappKitProvider.tsx
│   │   ├── Navigation.tsx
│   │   ├── NetworkToggle.tsx
│   │   └── ...                 # Market components
│   ├── contexts/                # React contexts
│   │   ├── AuthContext.tsx     # zkLogin authentication
│   │   ├── NearWalletContext.tsx # NEAR wallet management
│   │   └── NetworkContext.tsx  # Network switching (testnet/mainnet)
│   └── lib/                     # Core libraries
│       ├── deepbook-v3.ts      # DeepBook V3 integration
│       ├── seal.ts             # Seal encryption for intents
│       ├── near-intents-agent.ts # AI agent for NEAR multi-chain
│       ├── near-intents-api.ts # NEAR Intents API wrapper
│       ├── telegram-bot.ts     # Telegram bot implementation
│       ├── privy.ts            # Privy wallet management
│       └── zklogin.ts          # zkLogin authentication
├── move/                        # Move smart contracts
│   ├── intent_registry/        # Intent storage & lifecycle
│   │   └── sources/
│   │       └── intent_registry.move
│   └── seal_policy/            # Seal encryption policy
│       └── sources/
│           └── intent.move
├── public/                      # Static assets
├── components.json             # Shadcn/ui configuration
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── postcss.config.mjs          # PostCSS configuration
└── package.json                # Dependencies & scripts
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (recommended: 20+)
- pnpm (required package manager)
- Sui Wallet (for testnet/mainnet interaction)
- NEAR Wallet (optional, for multi-chain features)

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd sui-tma
```

2. **Install dependencies:**
```bash
pnpm install
```

3. **Configure environment variables:**
Create a `.env.local` file in the root directory:

```bash
# Network Configuration
NEXT_PUBLIC_SUI_NETWORK=testnet  # or mainnet

# Sui RPC
NEXT_PUBLIC_SUI_RPC_URL=https://fullnode.testnet.sui.io

# zkLogin Configuration (optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_PROVER_URL=https://prover-dev.mystenlabs.com/v1
NEXT_PUBLIC_REDIRECT_URL=http://localhost:3000/auth/callback

# Seal Encryption (for intents - optional)
NEXT_PUBLIC_SEAL_POLICY_PACKAGE_ID=0x...
NEXT_PUBLIC_INTENT_REGISTRY_PACKAGE_ID=0x...
NEXT_PUBLIC_INTENT_REGISTRY_ID=0x...
NEXT_PUBLIC_ENCLAVE_CONFIG_ID=0x...

# Telegram Bot (optional)
TELEGRAM_BOT_TOKEN=your-bot-token
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Privy (optional)
PRIVY_APP_ID=your-privy-app-id
PRIVY_APP_SECRET=your-privy-app-secret

# NEAR Configuration (optional, for multi-chain)
NEAR_NETWORK=testnet
NEAR_ACCOUNT_ID=your-account.testnet
NEAR_PRIVATE_KEY=ed25519:...
```

### Development

**Run development server:**
```bash
pnpm run dev
```

The application will be available at `http://localhost:3000`

**Run with HTTPS (for Telegram Mini Apps):**
```bash
pnpm run dev:https
```

**Lint code:**
```bash
pnpm run lint
```

**Build for production:**
```bash
pnpm run build
```

**Start production server:**
```bash
pnpm run start
```

**Run Telegram bot:**
```bash
pnpm run bot
```

## 📱 Telegram Bot

The platform includes a Telegram bot (@DeepIntentBot) that provides natural language multi-chain swaps.

### Bot Commands

- `/start` - Welcome & setup info
- `/help` - Available commands & examples
- `/connect` - Connect NEAR wallet
- `/disconnect` - Unlink NEAR wallet
- `/swap` - Start a multi-chain swap
- `/tokens` - List supported tokens
- `/status` - Check swap status
- `/balance` - Check wallet balance
- `/fund` - Fund your wallet
- `/wallet` - Link receive wallet address

### Running the Bot

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Set `TELEGRAM_BOT_TOKEN` in `.env.local`
3. Run: `pnpm run bot`

## 🔐 Smart Contracts

### Intent Registry (`move/intent_registry`)

Manages encrypted trading intents on the Sui blockchain.

**Features:**
- Storage of Seal-encrypted intents
- Lifecycle management (create, cancel, execute)
- Event emission for indexing
- Authorization for enclave execution
- Status tracking (Active, Executing, Executed, Cancelled, Expired, Failed)

**Package ID:** Configured via `NEXT_PUBLIC_INTENT_REGISTRY_PACKAGE_ID`

### Seal Policy (`move/seal_policy`)

Defines access control policy for Seal-encrypted intents.

**Features:**
- Identity-Based Encryption (IBE) policy
- Enclave authorization
- Ed25519 signature verification
- Secure key server integration

**Package ID:** Configured via `NEXT_PUBLIC_SEAL_POLICY_PACKAGE_ID`

**Note:** Intent system is experimental and under development.

### Deployment

```bash
cd move/intent_registry
sui move build
sui client publish --gas-budget 100000000

cd ../seal_policy
sui move build
sui client publish --gas-budget 100000000
```

## 🔌 API Routes

### Agent API (`/api/agent/*`)

- `POST /api/agent/chat` - Process natural language messages
- `POST /api/agent/tokens` - List supported tokens
- `POST /api/agent/quote` - Get swap quotes
- `POST /api/agent/execute` - Execute swaps
- `GET /api/agent/status?orderId=...` - Check swap status
- `POST /api/agent/deposit` - Handle deposits

### Telegram API (`/api/telegram/*`)

- `POST /api/telegram/webhook` - Telegram bot webhook
- `POST /api/telegram/link` - Link wallet
- `POST /api/telegram/deposit-signed` - Process signed deposits

## 🌐 Supported Networks

### Sui Networks
- **Testnet** - Development and testing
- **Mainnet** - Production trading

### Multi-Chain Support (via NEAR Intents)
15+ blockchains including:
- Ethereum
- BSC
- Polygon
- Avalanche
- Arbitrum
- Optimism
- Base
- NEAR
- Aurora
- And more...

## 🎨 UI Components

Built with Shadcn/ui (New York style):
- Buttons, Cards, Dialogs, Drawers
- Dropdowns, Inputs, Select boxes
- Tables, Tabs, Badges
- Tooltips, Popovers, Scrollable areas
- Sliders, Switches, Checkboxes
- Accordions, Alerts, Avatars
- Progress bars, Skeletons, Separators
- Sheets (mobile drawers)

## 📊 Features in Detail

### 📱 Telegram Bot

Trade directly from Telegram with @DeepIntentBot using natural language:

**Example Commands:**
- "Swap 10 SUI to USDC"
- "What tokens are available?"
- "Check my balance"
- "Show swap status for order abc123"

**Wallet Support:**
- NEAR wallet connection via @hot-labs/near-connect
- Multiple wallet options (HOT Wallet, Meteor, MyNearWallet, WalletConnect)
- Privy embedded wallets
- Client-side or server-side execution

**Multi-Chain Support:**
Execute swaps across 15+ blockchains including Ethereum, BSC, Polygon, Avalanche, Arbitrum, Optimism, Base, NEAR, Aurora, and more.

### 🦈 Trading Terminal

Professional trading interface built on DeepBook V3:

**Instant Swaps:**
- Real-time price quotes
- Configurable slippage tolerance
- Base-to-quote and quote-to-base swaps
- Transaction preview

**Limit Orders:**
- Set custom execution prices
- Automatic order matching
- Order book integration

**Flash Arbitrage:**
- Cross-pool arbitrage opportunities
- Single-transaction execution
- Risk-free profit capture

**Margin Trading:**
- Leverage up to 10x
- Pyth oracle price feeds
- Long and short positions
- Collateral management

### 🤖 AI Agent

Intelligent multi-chain trading assistant:

**Natural Language Processing:**
Parse user intents like "swap 10 tokens" into executable transactions

**Multi-Chain Routing:**
- Automatic route optimization
- Best price discovery
- Gas fee comparison
- Multi-chain bridge selection

**Execution Modes:**
- **Auto**: Server executes with configured credentials
- **Privy-Auto**: Privy embedded wallet signs server-side
- **Client-Sign**: Return deposit info for wallet signing
- **Manual**: Provide instructions for manual execution

### 📊 Market Indexer

Real-time DeepBook V3 market analytics:

**Pool Monitoring:**
- Live liquidity data
- Trading volume metrics
- Total Value Locked (TVL)
- Active pool discovery

**Asset Analytics:**
- Price tracking
- 24h volume and changes
- Multi-asset comparison
- Search and filtering

**Network Support:**
- Testnet markets
- Mainnet markets
- Dynamic network switching

### 🔐 zkLogin Authentication

Passwordless, wallet-less authentication:

**How it Works:**
1. User signs in with Google OAuth
2. JWT token obtained from Google
3. Zero-knowledge proof generated via Mysten prover
4. Ephemeral key pair created
5. zkLogin address derived (no seed phrase needed)

**Benefits:**
- No wallet installation required
- No seed phrase management
- Familiar OAuth experience
- Full Sui blockchain access
- Secure transaction signing

### 👻 Private Intent Trading

Experimental privacy-preserving conditional trading:

**Intent Creation:**
- Encrypt trading strategies with Mysten Seal (IBE)
- Set conditional triggers (price above/below thresholds)
- Define order parameters (market/limit, buy/sell, quantity)
- Set expiration times
- Store encrypted intents on-chain

**Privacy Features:**
- Seal Identity-Based Encryption (IBE)
- Only authorized enclaves can decrypt
- On-chain storage without revealing strategy
- Ed25519 signature verification
- Multi-key server threshold (2-of-3)

**Intent Management:**
- View your active intents
- Monitor execution status
- Cancel pending intents
- Track executed trades
- Filter by status (Active, Executing, Executed, Cancelled, Expired)

**Status Types:**
- Active: Waiting for trigger conditions
- Executing: Currently being processed
- Executed: Successfully completed
- Cancelled: Manually cancelled by user
- Expired: Reached expiration time
- Failed: Execution failed

**Smart Contracts:**
Two Move modules power the intent system:
- `intent_registry`: Stores and manages encrypted intents
- `seal_policy`: Defines encryption access policies

## 🔒 Security

- **zkLogin Authentication**: Zero-knowledge proof-based Google OAuth login
- **Sui DApp Kit**: Secure wallet integration with ConnectButton
- **Transaction Signing**: Client-side signature generation
- **RPC Communication**: Secure blockchain RPC calls
- **Environment Variables**: Sensitive data protection
- **Input Validation**: Client and server-side validation
- **HTTPS Support**: Secure development with self-signed certificates

## 📄 License

This project uses pnpm as the required package manager.

## 🤝 Contributing

Please ensure you use pnpm for package management to maintain consistency.

## 📞 Support

- Telegram Bot: [@DeepIntentBot](https://t.me/DeepIntentBot)
- Platform: [Launch Application](https://your-domain.com)

---

Built with ❤️ on Sui Blockchain

```bash
$ pnpm run dev:https

▲ Next.js 14.2.3
- Local:        https://localhost:3000

✓ Starting...
✓ Ready in 2.4s
```

Visiting the `Local` link (`https://localhost:3000` in this example) in your
browser, you will see the following warning:

![SSL Warning](assets/ssl-warning.png)

This browser warning is normal and can be safely ignored as long as the site is
secure. Click the `Proceed to localhost (unsafe)` button to continue and view
the application.

Once the application is displayed correctly, submit the
link `https://127.0.0.1:3000` (`https://localhost:3000` is considered as invalid
by BotFather) as the Mini App link to [@BotFather](https://t.me/botfather).
Then, navigate to [https://web.telegram.org/k/](https://web.telegram.org/k/),
find your bot, and launch the Telegram Mini App. This approach provides the full
development experience.

## Deploy

The easiest way to deploy your Next.js app is to use
the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)
from the creators of Next.js.

Check out
the [Next.js deployment documentation](https://nextjs.org/docs/deployment) for
more details.

## Useful Links

- [Platform documentation](https://docs.telegram-mini-apps.com/)
- [@telegram-apps/sdk-react documentation](https://docs.telegram-mini-apps.com/packages/telegram-apps-sdk-react)
- [Telegram developers community chat](https://t.me/devs)