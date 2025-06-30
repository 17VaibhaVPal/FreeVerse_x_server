"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.types = void 0;
exports.types = `#graphql

        input CreateTweetData{
            content :String!    
            imageURL:String
        }
         type Comment {
        id: ID!
        content: String!
        user: User!
        createdAt: DateTime!
         }
        type Tweet {
            id :ID!
            content :String!
            imageURL :  String
            author :User
            isBookmarked: Boolean

            isLiked: Boolean           
            likesCount: Int 

            comments: [Comment!]      
            commentsCount: Int
        }
`;
