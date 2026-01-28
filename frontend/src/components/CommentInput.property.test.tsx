import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import CommentInput from './CommentInput';
import { AuthProvider } from '../contexts/AuthContext';

// Mock the API
vi.mock('../services/api', () => ({
  commentsApi: {
    createComment: vi.fn().mockResolvedValue({
      id: 'comment-123',
      postId: 'post-123',
      userId: 'user-123',
      username: 'testuser',
      text: 'test comment',
      createdAt: new Date().toISOString(),
    }),
  },
  authApi: {},
  usersApi: {
    getProfile: vi.fn().mockResolvedValue({
      user: {
        id: 'user-123',
        username: 'testuser',
        email: 'test@example.com',
        displayName: 'Test User',
        followerCount: 0,
        followingCount: 0,
      },
    }),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const MAX_COMMENT_LENGTH = 280;

// Helper to render CommentInput with auth context
const renderWithAuth = () => {
  // Set up mock auth data in localStorage
  localStorageMock.setItem('token', 'mock-token');
  localStorageMock.setItem('user', JSON.stringify({
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    displayName: 'Test User',
  }));

  const mockOnCommentCreated = vi.fn();

  const result = render(
    <AuthProvider>
      <CommentInput postId="post-123" onCommentCreated={mockOnCommentCreated} />
    </AuthProvider>
  );

  return {
    ...result,
    mockOnCommentCreated,
  };
};

describe('Feature: post-comments - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  /**
   * Property 14: Character counter accuracy
   * **Validates: Requirements 6.3**
   * 
   * For any text input in the comment field, the displayed character counter should
   * show the correct number of remaining characters (280 minus current length).
   */
  describe('Property 14: Character counter accuracy', () => {
    it('should display correct remaining characters for any text input', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate strings of various lengths (0 to 350 characters)
          fc.string({ minLength: 0, maxLength: 350 }),
          async (inputText) => {
            const user = userEvent.setup();
            const { unmount } = renderWithAuth();

            const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
            
            // Directly set the value to avoid slow typing
            await user.click(textarea);
            await user.clear(textarea);
            
            // Use paste to set the value quickly
            if (inputText.length > 0) {
              await user.paste(inputText);
            }

            // Calculate expected remaining characters
            const expectedRemaining = MAX_COMMENT_LENGTH - inputText.length;

            // Find the character counter element
            const charCounter = screen.getByText(new RegExp(`${Math.abs(expectedRemaining)} characters? remaining`, 'i'));
            
            // Verify the counter displays the correct value
            expect(charCounter).toBeInTheDocument();
            expect(charCounter.textContent).toContain(`${expectedRemaining} characters remaining`);
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show correct remaining characters for boundary values', async () => {
      const user = userEvent.setup();
      
      // Test boundary cases
      const testCases = [
        { length: 0, expected: 280 },
        { length: 1, expected: 279 },
        { length: 280, expected: 0 },
        { length: 281, expected: -1 },
        { length: 300, expected: -20 },
      ];

      for (const testCase of testCases) {
        const { unmount } = renderWithAuth();
        
        const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
        const text = 'a'.repeat(testCase.length);
        
        await user.click(textarea);
        await user.clear(textarea);
        if (text.length > 0) {
          await user.paste(text);
        }

        const charCounter = screen.getByText(new RegExp(`${Math.abs(testCase.expected)} characters? remaining`, 'i'));
        expect(charCounter).toBeInTheDocument();
        expect(charCounter.textContent).toContain(`${testCase.expected} characters remaining`);
        
        unmount();
      }
    });

    it('should calculate remaining characters based on actual string length', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate strings with various characters including Unicode
          fc.string({ minLength: 1, maxLength: 100 }),
          async (inputText) => {
            const user = userEvent.setup();
            const { unmount } = renderWithAuth();

            const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
            
            await user.click(textarea);
            await user.clear(textarea);
            await user.paste(inputText);

            // The counter should use the actual string length
            const expectedRemaining = MAX_COMMENT_LENGTH - inputText.length;

            const charCounter = screen.getByText(new RegExp(`${Math.abs(expectedRemaining)} characters? remaining`, 'i'));
            expect(charCounter).toBeInTheDocument();
            expect(charCounter.textContent).toContain(`${expectedRemaining} characters remaining`);
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle whitespace characters correctly in character count', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate strings with various whitespace characters
          fc.array(
            fc.constantFrom(' ', '\t', '\n', 'a', 'b', 'c'),
            { minLength: 1, maxLength: 50 }
          ).map(arr => arr.join('')),
          async (inputText) => {
            const user = userEvent.setup();
            const { unmount } = renderWithAuth();

            const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
            
            await user.click(textarea);
            await user.clear(textarea);
            await user.paste(inputText);

            // Whitespace characters should count toward the total
            const expectedRemaining = MAX_COMMENT_LENGTH - inputText.length;

            const charCounter = screen.getByText(new RegExp(`${Math.abs(expectedRemaining)} characters? remaining`, 'i'));
            expect(charCounter).toBeInTheDocument();
            expect(charCounter.textContent).toContain(`${expectedRemaining} characters remaining`);
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should show warning style when remaining characters are low', async () => {
      const user = userEvent.setup();
      renderWithAuth();

      const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
      
      // Type text to get below 20 characters remaining
      const text = 'a'.repeat(265); // 280 - 265 = 15 remaining
      await user.click(textarea);
      await user.clear(textarea);
      await user.paste(text);

      const charCounter = screen.getByText(/15 characters remaining/i);
      expect(charCounter).toBeInTheDocument();
      
      // Check if warning class is applied
      expect(charCounter).toHaveClass('warning');
    });

    it('should maintain accuracy across different text lengths', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate multiple text lengths to test
          fc.integer({ min: 0, max: 400 }),
          async (textLength) => {
            const user = userEvent.setup();
            const { unmount } = renderWithAuth();

            const textarea = screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement;
            const text = 'x'.repeat(textLength);
            
            await user.click(textarea);
            await user.clear(textarea);
            if (text.length > 0) {
              await user.paste(text);
            }

            const expectedRemaining = MAX_COMMENT_LENGTH - textLength;

            const charCounter = screen.getByText(new RegExp(`${Math.abs(expectedRemaining)} characters? remaining`, 'i'));
            expect(charCounter).toBeInTheDocument();
            expect(charCounter.textContent).toContain(`${expectedRemaining} characters remaining`);
            
            unmount();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
