import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { User } from "./user";
import cors from "cors";
import { DateTimeResolver, GraphQLDateTime } from "graphql-scalars";

import JWTService from "../services/jwt";
import { GraphqlContext } from "../interfaces";
import { Tweet } from "./tweet";

export async function initServer() {
  const app = express();

  app.use(express.json());

  app.use(
    cors({
      origin: [
         "http://localhost:3000",
        "https://studio.apollographql.com",
        "https://free-verse.vercel.app",
      ],
      credentials: true,
    })
  );

  const graphqlServer = new ApolloServer<GraphqlContext>({
    typeDefs: `
         scalar DateTime 

        ${User.types}
        ${Tweet.types}

        type Query{
            ${User.queries}
            ${Tweet.queries}
        }
        type Mutation{
            ${Tweet.mutations}
            ${User.mutations}
        }
        `,

    resolvers: {
      DateTime: GraphQLDateTime,
      Query: {
        ...User.resolvers.queries,
        ...Tweet.resolvers.queries,
      },
      Mutation: {
        ...Tweet.resolvers.mutations,
        ...User.resolvers.mutations,
      },
      ...Tweet.resolvers.extraResolvers,
      ...User.resolvers.extraResolvers,
    },

    introspection: true,
  });

  await graphqlServer.start();

  app.use(
    "/graphql",
    cors<cors.CorsRequest>({
      origin: [
        "http://localhost:3000",
        "https://studio.apollographql.com",
        "https://free-verse.vercel.app",
      ],
      credentials: true,
    }),

    expressMiddleware(graphqlServer, {
      context: async ({ req }) => {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : null;
        const user = token ? JWTService.decodeToken(token) : undefined;

        //  Log the decoded user for debugging
        if (process.env.NODE_ENV === "development") {
          console.log("Decoded user from JWT:", user);
        }

        return { user };
      },
    })
  );

  return app;
}
