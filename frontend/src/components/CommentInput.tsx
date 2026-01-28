import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { commentsApi } from '../services/api';
import { Comment } from '../types';
import './CommentInput.css';

const MAX_COMMENT_LENGTH = 280;

interface CommentInputProps {
  postId: string;
  onCommentCreated: (comment: Comment) => void;
}

const CommentInput: React.FC<CommentInputProps> = ({ postId, onCommentCreated }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const remainingChars = MAX_COMMENT_LENGTH - text.length;
  const isValid = text.trim().length > 0 && text.length <= MAX_COMMENT_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    if (!text.trim()) {
      setError('Comment cannot be empty');
      return;
    }

    if (text.length > MAX_COMMENT_LENGTH) {
      setError(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`);
      return;
    }

    if (!token) {
      setError('You must be logged in to comment');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const newComment = await commentsApi.createComment(postId, text, token);
      
      // Clear input on success
      setText('');
      
      // Notify parent component
      onCommentCreated(newComment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create comment');
      console.error('Error creating comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  };

  return (
    <div className="comment-input">
      <form onSubmit={handleSubmit}>
        {error && <div className="comment-error">{error}</div>}
        
        <div className="comment-input-group">
          <textarea
            className="comment-textarea"
            value={text}
            onChange={handleChange}
            placeholder="Write a comment..."
            rows={2}
            disabled={submitting}
          />
          <div className="comment-input-footer">
            <div className={`comment-char-count ${remainingChars < 20 ? 'warning' : ''}`}>
              {remainingChars} characters remaining
            </div>
            <button
              type="submit"
              className="comment-submit-btn"
              disabled={!isValid || submitting}
            >
              {submitting ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CommentInput;
