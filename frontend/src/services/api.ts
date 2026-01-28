import { User } from '../types/user';
import { Post } from '../types/post';
import { Comment } from '../types/comment';

// Use environment variable for API URL
const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

// Log the API URL to help with debugging
console.log('API URL being used:', API_URL);

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API error: ${response.status}`);
  }
  return response.json();
};

// Auth API calls
export const authApi = {
  register: async (username: string, email: string, password: string, displayName: string): Promise<{ message: string }> => {
    console.log(`Making registration request to: ${API_URL}/auth/register`);
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password, displayName }),
    });
    return handleResponse(response);
  },

  login: async (username: string, password: string): Promise<{ token: string; user: User }> => {
    console.log(`Making login request to: ${API_URL}/auth/login`);
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: username, password }),
    });
    return handleResponse(response);
  },
};

// Users API calls
export const usersApi = {
  getProfile: async (userId: string, token: string): Promise<{ user: User }> => {
    console.log(`Making getProfile request to: ${API_URL}/users/${userId}`);
    const response = await fetch(`${API_URL}/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  updateProfile: async (userId: string, data: Partial<User>, token: string): Promise<{ user: User }> => {
    console.log(`Making updateProfile request to: ${API_URL}/users/${userId}`);
    const response = await fetch(`${API_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  followUser: async (userId: string, token: string): Promise<{ message: string }> => {
    console.log(`Making followUser request to: ${API_URL}/users/${userId}/follow`);
    const response = await fetch(`${API_URL}/users/${userId}/follow`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  unfollowUser: async (userId: string, token: string): Promise<{ message: string }> => {
    console.log(`Making unfollowUser request to: ${API_URL}/users/${userId}/unfollow`);
    const response = await fetch(`${API_URL}/users/${userId}/unfollow`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  checkFollowing: async (userId: string, token: string): Promise<{ following: boolean }> => {
    console.log(`Making checkFollowing request to: ${API_URL}/users/${userId}/following`);
    const response = await fetch(`${API_URL}/users/${userId}/following`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
};

// Posts API calls
export const postsApi = {
  getPosts: async (
    token: string, 
    options: { 
      limit?: number; 
      nextToken?: string; 
      sortBy?: 'newest' | 'popular';
      userId?: string;
    } = {}
  ): Promise<{ posts: Post[]; nextToken: string | null }> => {
    const { limit = 10, nextToken, sortBy = 'newest', userId } = options;
    
    let url = `${API_URL}/posts?limit=${limit}&sortBy=${sortBy}`;
    if (nextToken) url += `&nextToken=${nextToken}`;
    if (userId) url += `&userId=${userId}`;
    
    console.log(`Making getPosts request to: ${url}`);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  getPost: async (postId: string, token: string): Promise<{ post: Post }> => {
    console.log(`Making getPost request to: ${API_URL}/posts/${postId}`);
    const response = await fetch(`${API_URL}/posts/${postId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  createPost: async (content: string, token: string): Promise<{ post: Post }> => {
    console.log(`Making createPost request to: ${API_URL}/posts`);
    const response = await fetch(`${API_URL}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });
    return handleResponse(response);
  },

  updatePost: async (postId: string, content: string, token: string): Promise<{ post: Post }> => {
    console.log(`Making updatePost request to: ${API_URL}/posts/${postId}`);
    const response = await fetch(`${API_URL}/posts/${postId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });
    return handleResponse(response);
  },

  deletePost: async (postId: string, token: string): Promise<{ message: string }> => {
    console.log(`Making deletePost request to: ${API_URL}/posts/${postId}`);
    const response = await fetch(`${API_URL}/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  likePost: async (postId: string, token: string): Promise<{ message: string }> => {
    console.log(`Making likePost request to: ${API_URL}/posts/${postId}/like`);
    const response = await fetch(`${API_URL}/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  unlikePost: async (postId: string, token: string): Promise<{ message: string }> => {
    console.log(`Making unlikePost request to: ${API_URL}/posts/${postId}/unlike`);
    const response = await fetch(`${API_URL}/posts/${postId}/unlike`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },
};

// Comments API calls
export const commentsApi = {
  getComments: async (
    postId: string,
    token: string,
    options: {
      limit?: number;
      lastKey?: string;
    } = {}
  ): Promise<{ comments: Comment[]; lastKey: string | null }> => {
    const { limit = 50, lastKey } = options;
    
    let url = `${API_URL}/posts/${postId}/comments?limit=${limit}`;
    if (lastKey) url += `&lastKey=${encodeURIComponent(lastKey)}`;
    
    console.log(`Making getComments request to: ${url}`);
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return handleResponse(response);
  },

  createComment: async (postId: string, text: string, token: string): Promise<Comment> => {
    console.log(`Making createComment request to: ${API_URL}/posts/${postId}/comments`);
    const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ postId, text }),
    });
    return handleResponse(response);
  },
};
