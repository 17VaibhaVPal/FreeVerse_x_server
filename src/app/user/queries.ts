export const queries = `#graphql
    verifyGoogleToken(token: String!): String
    users: [User!]!
    getCurrentUser :User

    getUserById(id:ID!):User
`;
