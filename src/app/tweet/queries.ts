export const queries = `#graphql
    getAllTweets: [Tweet]
    getSignedURLForTweet(imageName : String! ,imageType:String!):String
     getComments(tweetId: ID!): [Comment!]! 
`;