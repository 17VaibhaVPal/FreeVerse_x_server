import axios from "axios";
import { prismaClient } from "../../client/db";
import JWTService from "../../services/jwt";
import { GraphqlContext } from "../../interfaces";
import { Tweet } from "../tweet";
import { User } from "@prisma/client";
import UserService from "../../services/user";
import { redisClient } from "../../client/redis";
import bcrypt from "bcrypt";

const queries = {
  getConversations: async (_: any, __: any, ctx: GraphqlContext) => {
    if (!ctx.user) throw new Error("Unauthenticated");

    const userId = ctx.user.id;

    const sentTo = await prismaClient.message.findMany({
      where: { fromId: userId },
      select: { to: true },
    });

    const receivedFrom = await prismaClient.message.findMany({
      where: { toId: userId },
      select: { from: true },
    });

    const users = [
      ...sentTo.map((m) => m.to),
      ...receivedFrom.map((m) => m.from),
    ];

    const uniqueUsersMap = new Map<string, User>();
    for (const user of users) {
      uniqueUsersMap.set(user.id, user);
    }

    const uniqueUsers = Array.from(uniqueUsersMap.values());

    const enrichedUsers = await Promise.all(
      uniqueUsers.map(async (user) => {
        const lastMessage = await prismaClient.message.findFirst({
          where: {
            OR: [
              { fromId: user.id, toId: userId },
              { fromId: userId, toId: user.id },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        const unreadCount = await prismaClient.message.count({
          where: {
            fromId: user.id,
            toId: userId,
            read: false,
          },
        });

        return {
          ...user,
          lastMessageTimestamp: lastMessage?.createdAt?.toISOString() ?? null,
          unreadCount,
        };
      })
    );

    return enrichedUsers;
  },

  getMessagesWithUser: async (
    _: any,
    { to }: { to: string },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user) throw new Error("Unauthenticated");

    return prismaClient.message.findMany({
      where: {
        OR: [
          { fromId: ctx.user.id, toId: to },
          { fromId: to, toId: ctx.user.id },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        from: true,
        to: true,
      },
    });
  },

  verifyGoogleToken: async (parent: any, { token }: { token: string }) => {
    const restoken = await UserService.verifyGoogleAuthToken(token);
    return restoken;
  },
  getCurrentUser: async (parent: any, args: any, ctx: GraphqlContext) => {
    const id = ctx.user?.id;
    if (!id) return null;

    const user = await UserService.getUserById(id);
    return user;
  },
  getUserById: async (
    parent: any,
    { id }: { id: string },
    ctx: GraphqlContext
  ) => UserService.getUserById(id),
  //we want to ffetch user info by id

  users: async () => {
    return prismaClient.user.findMany();
  },

  getBookmarkedTweets: async (parent: any, args: any, ctx: GraphqlContext) => {
    if (!ctx.user) throw new Error("Unauthenticated");
    const bookmarks = await prismaClient.bookmark.findMany({
      where: {
        userId: ctx.user.id,
      },
      include: {
        tweet: {
          include: {
            author: true,
          },
        },
      },
    });
    return bookmarks.map((b) => b.tweet);
  },
};

// also there is no extra resolver for tweets
//this time u want tweets for a  user
const extraResolvers = {
  User: {
    tweets: (parent: User) =>
      prismaClient.tweet.findMany({ where: { author: { id: parent.id } } }),

    followers: async (parent: User) => {
      const res = await prismaClient.follows.findMany({
        where: { following: { id: parent.id } },

        include: {
          follower: true,
        },
      });
      return res.map((el) => el.follower);
    },

    following: async (parent: User) => {
      // if u want to get that whom i am following , i have to say/ask where i am the follower
      const res = await prismaClient.follows.findMany({
        where: { follower: { id: parent.id } },

        include: {
          following: true,
        },
      });
      return res.map((el) => el.following);
    },
    recommendedUser: async (
      parent: User,
      args: { forceRefresh?: boolean },
      ctx: GraphqlContext
    ) => {
      if (!ctx.user) return [];

      const cacheKey = `RECOMMENDED_USERS:${ctx.user.id}`;
      if (!args.forceRefresh) {
        const cachedValue = await redisClient.get(
          `RECOMMENDED_USERS:${ctx.user.id}`
        ); //key
        if (cachedValue) return JSON.parse(cachedValue); // ✅ Parse back to array
        //value
      }

      const myFollowings = await prismaClient.follows.findMany({
        //get people to when u r following
        where: {
          follower: { id: ctx.user.id },
        },
        include: {
          following: {
            include: { follower: { include: { following: true } } }, //this will give id of the user that "Mohit " follows , and u follow "Mohit"
          },
        },
      });

      const users: User[] = [];

      for (const followings of myFollowings) {
        for (const followingofFollowedUser of followings.following.follower) {
          if (
            followingofFollowedUser.following.id !== ctx.user.id &&
            myFollowings.findIndex(
              (e) => e?.followingId === followingofFollowedUser.following.id
            ) < 0
          ) {
            users.push(followingofFollowedUser.following);
          }
        }
      }
      //after calculating the res above (which is expensive step) and before returinng it
      // i put that particular cache as string inside our redis cache
      await redisClient.setex(cacheKey, 1, JSON.stringify(users));

      return users;
    },
    bookmarkedTweets: async (parent: User) => {
      const bookmarks = await prismaClient.bookmark.findMany({
        where: { userId: parent.id },
        include: {
          tweet: {
            include: {
              author: true,
            },
          },
        },
      });
      return bookmarks.map((b) => b.tweet);
    },
  },
//added  isLiked and likesCount amd author name at every tweet

Tweet: {

    author: (parent: any) => {
    return prismaClient.user.findUnique({
      where: { id: parent.authorId },
    });
  },
  
  isLiked: async (parent: any, _: any, ctx: GraphqlContext) => {
    if (!ctx.user) return false;

    const existing = await prismaClient.like.findUnique({
      where: {
        tweetId_userId: {
          tweetId: parent.id,
          userId: ctx.user.id,
        },
      },
    });

    return !!existing;
  },

  likesCount: async (parent: any) => {
    return prismaClient.like.count({
      where: {
        tweetId: parent.id,
      },
    });
  },
},

};

const mutations = {
  sendMessage: async (
    _: any,
    { to, content }: { to: string; content: string },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user || !ctx.user.id) throw new Error("Unauthenticated");

    await prismaClient.message.create({
      data: {
        content,
        fromId: ctx.user.id,
        toId: to,
      },
    });

    return true;
  },

  loginWithEmail: async (_: any, args: { email: string; password: string }) => {
    const user = await prismaClient.user.findUnique({
      where: { email: args.email },
    });

    if (!user) {
      throw new Error("User not found");
    }
    if (!user.password) {
      throw new Error("Password not set for this user");
    }

    const isValid = await bcrypt.compare(args.password, user.password);
    if (!isValid) {
      throw new Error("Invalid password");
    }

    return JWTService.generateTokenForUser(user);
  },
  markMessagesAsRead: async (
    _: any,
    { fromId }: { fromId: string },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user) throw new Error("Unauthenticated");

    await prismaClient.message.updateMany({
      where: {
        fromId,
        toId: ctx.user.id,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return true;
  },

  createAccount: async (
    parent: any,
    {
      email,
      firstName,
      lastName,
      password,
    }: { email: string; firstName: string; lastName: string; password: string },
    ctx: GraphqlContext
  ) => {
    const user = await UserService.createAccount({
      email,
      firstName,
      lastName,
      password,
    });
    return JWTService.generateTokenForUser(user);
  },

  followUser: async (
    parent: any,
    { to }: { to: string },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user || !ctx.user.id) throw new Error("unauthenticated");

    await UserService.followUser(ctx.user.id, to);
    await redisClient.del(`RECOMMENDED_USERS:${ctx.user.id}`);
    return true;
  },

  unfollowUser: async (
    parent: any,
    { to }: { to: string },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user || !ctx.user.id) throw new Error("unauthenticated");
    await UserService.unfollowUser(ctx.user.id, to);
    await redisClient.del(`RECOMMENDED_USERS:${ctx.user.id}`);
    return true;
  },

  bookmarkTweet: async (
    parent: any,
    { tweetId }: { tweetId: string },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user) throw new Error("Unauthorized");
    await prismaClient.bookmark.create({
      data: {
        userId: ctx.user.id,
        tweetId,
      },
    });
    return true;
  },

  removeBookmark: async (
    parent: any,
    { tweetId }: { tweetId: string },
    ctx: GraphqlContext
  ) => {
    if (!ctx.user) throw new Error("Unauthorized");
    await prismaClient.bookmark.deleteMany({
      where: {
        userId: ctx.user.id,
        tweetId,
      },
    });
    return true;
  },

  //added new like/unlike tweet
  likeTweet: async (
  parent: any,
  { tweetId }: { tweetId: string },
  ctx: GraphqlContext
) => {
  if (!ctx.user) throw new Error("Unauthorized");

  await prismaClient.like.create({
    data: {
      tweetId,
      userId: ctx.user.id,
    },
  });

  return true;
},

unlikeTweet: async (
  parent: any,
  { tweetId }: { tweetId: string },
  ctx: GraphqlContext
) => {
  if (!ctx.user) throw new Error("Unauthorized");

  await prismaClient.like.deleteMany({
    where: {
      tweetId,
      userId: ctx.user.id,
    },
  });

  return true;
},
 

};

export const resolvers = { queries, extraResolvers, mutations };
