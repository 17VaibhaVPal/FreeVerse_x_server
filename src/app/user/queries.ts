export const queries = `#graphql
    verifyGoogleToken(token: String!): String
    users: [User!]!
    getCurrentUser :User
    getUserById(id:ID!):User
     getBookmarkedTweets: [Tweet!]! 
     getMessagesWithUser(to: ID!): [Message!]!
      getConversations: [User!]! 
`;
