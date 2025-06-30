export const mutations = `#graphql
 loginWithEmail(email: String!, password: String!): String
   createAccount(email: String!, firstName: String!, lastName: String!, password: String!): String! 
  followUser(to: ID!): Boolean
  unfollowUser(to: ID!): Boolean
  bookmarkTweet(tweetId: ID!): Boolean  
  removeBookmark(tweetId: ID!): Boolean  
   sendMessage(to: ID!, content: String!): Boolean
     markMessagesAsRead(fromId: ID!): Boolean

    likeTweet(tweetId: ID!): Boolean       # 👈 NEW
  unlikeTweet(tweetId: ID!): Boolean     # 👈 NEW
`;
