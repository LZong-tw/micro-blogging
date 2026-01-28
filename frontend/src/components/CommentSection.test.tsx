import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { commentsApi } from '../services/api';
import CommentSection from './CommentSection';
import { Comment } from '../types';
import { useAuth } from '../contexts/AuthContext';

// Mock the AuthContext module
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock the API module
vi.mock('../services/api', () => ({
  commentsApi: {
    getComments: vi.fn(),
    createComment: vi.fn(),
  },
}));

// Mock child components
vi.mock('./CommentItem', () => ({
  default: ({ comment }: { comment: Comment }) => (
    <div data-testid={`comment-${comment.id}`}>
      <span>{comment.username}</span>
      <span>{comment.text}</span>
    </div>
  ),
}));

vi.mock('./CommentInput', () => ({
  default: ({ onCommentCreated }: { onCommentCreated: (comment: Comment) => void }) => (
    <div data-testid="comment-input">
      <button
        onClick={() => {
          const newComment: Comment = {
            id: 'comment-new',
            postId: 'post-1',
            userId: 'user-1',
            username: 'testuser',
            text: 'New comment',
            createdAt: new Date().toISOString(),
          };
          onCommentCreated(newComment);
        }}
      >
        Add Comment
      </button>
    </div>
  ),
}));

describe('CommentSection', () => {
  const mockToken = 'mock-token-123';
  const mockPostId = 'post-1';

  const mockComments: Comment[] = [
    {
      id: 'comment-1',
      postId: mockPostId,
      userId: 'user-1',
      username: 'alice',
      text: 'First comment',
      createdAt: '2024-01-01T10:00:00Z',
    },
    {
      id: 'comment-2',
      postId: mockPostId,
      userId: 'user-2',
      username: 'bob',
      text: 'Second comment',
      createdAt: '2024-01-01T11:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock for useAuth
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      user: { 
        id: 'user-1', 
        username: 'testuser', 
        email: 'test@example.com', 
        displayName: 'Test User', 
        bio: '', 
        followersCount: 0, 
        followingCount: 0, 
        createdAt: '' 
      },
      token: mockToken,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      loading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Loading State', () => {
    it('should display loading state while fetching comments', () => {
      // Mock API to never resolve (simulating loading)
      vi.mocked(commentsApi.getComments).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<CommentSection postId={mockPostId} />);

      expect(screen.getByText('Loading comments...')).toBeInTheDocument();
      expect(screen.queryByTestId('comment-input')).not.toBeInTheDocument();
    });

    it('should not display loading state when token is missing', () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: false,
        user: null,
        token: null,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        loading: false,
        error: null,
      });

      render(<CommentSection postId={mockPostId} />);

      // Should not show loading, should show empty state or input
      expect(screen.queryByText('Loading comments...')).not.toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should display empty state message when no comments exist', async () => {
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: [],
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.getByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
      });

      // Should still show comment input
      expect(screen.getByTestId('comment-input')).toBeInTheDocument();
    });

    it('should display comment input even with empty comments', async () => {
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: [],
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.getByTestId('comment-input')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetching comments fails', async () => {
      const errorMessage = 'Failed to load comments';
      vi.mocked(commentsApi.getComments).mockRejectedValue(new Error(errorMessage));

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it('should display retry button when error occurs', async () => {
      vi.mocked(commentsApi.getComments).mockRejectedValue(new Error('Network error'));

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should not display comment input when error occurs', async () => {
      vi.mocked(commentsApi.getComments).mockRejectedValue(new Error('API error'));

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.queryByTestId('comment-input')).not.toBeInTheDocument();
      });
    });

    it('should handle non-Error exceptions gracefully', async () => {
      vi.mocked(commentsApi.getComments).mockRejectedValue('String error');

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load comments')).toBeInTheDocument();
      });
    });
  });

  describe('Successful Comment Display', () => {
    it('should display comments after successful fetch', async () => {
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: mockComments,
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.getByTestId('comment-comment-1')).toBeInTheDocument();
        expect(screen.getByTestId('comment-comment-2')).toBeInTheDocument();
      });

      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('First comment')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('Second comment')).toBeInTheDocument();
    });

    it('should call getComments API with correct parameters', async () => {
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: [],
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(commentsApi.getComments).toHaveBeenCalledWith(mockPostId, mockToken);
      });
    });

    it('should display comment input after successful fetch', async () => {
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: mockComments,
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.getByTestId('comment-input')).toBeInTheDocument();
      });
    });
  });

  describe('Optimistic UI Updates', () => {
    it('should add new comment to the list when onCommentCreated is called', async () => {
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: mockComments,
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      // Wait for initial comments to load
      await waitFor(() => {
        expect(screen.getByTestId('comment-comment-1')).toBeInTheDocument();
      });

      // Simulate adding a new comment via CommentInput
      const addButton = screen.getByText('Add Comment');
      addButton.click();

      // New comment should appear in the list
      await waitFor(() => {
        expect(screen.getByTestId('comment-comment-new')).toBeInTheDocument();
      });

      expect(screen.getByText('testuser')).toBeInTheDocument();
      expect(screen.getByText('New comment')).toBeInTheDocument();
    });

    it('should append new comment to the end of the list (chronological order)', async () => {
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: mockComments,
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.getByTestId('comment-comment-1')).toBeInTheDocument();
      });

      // Get all comment items (not including comment-input)
      const commentsBefore = screen.getAllByTestId(/^comment-comment-/);
      expect(commentsBefore).toHaveLength(2);

      // Add new comment
      const addButton = screen.getByText('Add Comment');
      addButton.click();

      // Verify new comment is added
      await waitFor(() => {
        const commentsAfter = screen.getAllByTestId(/^comment-comment-/);
        expect(commentsAfter).toHaveLength(3);
      });

      // Verify the new comment is at the end
      const allComments = screen.getAllByTestId(/^comment-comment-/);
      expect(allComments[2]).toHaveAttribute('data-testid', 'comment-comment-new');
    });

    it('should update from empty state to showing comment after optimistic update', async () => {
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: [],
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      // Wait for empty state
      await waitFor(() => {
        expect(screen.getByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
      });

      // Add a comment
      const addButton = screen.getByText('Add Comment');
      addButton.click();

      // Empty state should be gone, new comment should appear
      await waitFor(() => {
        expect(screen.queryByText('No comments yet. Be the first to comment!')).not.toBeInTheDocument();
        expect(screen.getByTestId('comment-comment-new')).toBeInTheDocument();
      });
    });
  });

  describe('Requirements Validation', () => {
    it('should satisfy Requirement 2.4: display empty state when no comments exist', async () => {
      // Requirement 2.4: WHEN a post has no comments, 
      // THE Comment_System SHALL display a message indicating no comments exist
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: [],
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        expect(screen.getByText('No comments yet. Be the first to comment!')).toBeInTheDocument();
      });
    });

    it('should satisfy Requirement 6.5: show prompt encouraging first comment', async () => {
      // Requirement 6.5: WHEN the comment section is empty, 
      // THE Comment_System SHALL show a prompt encouraging users to add the first comment
      vi.mocked(commentsApi.getComments).mockResolvedValue({
        comments: [],
        lastKey: null,
      });

      render(<CommentSection postId={mockPostId} />);

      await waitFor(() => {
        const emptyMessage = screen.getByText('No comments yet. Be the first to comment!');
        expect(emptyMessage).toBeInTheDocument();
        // Verify it's encouraging (contains "Be the first")
        expect(emptyMessage.textContent).toContain('Be the first');
      });
    });
  });
});
