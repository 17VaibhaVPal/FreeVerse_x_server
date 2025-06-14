"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.types = void 0;
exports.types = `#graphql
    
scalar DateTime

type User {
  id: ID!
  firstName: String!
  lastName: String
  email: String!
  profileImageURL: String
  followers: [User!]!
  following: [User!]!
  recommendedUser : [User!]!
  tweets: [Tweet!]!
   bookmarkedTweets: [Tweet!]!
    lastMessageTimestamp: String
  unreadCount: Int
}

   type Message {
  id: ID!
  content: String!
  from: User!
  to: User!
  createdAt: DateTime!
}
  type Query {
  verifyGoogleToken(token: String!): String
  users: [User!]!
  getCurrentUser: User
  getUserById(id: ID!): User
  getBookmarkedTweets: [Tweet!]!
  getMessagesWithUser(to: ID!): [Message!]!
  getConversations: [User!]!  # ✅ ADD THIS LINE
}


`;
