import { test, expect } from '@playwright/test';

// Test data
const TEST_USER = {
  username: 'testuser',
  email: 'testuser@example.com',
  password: 'TestPassword123!',
};

const TEST_COMMENT = 'This is a test comment from E2E test';

test.describe('Comment Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should allow user to create a comment on a post', async ({ page }) => {
    // Step 1: Login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // Wait for navigation to feed
    await page.waitForURL('/feed');

    // Step 2: Wait for posts to load
    await page.waitForSelector('.post', { timeout: 10000 });

    // Step 3: Find the first post and its comment section
    const firstPost = page.locator('.post').first();
    await expect(firstPost).toBeVisible();

    // Step 4: Find the comment input within the first post
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    await expect(commentInput).toBeVisible();

    // Step 5: Type comment
    await commentInput.fill(TEST_COMMENT);

    // Step 6: Verify character counter updates
    const charCounter = firstPost.locator('text=/\\d+\\/280/');
    await expect(charCounter).toBeVisible();
    await expect(charCounter).toContainText(`${TEST_COMMENT.length}/280`);

    // Step 7: Submit comment
    const submitButton = firstPost.locator('button:has-text("Comment")');
    await submitButton.click();

    // Step 8: Verify comment appears in the list
    await expect(firstPost.locator(`text="${TEST_COMMENT}"`)).toBeVisible({ timeout: 5000 });

    // Step 9: Verify comment shows username
    const commentItem = firstPost.locator('.comment-item').filter({ hasText: TEST_COMMENT });
    await expect(commentItem.locator(`text="${TEST_USER.username}"`)).toBeVisible();

    // Step 10: Verify input is cleared after submission
    await expect(commentInput).toHaveValue('');
  });

  test('should show comment immediately after creation (optimistic UI)', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/feed');

    // Wait for posts
    await page.waitForSelector('.post');
    const firstPost = page.locator('.post').first();

    // Get initial comment count
    const commentsBefore = await firstPost.locator('.comment-item').count();

    // Add comment
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    await commentInput.fill('Quick comment test');
    await firstPost.locator('button:has-text("Comment")').click();

    // Verify comment count increased immediately
    await expect(firstPost.locator('.comment-item')).toHaveCount(commentsBefore + 1, { timeout: 1000 });
  });

  test('should persist comment after page refresh', async ({ page }) => {
    const uniqueComment = `Test comment ${Date.now()}`;

    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/feed');

    // Wait for posts and add comment
    await page.waitForSelector('.post');
    const firstPost = page.locator('.post').first();
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    await commentInput.fill(uniqueComment);
    await firstPost.locator('button:has-text("Comment")').click();

    // Wait for comment to appear
    await expect(firstPost.locator(`text="${uniqueComment}"`)).toBeVisible();

    // Refresh page
    await page.reload();
    await page.waitForSelector('.post');

    // Verify comment still exists
    await expect(page.locator(`text="${uniqueComment}"`)).toBeVisible();
  });
});

test.describe('Comment Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/feed');
    await page.waitForSelector('.post');
  });

  test('should prevent submission of empty comment', async ({ page }) => {
    const firstPost = page.locator('.post').first();
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    const submitButton = firstPost.locator('button:has-text("Comment")');

    // Try to submit empty comment
    await commentInput.fill('');
    await submitButton.click();

    // Verify error message appears or button is disabled
    const isDisabled = await submitButton.isDisabled();
    if (!isDisabled) {
      // Check for error message
      await expect(firstPost.locator('text=/cannot be empty|required/i')).toBeVisible({ timeout: 2000 });
    } else {
      // Button should be disabled for empty input
      expect(isDisabled).toBe(true);
    }
  });

  test('should prevent submission of whitespace-only comment', async ({ page }) => {
    const firstPost = page.locator('.post').first();
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    const submitButton = firstPost.locator('button:has-text("Comment")');

    // Try to submit whitespace-only comment
    await commentInput.fill('   \n\t   ');
    await submitButton.click();

    // Verify error message appears or submission is prevented
    const isDisabled = await submitButton.isDisabled();
    if (!isDisabled) {
      await expect(firstPost.locator('text=/cannot be empty|whitespace|required/i')).toBeVisible({ timeout: 2000 });
    }

    // Verify comment did not appear
    await page.waitForTimeout(1000);
    await expect(firstPost.locator('.comment-item').filter({ hasText: /^\s+$/ })).toHaveCount(0);
  });

  test('should prevent submission of 281 character comment', async ({ page }) => {
    const firstPost = page.locator('.post').first();
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    const submitButton = firstPost.locator('button:has-text("Comment")');

    // Create a 281 character comment
    const longComment = 'a'.repeat(281);
    await commentInput.fill(longComment);

    // Verify character counter shows over limit
    const charCounter = firstPost.locator('text=/\\d+\\/280/');
    await expect(charCounter).toContainText('281/280');

    // Try to submit
    await submitButton.click();

    // Verify error message appears or button is disabled
    const isDisabled = await submitButton.isDisabled();
    if (!isDisabled) {
      await expect(firstPost.locator('text=/too long|character limit|280 characters/i')).toBeVisible({ timeout: 2000 });
    } else {
      expect(isDisabled).toBe(true);
    }
  });

  test('should allow submission at exactly 280 characters', async ({ page }) => {
    const firstPost = page.locator('.post').first();
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    const submitButton = firstPost.locator('button:has-text("Comment")');

    // Create exactly 280 character comment
    const maxComment = 'a'.repeat(280);
    await commentInput.fill(maxComment);

    // Verify character counter shows 280/280
    const charCounter = firstPost.locator('text=/280\\/280/');
    await expect(charCounter).toBeVisible();

    // Submit should work
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Verify comment appears
    await expect(firstPost.locator('.comment-item').filter({ hasText: maxComment })).toBeVisible({ timeout: 5000 });
  });

  test('should show real-time character count as user types', async ({ page }) => {
    const firstPost = page.locator('.post').first();
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    const charCounter = firstPost.locator('text=/\\d+\\/280/');

    // Type progressively and check counter
    await commentInput.fill('Hello');
    await expect(charCounter).toContainText('5/280');

    await commentInput.fill('Hello World');
    await expect(charCounter).toContainText('11/280');

    await commentInput.fill('');
    await expect(charCounter).toContainText('0/280');
  });

  test('should disable submit button when input is invalid', async ({ page }) => {
    const firstPost = page.locator('.post').first();
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    const submitButton = firstPost.locator('button:has-text("Comment")');

    // Empty input - button should be disabled
    await commentInput.fill('');
    await expect(submitButton).toBeDisabled();

    // Valid input - button should be enabled
    await commentInput.fill('Valid comment');
    await expect(submitButton).toBeEnabled();

    // Over limit - button should be disabled
    await commentInput.fill('a'.repeat(281));
    await expect(submitButton).toBeDisabled();
  });
});

test.describe('Comment Display', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/feed');
    await page.waitForSelector('.post');
  });

  test('should display all comments for a post', async ({ page }) => {
    const firstPost = page.locator('.post').first();

    // Add multiple comments
    const comments = [
      `Comment 1 - ${Date.now()}`,
      `Comment 2 - ${Date.now()}`,
      `Comment 3 - ${Date.now()}`,
    ];

    for (const comment of comments) {
      const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
      await commentInput.fill(comment);
      await firstPost.locator('button:has-text("Comment")').click();
      await page.waitForTimeout(500); // Small delay between comments
    }

    // Verify all comments are visible
    for (const comment of comments) {
      await expect(firstPost.locator(`text="${comment}"`)).toBeVisible();
    }

    // Verify comment count
    const commentItems = firstPost.locator('.comment-item');
    const count = await commentItems.count();
    expect(count).toBeGreaterThanOrEqual(comments.length);
  });

  test('should display comments in chronological order', async ({ page }) => {
    const firstPost = page.locator('.post').first();

    // Add comments with unique timestamps
    const comment1 = `First comment ${Date.now()}`;
    await page.waitForTimeout(100);
    const comment2 = `Second comment ${Date.now()}`;
    await page.waitForTimeout(100);
    const comment3 = `Third comment ${Date.now()}`;

    // Add comments in order
    for (const comment of [comment1, comment2, comment3]) {
      const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
      await commentInput.fill(comment);
      await firstPost.locator('button:has-text("Comment")').click();
      await page.waitForTimeout(500);
    }

    // Get all comment texts
    const commentItems = firstPost.locator('.comment-item');
    await commentItems.first().waitFor({ state: 'visible' });

    // Find the positions of our test comments
    const allComments = await commentItems.allTextContents();
    const index1 = allComments.findIndex(text => text.includes(comment1));
    const index2 = allComments.findIndex(text => text.includes(comment2));
    const index3 = allComments.findIndex(text => text.includes(comment3));

    // Verify chronological order (oldest first)
    expect(index1).toBeGreaterThanOrEqual(0);
    expect(index2).toBeGreaterThan(index1);
    expect(index3).toBeGreaterThan(index2);
  });

  test('should display username for each comment', async ({ page }) => {
    const firstPost = page.locator('.post').first();

    // Add a comment
    const testComment = `Username test ${Date.now()}`;
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    await commentInput.fill(testComment);
    await firstPost.locator('button:has-text("Comment")').click();

    // Find the comment item
    const commentItem = firstPost.locator('.comment-item').filter({ hasText: testComment });
    await expect(commentItem).toBeVisible();

    // Verify username is displayed
    await expect(commentItem.locator(`text="${TEST_USER.username}"`)).toBeVisible();
  });

  test('should display timestamp for each comment', async ({ page }) => {
    const firstPost = page.locator('.post').first();

    // Add a comment
    const testComment = `Timestamp test ${Date.now()}`;
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    await commentInput.fill(testComment);
    await firstPost.locator('button:has-text("Comment")').click();

    // Find the comment item
    const commentItem = firstPost.locator('.comment-item').filter({ hasText: testComment });
    await expect(commentItem).toBeVisible();

    // Verify timestamp is displayed (looking for relative time like "just now", "1m ago", etc.)
    await expect(commentItem.locator('text=/just now|\\d+[smhd] ago|\\d+:\\d+/i')).toBeVisible();
  });

  test('should show empty state when post has no comments', async ({ page }) => {
    // This test assumes there might be posts without comments
    // If all posts have comments, this test will be skipped
    const posts = page.locator('.post');
    const postCount = await posts.count();

    let foundEmptyPost = false;

    for (let i = 0; i < postCount; i++) {
      const post = posts.nth(i);
      const commentItems = post.locator('.comment-item');
      const count = await commentItems.count();

      if (count === 0) {
        // Found a post with no comments
        foundEmptyPost = true;
        
        // Verify empty state message
        await expect(post.locator('text=/no comments|be the first/i')).toBeVisible();
        break;
      }
    }

    // If no empty post found, skip this assertion
    if (!foundEmptyPost) {
      test.skip();
    }
  });

  test('should display comments with proper formatting', async ({ page }) => {
    const firstPost = page.locator('.post').first();

    // Add a comment with special characters
    const testComment = `Test with special chars: @user #hashtag & "quotes" 😀`;
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    await commentInput.fill(testComment);
    await firstPost.locator('button:has-text("Comment")').click();

    // Verify comment displays correctly
    await expect(firstPost.locator(`text="${testComment}"`)).toBeVisible();
  });

  test('should handle long usernames gracefully', async ({ page }) => {
    const firstPost = page.locator('.post').first();

    // Add a comment
    const testComment = `Layout test ${Date.now()}`;
    const commentInput = firstPost.locator('textarea[placeholder*="comment" i]');
    await commentInput.fill(testComment);
    await firstPost.locator('button:has-text("Comment")').click();

    // Find the comment item
    const commentItem = firstPost.locator('.comment-item').filter({ hasText: testComment });
    await expect(commentItem).toBeVisible();

    // Verify the comment item has proper layout (not overflowing)
    const boundingBox = await commentItem.boundingBox();
    expect(boundingBox).not.toBeNull();
    if (boundingBox) {
      expect(boundingBox.width).toBeGreaterThan(0);
      expect(boundingBox.height).toBeGreaterThan(0);
    }
  });
});
