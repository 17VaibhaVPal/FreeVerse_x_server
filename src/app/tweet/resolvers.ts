import { GraphqlContext } from "../../interfaces";
import { prismaClient } from "../../client/db";
import {
  S3Client,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Tweet } from "@prisma/client";
import UserService from "../../services/user";
import TweetService, { CreateTweetPayload } from "../../services/tweet";

const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION,
});

const queries = {
  getAllTweets: () => TweetService.getAllTweets(),

  getSignedURLForTweet: async (
    parent: any,
    { imageType, imageName }: { imageType: string; imageName: string },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user?.id) throw new Error("Unauthorised");

    const allowedImageType = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedImageType.includes(imageType))
      throw new Error("Unsupported image type");

    const fileExtension = imageType.split("/")[1];

    const putObjectCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: `upload/${ctx.user.id}/tweets/${imageName}-${Date.now()}.${fileExtension}`,
      ContentType: imageType,
    });

    const signedURL = await getSignedUrl(s3Client, putObjectCommand);
    return signedURL;
  },

  // ✅ NEW: Fetch comments for a tweet
  getComments: async (
    parent: any,
    { tweetId }: { tweetId: string },
    ctx: GraphqlContext
  ) => {
    return await prismaClient.comment.findMany({
      where: { tweetId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
  },
};

const mutations = {
  createTweet: async (
    parent: any,
    { payload }: { payload: CreateTweetPayload },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user) throw new Error("You are not authenticated");

    const tweet = await TweetService.createTweet({
      ...payload,
      userId: ctx.user.id,
    });

    return tweet;
  },

  // ✅ NEW: Create a comment
  createComment: async (
    parent: any,
    { tweetId, content }: { tweetId: string; content: string },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user) throw new Error("You are not authenticated");

    const comment = await prismaClient.comment.create({
      data: {
        tweetId,
        content,
        userId: ctx.user.id,
      },
      include: { user: true },
    });

    return comment;
  },
};

//as earlier there was no resolver for this "author" , so create extra resolver

const extraResolvers = {
  Tweet: {
    //so for  a Tweet if u r asking m for an author , Tweet is the parent
    author: (parent: Tweet) => UserService.getUserById(parent.authorId),
    //so basically u r finding the user from the tweet's authorId
    isBookmarked: async (parent: Tweet, _args: any, ctx: GraphqlContext) => {
      if (!ctx.user) return false;

      const existingBookmark = await prismaClient.bookmark.findFirst({
        where: {
          userId: ctx.user.id,
          tweetId: parent.id,
        },
      });

      return !!existingBookmark;
    },

    commentsCount: async (parent: Tweet) => {
      return await prismaClient.comment.count({
        where: { tweetId: parent.id },
      });
    },

    // ✅ Get list of comments
    comments: async (parent: Tweet) => {
      return await prismaClient.comment.findMany({
        where: { tweetId: parent.id },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      });
    },
  },
};

export const resolvers = { mutations, queries, extraResolvers };
