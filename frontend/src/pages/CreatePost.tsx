import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { postsApi } from '../services/api';

const MAX_CONTENT_LENGTH = 280;

const CreatePost: React.FC = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();
  const navigate = useNavigate();

  const handleCancel = useCallback(() => {
    if (content.trim()) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave? Your draft will be lost.');
      if (!confirmed) return;
    }
    navigate('/');
  }, [content, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [content, loading, handleCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Post content cannot be empty');
      return;
    }
    
    if (content.length > MAX_CONTENT_LENGTH) {
      setError(`Post content cannot exceed ${MAX_CONTENT_LENGTH} characters`);
      return;
    }
    
    if (!token) {
      setError('You must be logged in to create a post');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      await postsApi.createPost(content, token);
      
      // Redirect to feed after successful post creation
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post');
      console.error('Error creating post:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-post">
      <h2>Create a New Post</h2>
      
      <form onSubmit={handleSubmit}>
        {error && <div className="error-message">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="content">What's on your mind?</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={5}
            disabled={loading}
            required
          />
          <div className={`character-count ${content.length > 260 ? 'warning' : ''}`}>
            {content.length} / {MAX_CONTENT_LENGTH} characters
          </div>
        </div>
        
        <div className="button-group">
          <button type="submit" disabled={loading || !content.trim() || content.length > MAX_CONTENT_LENGTH}>
            {loading ? 'Posting...' : 'Post'}
          </button>
          <button type="button" onClick={handleCancel} disabled={loading} className="cancel-button">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;
