import { GraphQLArgument } from "graphql";
import { GraphqlContext } from "../../interfaces";
import { prismaClient } from "../../client/db";

import { Tweet } from "@prisma/client";
import { User } from "../user";


interface CreateTweetPayload {

    content: string
    imageURL?: string


}
const queries ={
    getAllTweets:() =>prismaClient.tweet.findMany({orderBy:{createdAt:'desc'}}),
}

const mutations = {
    createTweet: async (parent: any, { payload }: { payload: CreateTweetPayload }, ctx: GraphqlContext) => {
        if (!ctx.user) throw new Error("You  are not authenticated");

        const tweet = await prismaClient.tweet.create({
            data: {
                content: payload.content,
                imageURL: payload.imageURL,
                author: { connect: { id: ctx.user.id } },
            },
        });

        return tweet;
    }
}


//as earlier there was no resolver for this "author" , so create extra resolver 
 
const extraResolvers = {
    Tweet: {
        //so for  a Tweet if u r asking m for an author , Tweet is the parent 
        author: (parent: Tweet) =>
            prismaClient.user.findUnique({ where: { id: parent.authorId } }),
        //so basically u r finding the user from the tweet's authorId
    },
};


export const resolvers = { mutations,extraResolvers,queries };