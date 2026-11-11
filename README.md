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

### 1. Встановлення залежностей
```bash
npm install