# Design Guidelines: Flash Loan Arbitrage Trading Bot Platform

## Design Approach

**Selected Framework:** Design System Approach with Professional Financial Trading Focus

**Primary Design References:**
- **Binance/Coinbase Pro**: Industry-standard crypto trading interfaces for trust and familiarity
- **TradingView**: Professional real-time data visualization and charting
- **Linear**: Clean, modern dashboard aesthetics with excellent hierarchy
- **Notion**: Organized data presentation and intuitive navigation

**Justification:** This utility-focused, data-intensive application demands clarity, real-time monitoring capabilities, and instant access to critical trading information. Users need to rapidly assess arbitrage opportunities, monitor bot performance, and manage financial risk with confidence.

## Typography System

**Font Stack:**
- **Primary (UI/Interface)**: Inter via Google Fonts CDN - `font-sans`
- **Monospace (Data/Numbers)**: JetBrains Mono via Google Fonts CDN - `font-mono`

**Hierarchy:**
- **H1 (Page Titles)**: `text-3xl font-bold` - Dashboard headers
- **H2 (Section Headers)**: `text-xl font-semibold` - Card titles, panel headers
- **H3 (Subsections)**: `text-lg font-medium` - Table headers, grouped labels
- **Body**: `text-base font-normal` - Descriptions, explanatory content
- **Data/Financial**: `text-sm font-mono` - Prices, percentages, addresses, transaction hashes
- **Labels/Badges**: `text-xs font-medium uppercase tracking-wide` - Status indicators, timestamps

## Layout Architecture

**Spacing Primitives:** Tailwind units of **2, 4, 6, 8**
- Card padding: `p-6`
- Component gaps: `gap-4`, `gap-6`
- Section spacing: `mb-6`, `mb-8`
- Grid gaps: `gap-4`

**Application Structure:**
- **Sidebar Navigation**: Fixed left sidebar (`w-64`) with collapsible menu, icon + label pattern
- **Main Content**: `max-w-7xl mx-auto` with responsive padding (`px-4 md:px-6 lg:px-8`)
- **Dashboard Grid**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` for metrics
- **Full-Width Data**: Tables and opportunity lists span full content width

## Core Components

### Dashboard Layout
**Bot Control Panel**:
- **Large Status Indicator**: Current bot state (Running/Stopped/Simulation) with pulsing animation
- **Quick Controls**: Start/Stop toggle, Emergency Stop button, Mode selector (Simulation/Real)
- **Critical Metrics Row**: 4-column grid showing Total Profit, Active Opportunities, Success Rate, Daily P/L
- **Real-Time Status Bar**: Last scan time, next scan countdown, gas price indicator, MATIC balance

**Arbitrage Opportunities Panel**:
- **Live Opportunity Cards**: Token pair, profit %, buy/sell DEX, estimated profit in USD
- **Action Buttons**: "Execute Trade" button, disabled if balance/gas insufficient
- **Sort/Filter Controls**: By profit %, token pair, liquidity
- **Empty State**: Helpful message when no opportunities detected

**Detailed Logging Panel**:
- **Real-Time Log Stream**: Reverse chronological with monospace font
- **Log Level Indicators**: Badges (ERROR-red, WARN-yellow, INFO-blue, SUCCESS-green)
- **Trade Process Stages**: Visual indicators for Detection → Validation → Preparation → Execution → Result
- **Error Details**: Expandable entries with full error messages, stack traces, recommended actions
- **Filter Controls**: Toggle between log levels, search functionality

### Metric Cards
- **Large Number Display**: `text-3xl font-bold font-mono` for primary value
- **Trend Indicator**: Arrow icon + percentage change
- **Sparkline Chart**: Embedded mini chart showing 24h trend
- **Label**: `text-sm` above value
- **Timestamp**: Last updated time below

### Trading Opportunity Cards
- **Header**: Token pair as prominent title
- **Profit Highlight**: Large profit percentage with + prefix
- **DEX Information**: Buy exchange → Sell exchange with arrow icon
- **Liquidity Check**: Badge indicating sufficient/insufficient liquidity
- **Action Button**: Primary "Execute" or disabled with reason
- **Metadata Row**: Gas cost, expected profit USD, timestamp

### Data Tables
- **Sticky Headers**: Fixed on scroll with sort indicators
- **Alternating Rows**: Subtle striping for readability
- **Monospace Columns**: Right-aligned numerical data
- **Action Column**: Icon buttons for details, re-execute, export
- **Loading Skeleton**: Shimmer effect during fetch

### Status Indicators
- **Bot Status Badge**: `rounded-full px-3 py-1` with pulsing dot for "Running"
- **Transaction Status**: Icon + label (Pending, Confirmed, Failed, Reverted)
- **Network Health**: Traffic light system with tooltips
- **Balance Warnings**: Alert badges when MATIC < minimum

## Icons
Use **Lucide React** icons via CDN:
- Activity/status: `Activity`, `Zap`, `AlertCircle`
- Trading: `TrendingUp`, `TrendingDown`, `DollarSign`
- Actions: `Play`, `Pause`, `StopCircle`, `RefreshCw`

## Responsive Behavior
- **Desktop (lg:)**: Full multi-column layout with persistent sidebar
- **Tablet (md:)**: Collapsible sidebar, 2-column grids reduce to single column
- **Mobile**: Hamburger menu, stacked cards, horizontal scroll tables