import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { User } from "./user";
import cors from "cors";
import { prismaClient } from "../client/db";
import JWTService from "../services/jwt";
import { GraphqlContext } from "../interfaces";
import { Tweet } from "./tweet";

export async function initServer() {
  const app = express();

  app.use(express.json());
  app.use(cors());

  const graphqlServer = new ApolloServer<GraphqlContext>({
    typeDefs: `
        ${User.types}
        ${Tweet.types}

        type Query{
            ${User.queries}
            ${Tweet.queries}
        }
        type Mutation{
            ${Tweet.mutations}
        }
        `,

    resolvers: {
      Query: {
        ...User.resolvers.queries,
        ...Tweet.resolvers.queries,
      },
      Mutation: {
        ...Tweet.resolvers.mutations,
      },
      ...Tweet.resolvers.extraResolvers,
      ...User.resolvers.extraResolvers,
    },

    introspection: true,
  });

  await graphqlServer.start();

  app.use(
    "/graphql",
    expressMiddleware(graphqlServer, {
      context: async ({ req }) => {
        const token = req.headers.authorization?.split("Bearer ")[1];
        const user = token ? JWTService.decodeToken(token) : undefined;

        //  Log the decoded user for debugging
        console.log("Decoded user from JWT:", user);

        return { user };
      },
    })
  );

  return app;
}
