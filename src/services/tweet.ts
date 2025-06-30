import Redis from "ioredis";
import { prismaClient } from "../client/db";
import { redisClient } from "../client/redis";

export interface CreateTweetPayload {
  content: string;
  imageURL?: string;
  userId: string;
}

class TweetService {
  public static async createTweet(data: CreateTweetPayload) {
    const rateLimitFlag = await redisClient.get(
      `RATE_LIMIT:TWEET:${data.userId}`
    );

    if (rateLimitFlag) throw new Error("Please wait....");
    const tweet = await prismaClient.tweet.create({
      data: {
        content: data.content,
        imageURL: data.imageURL,
        author: { connect: { id: data.userId } },
      },
    });
    await redisClient.setex(`RATE_LIMIT:TWEET:${data.userId}`, 10, "1");
    await redisClient.del("ALL_TWEETS");

    return tweet;
  }

  public static async getAllTweets() {
    const cacheTweets = await redisClient.get("ALL_TWEETS");
    if (cacheTweets) return JSON.parse(cacheTweets);
    const tweets = await prismaClient.tweet.findMany({
      orderBy: { createdAt: "desc" },
    });
    await redisClient.setex("ALL_TWEETS", 10, JSON.stringify(tweets));
    return tweets;
  }

  public static async createComment(
    tweetId: string,
    userId: string,
    content: string
  ) {
    return prismaClient.comment.create({
      data: {
        tweetId,
        userId,
        content,
      },
      include: {
        user: true, // so frontend can show name and image
      },
    });
  }

  // 👇 NEW COMMENT CODE - fetch all comments for a tweet
  public static async getComments(tweetId: string) {
    return prismaClient.comment.findMany({
      where: { tweetId },
      orderBy: { createdAt: "asc" },
      include: {
        user: true, // return author info for each comment
      },
    });
  }
}

export default TweetService;
