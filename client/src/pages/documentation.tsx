import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Book, Zap, Shield, Settings, Wallet, FileText } from "lucide-react";

export default function Documentation() {
  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Book className="h-8 w-8 text-primary" />
          Документация
        </h1>
        <p className="text-muted-foreground">Руководство по использованию Flash Loan Arbitrage Bot</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Быстрый Старт
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
          <h3>1. Настройка Сети и RPC</h3>
          <p>
            Перейдите в раздел <strong>Настройки</strong> и укажите:
          </p>
          <ul>
            <li>Режим сети (Testnet для тестирования, Mainnet для реальной торговли)</li>
            <li>RPC URL для Polygon (можно получить на <a href="https://chainlist.org" target="_blank" rel="noopener noreferrer" className="text-primary">Chainlist.org</a>)</li>
          </ul>

          <h3>2. API Ключи</h3>
          <p>Получите и настройте API ключи для:</p>
          <ul>
            <li><strong>1inch</strong>: <a href="https://portal.1inch.dev/" target="_blank" rel="noopener noreferrer" className="text-primary">portal.1inch.dev</a></li>
            <li><strong>GeckoTerminal</strong>: Бесплатный API, не требует регистрации. 30 запросов/мин. <a href="https://www.geckoterminal.com/dex-api" target="_blank" rel="noopener noreferrer" className="text-primary">geckoterminal.com/dex-api</a></li>
            <li><strong>Telegram</strong> (опционально): создайте бота через <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary">@BotFather</a></li>
          </ul>

          <h3>3. Настройка Торговых Параметров</h3>
          <p>Установите минимальные параметры прибыльности и риска:</p>
          <ul>
            <li>Минимальная прибыль (%)</li>
            <li>Сумма Flash Loan</li>
            <li>Максимальный Gas Price</li>
          </ul>

          <h3>4. Запуск Бота</h3>
          <p>После настройки перейдите на <strong>Панель управления</strong> и нажмите кнопку <strong>Запустить</strong>.</p>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Интеграция Ledger Hardware Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
          <h3>Подключение Ledger</h3>
          <ol>
            <li>Подключите Ledger устройство через USB</li>
            <li>Введите PIN-код на устройстве</li>
            <li>Откройте приложение <strong>Ethereum</strong> на Ledger</li>
            <li>В разделе <strong>Ledger</strong> нажмите кнопку "Обновить Статус"</li>
          </ol>

          <h3>Timeout и Fallback</h3>
          <p>
            При запросе подписи у вас есть <strong>10 секунд</strong> на подтверждение.
            Если время истекло, система автоматически отправит QR код в Telegram для ручной подписи.
          </p>

          <h3>Проверка Батареи</h3>
          <p>
            Система автоматически проверяет уровень заряда перед каждой подписью.
            При уровне ниже 20% вы получите предупреждение.
          </p>

          <h3>Использование для Safe Multisig</h3>
          <p>
            Ledger может быть настроен как второй подписант для Gnosis Safe.
            Включите опцию в настройках: <strong>USE_LEDGER_FOR_SAFE_SIGNER2</strong>
          </p>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Настройка Gnosis Safe Multisig
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
          <h3>Создание Safe</h3>
          <ol>
            <li>Перейдите на <a href="https://app.safe.global" target="_blank" rel="noopener noreferrer" className="text-primary">app.safe.global</a></li>
            <li>Подключите кошелек и выберите сеть Polygon</li>
            <li>Создайте новый Safe с 2 владельцами и порогом 2 подписи</li>
            <li>Скопируйте адрес Safe</li>
          </ol>

          <h3>Настройка в Боте</h3>
          <p>
            В разделе <strong>Настройки</strong> укажите:
          </p>
          <ul>
            <li>Адрес Gnosis Safe</li>
            <li>Приватный ключ второго подписанта (или используйте Ledger)</li>
            <li>Включите автоматическую подпись</li>
          </ul>

          <h3>Как это Работает</h3>
          <p>
            1. Бот создает транзакцию и добавляет первую подпись<br />
            2. Система автоматически добавляет вторую подпись через настроенный метод<br />
            3. Транзакция выполняется автоматически при достижении порога подписей
          </p>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Подключение MetaMask
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
          <h3>Установка</h3>
          <ol>
            <li>Установите расширение <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="text-primary">MetaMask</a> для браузера</li>
            <li>Создайте новый кошелек или импортируйте существующий</li>
            <li>Добавьте сеть Polygon (настройки сети можно найти на <a href="https://chainlist.org/chain/137" target="_blank" rel="noopener noreferrer" className="text-primary">Chainlist</a>)</li>
          </ol>

          <h3>Подключение к Боту</h3>
          <p>
            Перейдите в раздел <strong>Кошелек</strong> и нажмите "Подключить MetaMask".
            Подтвердите подключение в popup окне MetaMask.
          </p>

          <h3>Переключение Сетей</h3>
          <p>
            Убедитесь что вы подключены к нужной сети:
          </p>
          <ul>
            <li><strong>Mainnet</strong>: Chain ID 137 (реальная торговля)</li>
            <li><strong>Amoy Testnet</strong>: Chain ID 80002 (тестирование)</li>
          </ul>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Решение Проблем
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
          <h3>Ledger не подключается</h3>
          <ul>
            <li>Проверьте что Ethereum приложение открыто на устройстве</li>
            <li>Убедитесь что "Contract data" включен в настройках приложения</li>
            <li>Попробуйте переподключить USB кабель</li>
            <li>Обновите прошивку Ledger до последней версии</li>
          </ul>

          <h3>Бот не находит арбитражные возможности</h3>
          <ul>
            <li>Проверьте что API ключи настроены правильно</li>
            <li>Убедитесь что минимальная прибыль не слишком высока</li>
            <li>Проверьте баланс для оплаты gas</li>
            <li>Попробуйте другую сумму Flash Loan</li>
          </ul>

          <h3>Safe транзакции не выполняются</h3>
          <ul>
            <li>Проверьте что настроены оба подписанта</li>
            <li>Убедитесь что Safe имеет достаточно средств для gas</li>
            <li>Проверьте порог подписей в Safe (должен быть 2 из 2)</li>
          </ul>

          <h3>Высокие затраты на Gas</h3>
          <ul>
            <li>Понизьте максимальный Gas Price в настройках</li>
            <li>Торгуйте в периоды низкой активности сети</li>
            <li>Увеличьте минимальную прибыль для фильтрации мелких сделок</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
