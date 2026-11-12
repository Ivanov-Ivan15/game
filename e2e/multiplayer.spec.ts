import { test, expect } from '@playwright/test';

test.describe('Multiplayer E2E: Two Browsers in One Room', () => {
  test('second player sees first player movement and chat messages arrive', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    const room = `e2e_room_${Date.now()}`;
    await page1.goto(`/?roomId=${room}&name=Alice`);
    await page1.waitForFunction(() => (window as any).__GAME_STATE__?.localShip.id > 0);

    await page2.goto(`/?roomId=${room}&name=Bob`);
    await page2.waitForFunction(() => (window as any).__GAME_STATE__?.localShip.id > 0);

    await page1.waitForFunction(() => (window as any).__GAME_STATE__?.remotePlayers.length === 1);
    await page2.waitForFunction(() => (window as any).__GAME_STATE__?.remotePlayers.length === 1);

    const initialPos = await page2.evaluate(() => {
      const remote = (window as any).__GAME_STATE__.remotePlayers[0];
      return { x: remote.x, y: remote.y };
    });

    await page1.click('#gameCanvas');
    await page1.keyboard.down('KeyW');
    await page1.waitForTimeout(700);
    await page1.keyboard.up('KeyW');

    await page2.waitForFunction(
      (start) => {
        const remote = (window as any).__GAME_STATE__.remotePlayers[0];
        return remote && (Math.abs(remote.x - start.x) > 1 || Math.abs(remote.y - start.y) > 1);
      },
      initialPos,
      { timeout: 5000 }
    );

    await page1.fill('#chat-input', 'Привіт з першого браузера!');
    await page1.click('#chat-send');

    const chatLocator = page2.locator('#chat-messages .chat-line');
    await expect(chatLocator).toContainText('Alice: Привіт з першого браузера!');

    await context1.close();
    await context2.close();
  });
});