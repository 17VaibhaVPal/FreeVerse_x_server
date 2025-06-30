export const mutations =`#graphql
        createTweet(payload: CreateTweetData!):Tweet

         createComment(tweetId: ID!, content: String!): Comment!  
`;
