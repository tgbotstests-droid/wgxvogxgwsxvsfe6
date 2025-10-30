
# ArbitrageExecutor Smart Contract

Смарт-контракт для исполнения арбитражных сделок с использованием Flash Loans от Aave V3 на Polygon.

## Возможности

- ✅ Flash Loans от Aave V3
- ✅ Выполнение арбитража через несколько DEX
- ✅ Автоматическая проверка прибыльности
- ✅ Защита от убытков (минимальный порог прибыли)
- ✅ Управление доступом (только разрешенные исполнители)
- ✅ Аварийный вывод средств

## Установка

```bash
cd contracts
npm install
```

## Настройка

Создайте файл `.env`:

```env
# Private key для развертывания
PRIVATE_KEY=your_private_key_here

# RPC URLs
POLYGON_RPC_URL=https://polygon-rpc.com
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com

# PolygonScan API key для верификации
POLYGONSCAN_API_KEY=your_polygonscan_api_key
```

## Компиляция

```bash
npm run compile
```

## Развертывание

### Testnet (Mumbai)

```bash
npm run deploy:mumbai
```

### Mainnet (Polygon)

```bash
npm run deploy:polygon
```

## Верификация контракта

После развертывания:

```bash
npx hardhat verify --network polygon <CONTRACT_ADDRESS> "<POOL_ADDRESSES_PROVIDER>"
```

## Использование

### 1. Получить адрес контракта

После развертывания адрес будет сохранен в `deployment-{chainId}.json`.

### 2. Добавить контракт в настройки бота

В файле `server/tradeExecutor.ts` используйте адрес развернутого контракта:

```typescript
const ARBITRAGE_CONTRACT = "0x..."; // Адрес из deployment.json
```

### 3. Пополнить контракт (опционально)

Если не используете Flash Loans, пополните контракт токенами для торговли.

### 4. Выполнить арбитраж

Бот автоматически будет использовать контракт для исполнения сделок.

## Безопасность

- ✅ Контракт принадлежит владельцу (Ownable)
- ✅ Только разрешенные адреса могут выполнять арбитраж
- ✅ Минимальный порог прибыли предотвращает убыточные сделки
- ✅ Аварийный вывод средств только для владельца
- ✅ Flash Loan автоматически возвращается или откатывается

## Стоимость развертывания

Примерные затраты на газ:

- **Mumbai (testnet)**: ~0.01 MATIC (бесплатно из крана)
- **Polygon (mainnet)**: ~0.05-0.1 MATIC (~$0.03-0.07)

## Адреса Aave V3

- **Polygon Mainnet**: `0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb`
- **Mumbai Testnet**: `0x5343b5bA672Ae99d627A1C87866b8E53F47Db2E6`

## Поддерживаемые токены

- USDC
- USDT
- DAI
- WETH
- WMATIC
- WBTC

## Troubleshooting

### Недостаточно MATIC для развертывания

Получите MATIC из крана:
- Mumbai: https://faucet.polygon.technology/
- Polygon: Купите на бирже и переведите

### Ошибка компиляции

Убедитесь, что установлены все зависимости:
```bash
npm install
```

### Ошибка при выполнении

Проверьте логи транзакции на PolygonScan для детальной информации об ошибке.
