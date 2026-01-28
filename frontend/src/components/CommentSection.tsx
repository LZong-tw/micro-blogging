import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { commentsApi } from '../services/api';
import { Comment } from '../types';
import CommentItem from './CommentItem';
import CommentInput from './CommentInput';
import './CommentSection.css';

interface CommentSectionProps {
  postId: string;
  initialCommentCount?: number;
}

const CommentSection: React.FC<CommentSectionProps> = ({ postId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  // Fetch comments on mount
  useEffect(() => {
    const fetchComments = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await commentsApi.getComments(postId, token);
        setComments(response.comments);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load comments');
        console.error('Error fetching comments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [postId, token]);

  // Handle new comment creation with optimistic UI update
  const handleCommentCreated = (newComment: Comment) => {
    // Add the new comment to the end of the list (chronological order)
    setComments((prevComments) => [...prevComments, newComment]);
  };

  // Loading state
  if (loading) {
    return (
      <div className="comment-section">
        <div className="comment-section-loading">Loading comments...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="comment-section">
        <div className="comment-section-error">
          {error}
          <button 
            className="comment-retry-btn"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="comment-section">
      {/* Comments list */}
      <div className="comments-list">
        {comments.length === 0 ? (
          <div className="comments-empty">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>

      {/* Comment input */}
      <CommentInput postId={postId} onCommentCreated={handleCommentCreated} />
    </div>
  );
};

export default CommentSection;
