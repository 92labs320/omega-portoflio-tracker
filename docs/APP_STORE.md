# Omega Portfolio Tracker — App Store Connect

Everything to paste into App Store Connect for version 1.0.0. Primary language: English (U.S.). A French (Canada) localization is optional and can be added later.

## App information

| Field | Value |
|---|---|
| Name | Omega Portfolio Tracker |
| Subtitle (30 max) | Crypto & stock tracker |
| Bundle ID | com.92labs.omegaportfolio |
| SKU | omega-portfolio-ios-001 |
| Primary category | Finance |
| Secondary category | Productivity |
| Content rights | Does not contain third-party content requiring rights (market prices are factual data from public APIs) |
| Age rating | 4+ (answer "None" everywhere; "Unrestricted Web Access": No; "Gambling": No) |
| Price | Free |
| Privacy Policy URL | https://omega-portoflio-tracker-backend.vercel.app/privacy |
| Support URL | https://omega-portoflio-tracker-backend.vercel.app/support |
| Marketing URL | https://omega-portoflio-tracker-backend.vercel.app |
| Copyright | 2026 92labs |

> These URLs are served by the Vercel project `omega-portoflio-tracker-backend` (backend/public).

## Promotional text (170 max)

Track crypto and stocks in one place. Live prices, real profit and loss, no account and no ads. Your data stays on your iPhone.

## Description

Omega is a clean, private portfolio tracker for crypto and stocks.

Record your buys, sells, staking rewards and airdrops, and Omega shows what your portfolio is worth right now, with real profit and loss calculated from your own transactions.

MARKETS AT A GLANCE
• Live prices and 24h change for the top 250 cryptocurrencies
• Top gainers and losers of the day
• Search any coin and add it to your portfolio in two taps

YOUR PORTFOLIO
• Total worth, unrealized and realized profit and loss
• Average-cost method, fees included
• Allocation chart and per-asset details
• Edit or delete any transaction at any time
• Crypto and stocks side by side

PRIVATE BY DESIGN
• No account, no sign-up, no email
• No ads, no analytics, no tracking
• Data stored on your iPhone, works offline
• Optional anonymous cloud backup you can delete anytime
• Export your transactions as CSV

Omega is a tracking tool only. It is not a broker or an exchange, it never connects to your accounts, and it does not provide financial advice. Market data from CoinGecko and Finnhub may be delayed.

## Keywords (100 max)

portfolio,crypto,bitcoin,stocks,tracker,investment,profit,loss,ethereum,watchlist,net worth,coin

## What's New (1.0.0)

First release.

## App Review information

- Sign-in required: **No** (no account in the app)
- Contact: Djoko, 92labs320@gmail.com, your phone number
- Notes for the reviewer:

```
Omega is a manual portfolio tracker. No login is required.

How to test:
1. Home and Markets tabs show live crypto prices from CoinGecko (top 250).
2. Tap any coin (or Portfolio > Add Transaction) to record a buy:
   choose Cryptocurrency > Buy, search "bitcoin", enter a quantity,
   tap "Use current price", then Add.
3. The Portfolio tab shows the position with live value and profit/loss.
   Tap the position to edit or delete transactions.
4. Settings > Cloud backup is optional and anonymous (no account): it
   copies transactions to our server, linked only to a random key stored
   in the iOS Keychain. "Delete cloud backup" removes it.

The app does not trade, hold or transfer assets, does not connect to any
brokerage or exchange account, and does not give financial advice.
No ads, no tracking, no in-app purchases.
```

## App Privacy ("nutrition label")

Answer **Yes, we collect data** (because of the optional cloud backup), then declare only:

| Data type | Purpose | Linked to user? | Used for tracking? |
|---|---|---|---|
| Financial Info → Other Financial Info | App Functionality | **No** | **No** |

Everything else (contact info, identifiers, usage data, diagnostics, location…) → not collected.
Tracking: **No**. The app does not use the IDFA and does not show the App Tracking Transparency prompt.

## Export compliance

`ITSAppUsesNonExemptEncryption = false` is already set in `app.json` (the app only uses HTTPS provided by iOS), so App Store Connect won't ask the question for each build.

## Screenshots

Required: **6.9" display** (iPhone 16/17 Pro Max, 1320 × 2868). App Store Connect scales them to smaller sizes. 3 to 6 screenshots:

1. Home — "Markets at a glance"
2. Markets — top 100 with search
3. Portfolio — total worth, P&L and allocation chart (with 4–5 sample transactions)
4. Asset detail — transactions and average cost
5. Add Transaction — coin search and form
6. Settings — "No account · your data stays yours"

Take them on a real iPhone running the TestFlight build (side button + volume up). Use realistic but personal-data-free transactions, and never show placeholder prices.

## Review risks addressed in 1.0.0

- No mock or placeholder prices anywhere: if a provider is down the app says so.
- No dead buttons: every tappable element opens a real screen, URL or action.
- Custom Omega icon and splash (the Expo placeholders were removed).
- No login screens, no empty account fields.
- Ads SDK removed: no ATT prompt, simpler privacy label.
- Data deletion available in-app (Guideline 5.1.1(v) spirit even without accounts).
- Clear "not a broker / not financial advice" wording in-app and in the description (Guideline 3.2.1 / 5.1 financial apps).
