# Product Overview

## Micro Blogging App

A social media platform for sharing short-form content with user authentication, profiles, posts, likes, and follow functionality.

## Core Features

- User registration and authentication via AWS Cognito
- Create posts (280 character limit)
- Like posts
- Follow/unfollow users
- User profiles with follower counts
- Feed with sorting options (recent, popular)
- Responsive design for mobile and desktop

## Architecture

Serverless application built on AWS:
- Frontend: React SPA hosted on S3/CloudFront
- Backend: Lambda functions behind API Gateway
- Database: DynamoDB tables for users, posts, likes, follows
- Auth: AWS Cognito for user management

## Design Philosophy

Modern social media aesthetic with purple accent colors, rounded elements, and clean layouts. Mobile-first responsive design optimized for content discovery and user engagement.
