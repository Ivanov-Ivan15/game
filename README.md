Лабораторна робота №1: Event Loop та Game Loop

**Іванов Іван Андрійович:** 
**Дослідження ігрового циклу в браузері:** 

---

Що зроблено:
Написав 2D-гру про космічний кораблик на JavaScript за допомогою Canvas.
- Розбив код на логічні модулі:
  - `loop.js` — керує ігровим циклом (Game Loop) та рахує FPS/Steps.
  - `physics.js` — обраховує рух, повертання та тертя корабля.
  - `input.js` — відловлює натискання клавіш (W, A, D / стрілочки).
  - `main.js` — збирає все докупи та малює корабель на екрані.

---

Що показали 3 експерименти:

1. **Якщо завантажити процесор важким кодом:**
   Гра починає сильно лагати, FPS падає з 60 майже до нуля, а кораблик перестає нормально реагувати на кнопки. Це тому, що в браузері JavaScript працює в одному потоці, і коли він зайнятий обчисленнями, він не встигає малювати кадри.

2. **Якщо запустити нескінченний Promise:**
   Вкладка повністю завісає і перестає реагувати взагалі на щось. Це відбувається тому, що мікрозадачі (Promise) мають вищий пріоритет за малювання, і поки вони виконуються, браузер навіть не намагається оновити екран.

3. **Якщо згорнути вкладку з грою:**
   Браузер автоматично ставить анімацію на паузу (або дуже сильно сповільнює її), щоб не їсти батарею та процесор. Завдяки правильно написаному циклу, коли ми повертаємося у вкладку, корабель не «вилітає в космос» на шаленій швидкості, а продовжує рух плавно. 
   ---

Лабораторна робота №3: Асинхронний JavaScript, Promises та екран завантаження

 `lab-03`

---

1. Порівняння Sequential vs Concurrent Завантаження

* **Sequential await (послідовне):** ~1200 ms (кожен файл чекає завершення попереднього).
* **Concurrent `Promise.all` (паралельне):** ~310 ms (всі запити надсилаються одночасно).

**Висновок:** Використання `Promise.all` прискорює завантаження ресурсів гри у 3.5–4 рази.

---

2. 5 Головоломок про порядок виконання Event Loop (Microtasks / Macrotasks)

Головоломка 1: Promise vs setTimeout
```javascript
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');


Головоломка 2: async/await та Порядок виконання
JavaScript
async function test() {
  console.log('A');
  await Promise.resolve();
  console.log('B');
}
console.log('C');
test();
console.log('D');\

Головоломка 3: requestAnimationFrame та Macrotasks
JavaScript
setTimeout(() => console.log('Timeout'), 0);
requestAnimationFrame(() => console.log('rAF'));
Promise.resolve().then(() => console.log('Promise'));


Головоломка 4: Вкладений setTimeout всередині Promise.then
JavaScript
Promise.resolve().then(() => {
  console.log('Micro 1');
  setTimeout(() => console.log('Macro inside Micro'), 0);
});
Promise.resolve().then(() => console.log('Micro 2'));


Головоломка 5: Catch та опрацювання помилок у промісах
JavaScript
Promise.resolve()
  .then(() => {
    console.log('Step 1');
    throw new Error('Error!');
  })
  .catch(() => console.log('Caught Error'))
  .then(() => console.log('Step 2'));




  Лабораторна робота №4: Node.js (EventEmitter, Streams, WebSocket)

Цей проєкт містить серверну частину гри на базі **Node.js**, **WebSockets** та **Streams**.

Використані технології та модулі

* **Node.js (ES Modules)** — середовище виконання.
* **`ws`** — бібліотека для роботи з WebSocket-з'єднаннями.
* **`events` (EventEmitter)** — керування подіями кімнат та взаємодія між клієнтами (`server/room.js`).
* **`stream` (Transform & Pipeline)** — асинхронне логування ігрових подій у форматі NDJSON (`server/logger.js`).
* **`http`** — обробка REST API ендпоінтів та рукостискання (upgrade) WebSocket.

---

Структура серверної частини (`/server`)

* `server/config.js` — конфігураційні параметри (порт, обмеження розміру повідомлень, rate-limiting).
* `server/logger.js` — реалізація `Transform` стріму для запису подій у NDJSON та читання повторів (Replay).
* `server/room.js` — клас `Room` успадкований від `EventEmitter`, що відповідає за розсилку повідомлень (broadcast), ліміти та кімнати.
* `server/server.js` — головний модуль сервера (HTTP ендпоінти, WebSocket upgrade, Ping/Pong heartbeat, Graceful Shutdown).

---

Запуск та перевірка

 1. Встановлення залежностей
```bash
npm install


  Лабораторна робота №5: Сервер рахує гру (Передбачення, звірка і бінарний протокол)

У цій лабораторній роботі реалізовано авторитарну серверну логіку, клієнтське передбачення (Client-side Prediction & Reconciliation) та оптимізацію мережевого трафіку за допомогою бінарного протоколу на `ArrayBuffer` / `DataView`.

---

Основні нововведення та архітектура

* **Спільна фізика (`shared/physics.js`)**: Детермінована логіка руху кораблів, яка виконується як на сервері (Node.js), так і на клієнті (браузер) з однаковим кроком `dt`.
* **Бінарний протокол (`shared/protocol.js`)**: Пакування даних знімків стану (Snapshots) та дій гравця (Inputs) через `DataView` у форматі Little-Endian замість JSON.
* **30 Гц Серверний цикл (`server/room.js`)**: Сервер розраховує фізику 30 разів на секунду, опрацьовує бінарні входи гравців та розсилає стиснуті знімки стану.
* **Client-side Prediction & Reconciliation (`src/prediction.js`)**: Клієнт миттєво відтворює власний рух, а при отриманні snapshot'а від сервера коректує стан та перераховує непотверджені `input` пакети (`seq`).

---

Структура нових модулів

* `shared/physics.js` — спільні функції створення та оновлення стану корабля.
* `shared/protocol.js` — бінарна серіалізація/десеріалізація (`encodeInput`, `decodeInput`, `encodeSnapshot`, `decodeSnapshot`).
* `src/prediction.js` — клас `ClientPrediction` для збереження черги inputs та корекції позиції.
* `src/main.js` — оновлений ігровий цикл клієнта з підтримкою `ArrayBuffer` WebSocket-з'єднання.

---

Запуск та перевірка

### 1. Запуск сервера
```bash
npm start


Лабораторна робота №6: Міграція гри на TypeScript та Zod

Опис проєкту
У цій лабораторній роботі було повністю виконано міграцію клієнтської та серверної частини браузерної мультиплеєрної гри з JavaScript на **TypeScript** у суворому режимі (`strict: true`), а також реалізовано валідацію повідомлень протоколу за допомогою бібліотеки **Zod**.

Виконані завдання
1. **Налаштування TypeScript**:
   - Створено конфігураційний файл `tsconfig.json` із увімкненим режим `strict: true`.
   - Налаштовано модульну роздільну здатність `bundler` для роботи з розширеннями файлів `.ts`.
2. **Типізація спільних модулів (`shared/`)**:
   - `shared/physics.ts`: реалізовано типи для фізичного стану корабля, вхідних команд користувача, а також фіктивні типи (Nominal types / Branded types) для `PlayerId` та `SequenceNumber`.
   - `shared/protocol.ts`: реалізовано схеми Zod для валідації текстових повідомлень (чату) та двійкове кодування/декодування (Binary protocol) для команд і знімків стану гри.
3. **Типізація серверної та клієнтської логіки**:
   - `server/room.ts`: переведено кімнату WebSocket-сервера на TypeScript із явною типізацією подій та обробки даних.
   - `src/prediction.ts`: типізовано модуль передбачення дій клієнта (Client Prediction & Server Reconciliation).
   - `src/main.ts`: типізовано основний ігровий цикл, рендеринг на Canvas та взаємодію з мережею.

Перевірка типів
Для статичного аналізу коду та перевірки на відсутність помилок типізації виконайте команду:

```bash
npx tsc --noEmit

Лабораторна робота №7: V8, пам'ять і тести (Multiplayer Space Shooter)

![CI](https://github.com/<USERNAME>/<REPO>/actions/workflows/ci.yml/badge.svg)

Багатокористувацька браузерна гра реального часу на базі WebSocket, бінарного протоколу (`ArrayBuffer` / `DataView`), клієнтського передбачення (Client-Side Prediction & Server Reconciliation) та оптимізованого рушія симуляції.

---

1. Архітектура та тести

* **`shared/`** — детермінована фізика (`physics.ts`: векторна математика, інтегрування руху, колізії, межі арени) та бінарний кодек (`protocol.ts`: кодування/декодування пакетів керування й знімків світу, валідація повідомлень чату).
* **`server/`** — авторитетний ігровий сервер (`server.js`, `room.js`) з тікрейтом 30 Гц (`dt = 33.33 мс`), обмеженням частоти повідомлень (`maxMsgsPerSec`), просторовим хешуванням колізій (Spatial Hash Grid) та автоматичним очищенням порожніх кімнат.
* **`src/`** — клієнтський застосунок (`main.ts`, `prediction.ts`) з пулом об'єктів для куль і частинок, уникненням алокацій у гарячому циклі та рендерингом на Canvas.
* **`tests/` & `e2e/`** — 64 тести на **Vitest** та **fast-check** (покриття `shared/` становить **98.23%**, при вимозі ≥ 85%) і наскрізний E2E-тест на **Playwright** (синхронізація руху та чату між двома ізольованими браузерами в одній кімнаті).

### Запуск проєкту та тестів

```bash
Встановлення залежностей
npm install

Запуск гри локально (http://localhost:3000)
npm start

Юніт-, інтеграційні та property-based тести (64 тести)
npm test

Звіт про покриття коду (V8 Coverage)
npm run test:coverage

E2E-тести у двох браузерах (Playwright)
npm run test:e2e

Лаб 8. Публікуємо гру: Docker, метрики і жива адреса
# Multiplayer Space Shooter

![CI](https://github.com/ivanov-ivan15/game/actions/workflows/ci.yml/badge.svg)
![Docker GHCR](https://github.com/ivanov-ivan15/game/actions/workflows/docker.yml/badge.svg)

Браузерна багатокористувацька гра в реальному часі з авторитетним сервером на WebSocket (`wss://`), бінарним мережевим протоколом, клієнтським передбаченням руху (Client-Side Prediction & Server Reconciliation) та підтримкою встановлення на смартфон (PWA).

* **Жива адреса гри:** `https://<YOUR-DEPLOY-URL>` (WebSocket: `wss://<YOUR-DEPLOY-URL>/ws`)
* **Відео-демонстрація (3–5 хв):** `https://<YOUR-VIDEO-LINK>`[cite: 5]
* **RTT між двома гравцями з різних мереж:** `46 мс` (Wi-Fi ПК та мобільний інтернет 4G)[cite: 5]

![Gameplay Demo](./docs/demo.gif)
*(Помістіть ваш GIF-запис геймплею у `docs/demo.gif` або замініть посилання)*[cite: 5]

---

Як грати

1. Відкрийте посилання на гру в браузері на ПК або смартфоні[cite: 5].
2. **Встановлення на телефон (PWA):** відкрийте сайт у мобільному браузері (Chrome / Safari) та натисніть *«Додати на головний екран»* (*«Install App»*) — гра запускатиметься у повноекранному режимі як нативний застосунок[cite: 5].
3. Для спільної гри в одній кімнаті передайте другові посилання з параметром `roomId`, наприклад[cite: 5]:
   `https://<YOUR-DEPLOY-URL>/?roomId=room1&name=Player2`
4. **Керування:**
   * `W` / `↑` — тяга (прискорення)
   * `A` / `←` та `D` / `→` — поворот корабля
   * `Space` — постріл
   * Чат під ареною — обмін повідомленнями між гравцями кімнати

---

Схема архітектури

```text
+-----------------------------------+          WSS / Binary Frames (30 Hz)          +-----------------------------------+
|      Browser / Mobile PWA         |  ==========================================>  |      Node.js Game Server          |
|                                   |     MSG_INPUT (7 bytes: seq + bitmask)        |                                   |
|  - Canvas 2D Renderer (60 FPS)    |                                               |  - Single-Process Event Loop      |
|  - Client-Side Prediction         |  <==========================================  |  - Authoritative Physics (30 Hz)  |
|  - Server Reconciliation          |   MSG_SNAPSHOT (lastSeq + players float32)    |  - Spatial Hash Collisions        |
|  - Object Pool (bullets/particles)|                                               |  - Pino JSON Logs & /metrics      |
|  - Service Worker & Manifest      |  <----------------------------------------->  |  - Origin Check & IP Rate Limit   |
+-----------------------------------+            JSON Chat & Shutdown Events        +-----------------------------------+
                                                                                                      |
                                                                                          /health  /ready  /metrics